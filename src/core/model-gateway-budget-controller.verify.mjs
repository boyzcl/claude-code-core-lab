import assert from "node:assert/strict";
import { MockResponsesAdapter } from "./model-gateway.mjs";
import {
  BudgetController,
  BudgetedModelGateway,
  CORE23_LOCAL_GATEWAY_PRICING_TABLE,
  CORE23_MODEL_GATEWAY_BUDGET_VERSION,
  ModelGatewayBudgetError,
  ProviderCapabilityRegistry,
  createCore23FixtureRequest,
  failureEvent,
  gatewayBoundary,
  runModelGatewayBudgetControllerDemo,
  textEvents,
  toolCallEvents,
  verifyModelGatewayBudgetControllerDemo,
} from "./model-gateway-budget-controller.mjs";

const cases = [];

await record("core23: budgeted gateway demo runs and verifies", async () => {
  const result = await runModelGatewayBudgetControllerDemo();
  return verifyModelGatewayBudgetControllerDemo(result.output);
});

await record("token budget gate: oversized request is blocked before provider call", async () => {
  const adapter = new MockResponsesAdapter({
    steps: [
      toolCallEvents("should_not_run", "Search", {
        query: "unreachable",
      }),
    ],
  });
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "primary",
        model: "tiny-context-model",
        adapter,
        capabilities: {
          maxInputTokens: 80,
        },
      },
    ],
    budgetController: new BudgetController({
      maxInputTokens: 80,
      maxTotalTokens: 200,
      maxEstimatedCostUsd: 1,
    }),
  });
  const request = createCore23FixtureRequest({
    messages: [
      {
        role: "user",
        content: "x".repeat(1600),
      },
    ],
    maxOutputTokens: 50,
  });

  await assert.rejects(
    () => gateway.next(request),
    (error) =>
      error instanceof ModelGatewayBudgetError &&
      error.code === "budget_exceeded" &&
      error.details.rejections[0].reason === "token_budget_exceeded",
  );
  assert.equal(adapter.index, 0);

  return {
    provider_calls: adapter.index,
    blocked_before_provider_call: true,
  };
});

await record("cost budget gate: expensive primary is skipped for cheaper fallback", async () => {
  const expensiveAdapter = new MockResponsesAdapter({
    steps: [
      toolCallEvents("expensive_should_not_run", "Search", {
        query: "unreachable",
      }),
    ],
  });
  const cheapAdapter = new MockResponsesAdapter({
    steps: [
      toolCallEvents("cheap_search", "Search", {
        query: "pageSize + 1",
      }),
    ],
  });
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "expensive",
        model: "expensive-primary",
        adapter: expensiveAdapter,
        pricingTable: localPriceTable("expensive", 20_000, 20_000, 20_000),
      },
      {
        id: "cheap",
        model: "cheap-fallback",
        adapter: cheapAdapter,
        pricingTable: localPriceTable("cheap", 1, 0.25, 2),
      },
    ],
    primaryProviderId: "expensive",
    fallbackProviderIds: ["cheap"],
    budgetController: new BudgetController({
      maxInputTokens: 1200,
      maxTotalTokens: 1600,
      maxEstimatedCostUsd: 0.001,
    }),
    retryPolicy: { maxRetries: 0 },
  });

  const output = await gateway.next(createCore23FixtureRequest());

  assert.equal(expensiveAdapter.index, 0);
  assert.equal(cheapAdapter.index, 1);
  assert.equal(output.metadata.provider.providerId, "cheap");
  assert.equal(
    output.metadata.gatewayTrace.some(
      (event) =>
        event.event === "budget.rejected" &&
        event.providerId === "expensive" &&
        event.reason === "cost_budget_exceeded",
    ),
    true,
  );

  return {
    expensive_provider_calls: expensiveAdapter.index,
    fallback_provider: output.metadata.provider.providerId,
    cost_decision: "fallback_due_cost_budget",
  };
});

await record("retryable failure: mock rate limit and timeout are retried", async () => {
  const adapter = new MockResponsesAdapter({
    steps: [
      failureEvent("rate_limit", "temporary rate limit", 429),
      failureEvent("timeout", "temporary timeout"),
      toolCallEvents("retry_success_search", "Search", {
        query: "pageSize + 1",
      }),
    ],
  });
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "primary",
        model: "retryable-primary",
        adapter,
      },
    ],
    retryPolicy: { maxRetries: 2 },
  });

  const output = await gateway.next(createCore23FixtureRequest());
  const retryEvents = output.metadata.gatewayTrace.filter(
    (event) => event.event === "retry.scheduled",
  );

  assert.equal(output.metadata.provider.attempts, 3);
  assert.equal(adapter.index, 3);
  assert.equal(retryEvents.length, 2);

  return {
    provider_attempts: output.metadata.provider.attempts,
    retry_events: retryEvents.length,
  };
});

await record("non-retryable failure: invalid tool schema is not retried", async () => {
  const adapter = new MockResponsesAdapter({
    steps: [
      toolCallEvents("bad_tool", "DeleteEverything", {
        path: "src/pagination.cjs",
      }),
      toolCallEvents("should_not_retry", "Search", {
        query: "unreachable",
      }),
    ],
  });
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "primary",
        model: "schema-primary",
        adapter,
      },
    ],
    retryPolicy: { maxRetries: 2 },
  });

  await assert.rejects(
    () => gateway.next(createCore23FixtureRequest()),
    (error) => error.code === "unknown_tool",
  );
  assert.equal(adapter.index, 1);

  return {
    provider_calls: adapter.index,
    invalid_tool_not_retried: true,
  };
});

await record("fallback: primary failover uses fallback provider", async () => {
  const primaryAdapter = new MockResponsesAdapter({
    steps: [failureEvent("provider_unavailable", "primary unavailable", 503)],
  });
  const fallbackAdapter = new MockResponsesAdapter({
    steps: [
      toolCallEvents("fallback_read", "Read", {
        path: "src/pagination.cjs",
      }),
    ],
  });
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "primary",
        model: "primary-model",
        adapter: primaryAdapter,
      },
      {
        id: "fallback",
        model: "fallback-model",
        adapter: fallbackAdapter,
      },
    ],
    primaryProviderId: "primary",
    fallbackProviderIds: ["fallback"],
    retryPolicy: { maxRetries: 0 },
  });

  const output = await gateway.next(createCore23FixtureRequest());

  assert.equal(primaryAdapter.index, 1);
  assert.equal(fallbackAdapter.index, 1);
  assert.equal(output.metadata.provider.providerId, "fallback");
  assert.equal(
    output.metadata.gatewayTrace.some(
      (event) => event.event === "provider.failed" && event.providerId === "primary",
    ),
    true,
  );

  return {
    primary_failed: true,
    fallback_used: output.metadata.provider.providerId,
  };
});

await record("capability registry: unsupported tools and streaming are not exposed", async () => {
  let seenRequest = null;
  const adapter = new MockResponsesAdapter({
    steps: [
      (request) => {
        seenRequest = request;
        return textEvents("No tool call because only Read is exposed.");
      },
    ],
  });
  const registry = new ProviderCapabilityRegistry({
    entries: [
      {
        providerId: "limited",
        model: "limited-model",
        toolCalls: true,
        streaming: false,
        reasoning: false,
        supportedTools: ["Read"],
        maxInputTokens: 1200,
      },
    ],
  });
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "limited",
        model: "limited-model",
        adapter,
      },
    ],
    capabilityRegistry: registry,
  });

  const output = await gateway.next(createCore23FixtureRequest());

  assert.equal(output.type, "final_answer");
  assert.deepEqual(seenRequest.tools.map((tool) => tool.name), ["Read"]);
  assert.equal(seenRequest.metadata.capabilities.streaming, false);
  assert.equal(seenRequest.reasoning, null);
  assert.deepEqual(output.metadata.capabilityDecision.exposedTools, ["Read"]);
  assert.equal(output.metadata.capabilityDecision.streamingExposed, false);

  return {
    exposed_tools: output.metadata.capabilityDecision.exposedTools,
    streaming_exposed: output.metadata.capabilityDecision.streamingExposed,
    reasoning_exposed: output.metadata.capabilityDecision.reasoningExposed,
  };
});

await record("output repair boundary: repairable JSON becomes schema-valid tool call", async () => {
  const repairableJson = [
    "{",
    '  "tool_call": {',
    '    "id": "repair_search",',
    '    "name": "Search",',
    '    "input": { "query": "pageSize + 1", },',
    "  },",
    "}",
  ].join("\n");
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "primary",
        model: "repair-primary",
        adapter: new MockResponsesAdapter({
          steps: [textEvents(repairableJson)],
        }),
      },
    ],
  });

  const output = await gateway.next(createCore23FixtureRequest());

  assert.equal(output.type, "tool_call");
  assert.equal(output.toolCall.name, "Search");
  assert.deepEqual(output.toolCall.input, { query: "pageSize + 1" });
  assert.equal(output.metadata.repair.applied, true);
  assert.equal(output.metadata.repair.strategy, "remove_trailing_commas");

  return {
    repaired_output: true,
    repair_strategy: output.metadata.repair.strategy,
    schema_valid_after_repair: true,
  };
});

await record("boundary: gateway budget evidence is local and not production claim", async () => {
  const result = await runModelGatewayBudgetControllerDemo();

  assert.equal(CORE23_MODEL_GATEWAY_BUDGET_VERSION, "core23-model-gateway-budget-controller-v1");
  assert.equal(CORE23_LOCAL_GATEWAY_PRICING_TABLE.realVendorPriceClaim, false);
  assert.deepEqual(result.boundary, gatewayBoundary());
  assert.equal(result.boundary.deterministicLocalEvidence, true);
  assert.equal(result.boundary.productionProviderReliabilityClaim, false);
  assert.equal(result.boundary.realVendorBillingClaim, false);
  assert.equal(result.boundary.fullProductionGatewayClaim, false);

  return {
    deterministic_local_evidence: true,
    no_real_vendor_billing_claim: true,
    no_full_production_gateway_claim: true,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

async function record(name, fn) {
  try {
    cases.push({
      name,
      status: "passed",
      details: await fn(),
    });
  } catch (error) {
    cases.push({
      name,
      status: "failed",
      message: error.message,
    });
    throw error;
  }
}

function localPriceTable(id, uncachedInputUsdPer1M, cachedInputUsdPer1M, outputUsdPer1M) {
  return {
    id,
    currency: "USD",
    source: "local_configured_example_not_vendor_price",
    realVendorPriceClaim: false,
    uncachedInputUsdPer1M,
    cachedInputUsdPer1M,
    outputUsdPer1M,
  };
}
