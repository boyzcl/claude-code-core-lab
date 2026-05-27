import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  CORE_TOOL_SCHEMAS,
  MockResponsesAdapter,
  ModelGatewayError,
  validateToolCall,
} from "./model-gateway.mjs";

export const CORE23_MODEL_GATEWAY_BUDGET_VERSION =
  "core23-model-gateway-budget-controller-v1";

export const CORE23_LOCAL_GATEWAY_PRICING_TABLE = Object.freeze({
  id: "core23-local-gateway-budget-example",
  currency: "USD",
  source: "local_configured_example_not_vendor_price",
  realVendorPriceClaim: false,
  uncachedInputUsdPer1M: 2,
  cachedInputUsdPer1M: 0.5,
  outputUsdPer1M: 8,
});

const DEFAULT_RETRYABLE_PROVIDER_CODES = new Set([
  "rate_limit",
  "timeout",
  "provider_unavailable",
  "provider_http_429",
  "provider_http_500",
  "provider_http_503",
]);

export class ProviderCapabilityRegistry {
  constructor({ entries = [] } = {}) {
    this.entries = new Map();
    for (const entry of entries) {
      this.register(entry);
    }
  }

  register(entry) {
    const normalized = normalizeCapabilities(entry);
    this.entries.set(providerCapabilityKey(normalized.providerId, normalized.model), normalized);
    return normalized;
  }

  resolve({ providerId, model }) {
    return cloneJson(
      this.entries.get(providerCapabilityKey(providerId, model)) ??
        this.entries.get(providerCapabilityKey(providerId, "*")) ??
        normalizeCapabilities({ providerId, model }),
    );
  }

  filterTools(tools, capabilities) {
    if (!capabilities.toolCalls) return [];

    const supportedTools = capabilities.supportedTools;
    if (!Array.isArray(supportedTools) || supportedTools.length === 0) {
      return cloneJson(tools);
    }

    const allowed = new Set(supportedTools);
    return cloneJson(tools.filter((tool) => allowed.has(tool.name)));
  }
}

export class BudgetController {
  constructor({
    maxInputTokens = 1400,
    maxOutputTokens = 600,
    maxTotalTokens = 2000,
    maxEstimatedCostUsd = 0.01,
    pricingTable = CORE23_LOCAL_GATEWAY_PRICING_TABLE,
  } = {}) {
    validatePricingTable(pricingTable);
    this.maxInputTokens = maxInputTokens;
    this.maxOutputTokens = maxOutputTokens;
    this.maxTotalTokens = maxTotalTokens;
    this.maxEstimatedCostUsd = maxEstimatedCostUsd;
    this.pricingTable = pricingTable;
  }

  assess({ provider, request, capabilities }) {
    const tokenEstimate = estimateModelRequestTokens(request);
    const effectiveInputLimit = Math.min(
      this.maxInputTokens,
      capabilities.maxInputTokens ?? this.maxInputTokens,
    );
    const effectiveOutputLimit = Math.min(
      this.maxOutputTokens,
      request.maxOutputTokens ?? this.maxOutputTokens,
    );
    const cappedEstimate = {
      ...tokenEstimate,
      outputTokens: effectiveOutputLimit,
      totalTokens: tokenEstimate.inputTokens + effectiveOutputLimit,
    };
    const pricingTable = provider.pricingTable ?? this.pricingTable;
    validatePricingTable(pricingTable);
    const estimatedCostUsd = estimateGatewayCostUsd(cappedEstimate, pricingTable);

    if (cappedEstimate.inputTokens > effectiveInputLimit) {
      return budgetDecision({
        allowed: false,
        reason: "token_budget_exceeded",
        action: "compact_or_reduce_context_before_model_call",
        provider,
        capabilities,
        tokenEstimate: cappedEstimate,
        estimatedCostUsd,
        limits: this.limitsFor(effectiveInputLimit, effectiveOutputLimit),
      });
    }

    if (cappedEstimate.totalTokens > this.maxTotalTokens) {
      return budgetDecision({
        allowed: false,
        reason: "token_budget_exceeded",
        action: "reduce_output_or_context_before_model_call",
        provider,
        capabilities,
        tokenEstimate: cappedEstimate,
        estimatedCostUsd,
        limits: this.limitsFor(effectiveInputLimit, effectiveOutputLimit),
      });
    }

    if (estimatedCostUsd > this.maxEstimatedCostUsd) {
      return budgetDecision({
        allowed: false,
        reason: "cost_budget_exceeded",
        action: "try_cheaper_fallback_or_ask_for_budget",
        provider,
        capabilities,
        tokenEstimate: cappedEstimate,
        estimatedCostUsd,
        limits: this.limitsFor(effectiveInputLimit, effectiveOutputLimit),
      });
    }

    return budgetDecision({
      allowed: true,
      reason: "within_budget",
      action: "call_provider",
      provider,
      capabilities,
      tokenEstimate: cappedEstimate,
      estimatedCostUsd,
      limits: this.limitsFor(effectiveInputLimit, effectiveOutputLimit),
    });
  }

  limitsFor(effectiveInputLimit, effectiveOutputLimit) {
    return {
      maxInputTokens: effectiveInputLimit,
      maxOutputTokens: effectiveOutputLimit,
      maxTotalTokens: this.maxTotalTokens,
      maxEstimatedCostUsd: this.maxEstimatedCostUsd,
    };
  }
}

export class BudgetedModelGateway {
  constructor({
    providers,
    primaryProviderId = null,
    fallbackProviderIds = [],
    capabilityRegistry = null,
    budgetController = new BudgetController(),
    retryPolicy = {},
    runtimeVersion = "core-23",
  } = {}) {
    if (!Array.isArray(providers) || providers.length === 0) {
      throw new ModelGatewayBudgetError(
        "missing_provider",
        "BudgetedModelGateway requires at least one provider.",
      );
    }

    this.providers = new Map();
    for (const provider of providers) {
      if (!provider.id || !provider.adapter?.createResponse) {
        throw new ModelGatewayBudgetError(
          "invalid_provider",
          "Each provider requires id and adapter.createResponse(request).",
        );
      }
      this.providers.set(provider.id, {
        model: "mock-model",
        maxOutputTokens: 512,
        ...provider,
      });
    }

    this.primaryProviderId = primaryProviderId ?? providers[0].id;
    this.fallbackProviderIds = fallbackProviderIds;
    this.budgetController = budgetController;
    this.capabilityRegistry =
      capabilityRegistry ??
      new ProviderCapabilityRegistry({
        entries: providers.map((provider) => ({
          providerId: provider.id,
          model: provider.model,
          ...(provider.capabilities ?? {}),
        })),
      });
    this.retryPolicy = {
      maxRetries: 1,
      retryableProviderCodes: DEFAULT_RETRYABLE_PROVIDER_CODES,
      ...retryPolicy,
    };
    this.runtimeVersion = runtimeVersion;
  }

  async next(runtimeRequest) {
    const trace = [];
    const rejections = [];
    const failures = [];

    for (const providerId of this.providerOrder()) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      const capabilities = this.capabilityRegistry.resolve({
        providerId: provider.id,
        model: provider.model,
      });
      const request = this.normalizeRequest(runtimeRequest, provider, capabilities);
      const budget = this.budgetController.assess({
        provider,
        request,
        capabilities,
      });
      trace.push({
        event: budget.allowed ? "budget.accepted" : "budget.rejected",
        providerId: provider.id,
        model: provider.model,
        reason: budget.reason,
        action: budget.action,
        tokenEstimate: budget.tokenEstimate,
        estimatedCostUsd: budget.estimatedCostUsd,
        limits: budget.limits,
      });

      if (!budget.allowed) {
        rejections.push(budget);
        continue;
      }

      const call = await this.callProvider({
        provider,
        request,
        trace,
      });

      if (call.ok) {
        return {
          ...call.output,
          metadata: {
            ...(call.output.metadata ?? {}),
            provider: {
              providerId: provider.id,
              model: provider.model,
              attempts: call.attempts,
            },
            budgetDecision: budget,
            gatewayTrace: trace,
            capabilityDecision: {
              toolCallsExposed: request.tools.length > 0,
              exposedTools: request.tools.map((tool) => tool.name),
              streamingExposed: capabilities.streaming,
              reasoningExposed: Boolean(request.reasoning),
            },
            boundary: gatewayBoundary(),
          },
        };
      }

      failures.push({
        providerId: provider.id,
        code: call.error.code,
        message: call.error.message,
        retryable: call.retryable,
      });

      if (!call.retryable) {
        throw enrichGatewayError(call.error, trace, rejections, failures);
      }
    }

    if (rejections.length > 0 && failures.length === 0) {
      throw new ModelGatewayBudgetError(
        "budget_exceeded",
        "No provider was called because every candidate exceeded budget.",
        {
          rejections,
          gatewayTrace: trace,
          boundary: gatewayBoundary(),
        },
      );
    }

    throw new ModelGatewayBudgetError(
      "provider_exhausted",
      "All budget-eligible providers failed.",
      {
        rejections,
        failures,
        gatewayTrace: trace,
        boundary: gatewayBoundary(),
      },
    );
  }

  providerOrder() {
    return [
      this.primaryProviderId,
      ...this.fallbackProviderIds.filter((id) => id !== this.primaryProviderId),
    ];
  }

  normalizeRequest(runtimeRequest, provider, capabilities) {
    const tools = this.capabilityRegistry.filterTools(
      runtimeRequest.tools ?? CORE_TOOL_SCHEMAS,
      capabilities,
    );

    return {
      sessionId: runtimeRequest.sessionId ?? "session_core23",
      workspaceRoot: runtimeRequest.workspaceRoot ?? "/workspace/core23",
      turn: runtimeRequest.turn ?? 1,
      model: provider.model,
      providerId: provider.id,
      context: runtimeRequest.context ?? null,
      messages: cloneJson(runtimeRequest.messages ?? []),
      tools,
      toolChoice: tools.length > 0 ? runtimeRequest.toolChoice ?? "auto" : "none",
      reasoning: capabilities.reasoning
        ? runtimeRequest.reasoning ?? provider.reasoning ?? null
        : null,
      maxOutputTokens:
        runtimeRequest.maxOutputTokens ?? provider.maxOutputTokens ?? 512,
      metadata: {
        ...(runtimeRequest.metadata ?? {}),
        runtimeVersion: this.runtimeVersion,
        providerId: provider.id,
        model: provider.model,
        capabilities: {
          toolCalls: capabilities.toolCalls,
          streaming: capabilities.streaming,
          reasoning: capabilities.reasoning,
          supportedTools: capabilities.supportedTools,
        },
      },
    };
  }

  async callProvider({ provider, request, trace }) {
    const maxAttempts = 1 + this.retryPolicy.maxRetries;
    let lastError = null;
    let lastRetryable = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      trace.push({
        event: "provider.attempt",
        providerId: provider.id,
        attempt,
      });

      try {
        const events = [];
        for await (const event of provider.adapter.createResponse(request)) {
          events.push(event);
        }

        const output = collectBudgetedModelOutput(events, request.tools);
        trace.push({
          event: "provider.succeeded",
          providerId: provider.id,
          attempt,
          outputType: output.type,
        });
        return {
          ok: true,
          output,
          attempts: attempt,
        };
      } catch (error) {
        lastError = normalizeGatewayError(error);
        lastRetryable = isRetryableGatewayError(
          lastError,
          this.retryPolicy.retryableProviderCodes,
        );
        trace.push({
          event: "provider.failed",
          providerId: provider.id,
          attempt,
          code: lastError.code,
          providerCode: lastError.details?.providerCode ?? null,
          retryable: lastRetryable,
        });

        if (lastRetryable && attempt < maxAttempts) {
          trace.push({
            event: "retry.scheduled",
            providerId: provider.id,
            nextAttempt: attempt + 1,
          });
          continue;
        }

        return {
          ok: false,
          error: lastError,
          retryable: lastRetryable,
          attempts: attempt,
        };
      }
    }

    return {
      ok: false,
      error: lastError,
      retryable: lastRetryable,
      attempts: maxAttempts,
    };
  }
}

export class ModelGatewayBudgetError extends ModelGatewayError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = "ModelGatewayBudgetError";
  }
}

export function collectBudgetedModelOutput(events, toolSchemas) {
  const text = [];
  const toolCalls = [];
  const usage = [];

  for (const event of events) {
    if (event.type === "failed") {
      throw new ModelGatewayError(
        "model_failed",
        event.error?.message ?? "Model response failed.",
        {
          providerCode: event.error?.code,
          status: event.error?.status,
          retryable: DEFAULT_RETRYABLE_PROVIDER_CODES.has(event.error?.code),
        },
      );
    }

    if (event.type === "output_text_delta") {
      text.push(event.text ?? "");
    }

    if (event.type === "tool_call") {
      toolCalls.push(event.call);
    }

    if (event.type === "usage") {
      usage.push(event.usage);
    }
  }

  if (toolCalls.length >= 1) {
    return {
      type: "tool_call",
      toolCall: validateToolCall(toolCalls[0], toolSchemas),
      metadata: {
        usage,
        droppedToolCalls: toolCalls.slice(1).map((call) => ({
          id: call.id,
          name: call.name,
        })),
      },
    };
  }

  const content = text.join("").trim();
  if (!content) {
    throw new ModelGatewayError(
      "empty_model_output",
      "Model returned no tool call and no final text.",
      { retryable: false },
    );
  }

  const parsed = parseRepairableTextToolCall(content);
  if (parsed.toolCall) {
    return {
      type: "tool_call",
      toolCall: validateToolCall(parsed.toolCall, toolSchemas),
      metadata: {
        usage,
        recoveredFromText: true,
        repair: parsed.repair,
      },
    };
  }

  if (parsed.lookedLikeToolJson) {
    throw new ModelGatewayError(
      "invalid_model_json",
      "Text output looked like tool_call JSON but could not be repaired.",
      {
        retryable: false,
        parseError: parsed.error?.message,
      },
    );
  }

  return {
    type: "final_answer",
    content,
    metadata: { usage },
  };
}

export function estimateModelRequestTokens(request) {
  const messageTokens = estimateTokens(request.messages ?? []);
  const toolTokens = estimateTokens(request.tools ?? []);
  const runtimeTokens = estimateTokens({
    context: request.context,
    metadata: request.metadata,
  });
  const inputTokens = messageTokens + toolTokens + runtimeTokens;
  const cachedInputTokens = Math.min(
    Number(request.context?.cacheReport?.cacheHitTokens ?? 0),
    inputTokens,
  );

  return {
    inputTokens,
    cachedInputTokens,
    uncachedInputTokens: inputTokens - cachedInputTokens,
    outputTokens: request.maxOutputTokens ?? 0,
    totalTokens: inputTokens + (request.maxOutputTokens ?? 0),
    basis: {
      messageTokens,
      toolTokens,
      runtimeTokens,
      estimator: "deterministic_chars_div_4",
    },
  };
}

export function estimateGatewayCostUsd(tokenEstimate, pricingTable) {
  const cost =
    (tokenEstimate.uncachedInputTokens * pricingTable.uncachedInputUsdPer1M) /
      1_000_000 +
    (tokenEstimate.cachedInputTokens * pricingTable.cachedInputUsdPer1M) /
      1_000_000 +
    (tokenEstimate.outputTokens * pricingTable.outputUsdPer1M) / 1_000_000;
  return Number(cost.toFixed(8));
}

export async function runModelGatewayBudgetControllerDemo() {
  const gateway = new BudgetedModelGateway({
    providers: [
      {
        id: "primary",
        model: "core23-budgeted-primary",
        adapter: new MockResponsesAdapter({
          steps: [
            failureEvent("rate_limit", "temporary provider rate limit"),
            toolCallEvents("core23_demo_search", "Search", {
              query: "pageSize + 1",
            }),
          ],
        }),
        capabilities: {
          toolCalls: true,
          streaming: false,
          reasoning: false,
          supportedTools: ["Search", "Read", "Edit", "Bash"],
          maxInputTokens: 1200,
        },
      },
    ],
    budgetController: new BudgetController({
      maxInputTokens: 1200,
      maxTotalTokens: 1600,
      maxEstimatedCostUsd: 0.01,
    }),
    retryPolicy: { maxRetries: 1 },
  });
  const output = await gateway.next(createCore23FixtureRequest());
  const report = {
    checks: verifyModelGatewayBudgetControllerDemo(output),
    output,
    gatewayTrace: output.metadata.gatewayTrace,
    boundary: gatewayBoundary(),
  };

  return report;
}

export function verifyModelGatewayBudgetControllerDemo(output) {
  assert.equal(output.type, "tool_call");
  assert.equal(output.toolCall.name, "Search");
  assert.equal(output.metadata.provider.providerId, "primary");
  assert.equal(output.metadata.provider.attempts, 2);
  assert.equal(output.metadata.budgetDecision.allowed, true);
  assert.equal(
    output.metadata.gatewayTrace.some((event) => event.event === "retry.scheduled"),
    true,
  );
  assert.equal(output.metadata.boundary.productionProviderReliabilityClaim, false);

  return {
    budget_gate_recorded: true,
    retry_trace_recorded: true,
    provider_decision_recorded: true,
    no_production_provider_claim: true,
  };
}

export function createCore23FixtureRequest({
  messages = null,
  context = null,
  tools = CORE_TOOL_SCHEMAS,
  maxOutputTokens = 120,
} = {}) {
  return {
    sessionId: "session_core23_fixture",
    workspaceRoot: "/workspace/core23",
    turn: 1,
    messages:
      messages ??
      [
        {
          role: "system",
          content:
            "You are a local coding agent. Use Search before Read and verify before final.",
        },
        {
          role: "user",
          content: "Fix the pagination off-by-one bug and run the verification.",
        },
      ],
    context:
      context ??
      {
        cacheReport: {
          cacheHitTokens: 24,
        },
      },
    tools,
    maxOutputTokens,
  };
}

export function toolCallEvents(id, name, input) {
  return [
    {
      type: "tool_call",
      call: {
        id,
        name,
        input,
      },
    },
    {
      type: "completed",
      responseId: `mock_response_${id}`,
    },
  ];
}

export function textEvents(text) {
  return [
    {
      type: "output_text_delta",
      text,
    },
    {
      type: "completed",
      responseId: "mock_response_text",
    },
  ];
}

export function failureEvent(code, message, status = null) {
  return {
    type: "failed",
    error: {
      code,
      message,
      status,
    },
  };
}

export function gatewayBoundary() {
  return {
    deterministicLocalEvidence: true,
    productionProviderReliabilityClaim: false,
    realVendorBillingClaim: false,
    fullProductionGatewayClaim: false,
  };
}

function budgetDecision({
  allowed,
  reason,
  action,
  provider,
  capabilities,
  tokenEstimate,
  estimatedCostUsd,
  limits,
}) {
  return {
    allowed,
    reason,
    action,
    providerId: provider.id,
    model: provider.model,
    tokenEstimate,
    estimatedCostUsd,
    limits,
    capabilitySummary: {
      toolCalls: capabilities.toolCalls,
      streaming: capabilities.streaming,
      reasoning: capabilities.reasoning,
      supportedTools: capabilities.supportedTools,
    },
  };
}

function parseRepairableTextToolCall(content) {
  const stripped = stripJsonFence(content);
  const lookedLikeToolJson =
    stripped.startsWith("{") &&
    /tool_call|toolCall|function_call/.test(stripped);

  if (!lookedLikeToolJson) {
    return {
      toolCall: null,
      lookedLikeToolJson: false,
    };
  }

  const first = parseToolCallJson(stripped);
  if (first.ok) {
    return {
      toolCall: first.toolCall,
      lookedLikeToolJson: true,
      repair: {
        applied: false,
        strategy: null,
      },
    };
  }

  const withoutTrailingCommas = stripped.replace(/,\s*([}\]])/g, "$1");
  if (withoutTrailingCommas !== stripped) {
    const repaired = parseToolCallJson(withoutTrailingCommas);
    if (repaired.ok) {
      return {
        toolCall: repaired.toolCall,
        lookedLikeToolJson: true,
        repair: {
          applied: true,
          strategy: "remove_trailing_commas",
          originalError: first.error.message,
        },
      };
    }
  }

  return {
    toolCall: null,
    lookedLikeToolJson: true,
    error: first.error,
  };
}

function parseToolCallJson(content) {
  try {
    const parsed = JSON.parse(content);
    return {
      ok: true,
      toolCall: parsed.tool_call ?? parsed.toolCall ?? parsed.function_call ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
}

function stripJsonFence(content) {
  const match = content.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1].trim() : content.trim();
}

function normalizeCapabilities(entry = {}) {
  return {
    providerId: entry.providerId ?? "provider",
    model: entry.model ?? "*",
    toolCalls: entry.toolCalls ?? true,
    streaming: entry.streaming ?? false,
    reasoning: entry.reasoning ?? true,
    supportedTools: entry.supportedTools ?? null,
    maxInputTokens: entry.maxInputTokens ?? Number.MAX_SAFE_INTEGER,
  };
}

function providerCapabilityKey(providerId, model) {
  return `${providerId}:${model}`;
}

function validatePricingTable(pricingTable) {
  assert.equal(pricingTable.currency, "USD");
  assert.equal(pricingTable.realVendorPriceClaim, false);
  for (const field of [
    "uncachedInputUsdPer1M",
    "cachedInputUsdPer1M",
    "outputUsdPer1M",
  ]) {
    assert.equal(Number.isFinite(pricingTable[field]), true);
    assert.ok(pricingTable[field] >= 0, `${field} must be non-negative`);
  }
}

function isRetryableGatewayError(error, retryableProviderCodes) {
  if (error.details?.retryable === false) return false;
  if (error.details?.retryable === true) return true;
  return retryableProviderCodes.has(error.details?.providerCode) ||
    retryableProviderCodes.has(error.code);
}

function normalizeGatewayError(error) {
  if (error instanceof ModelGatewayError) return error;
  return new ModelGatewayError(
    "adapter_error",
    error.message ?? "Provider adapter failed.",
    {
      retryable: false,
    },
  );
}

function enrichGatewayError(error, trace, rejections, failures) {
  error.details = {
    ...(error.details ?? {}),
    gatewayTrace: trace,
    rejections,
    failures,
    boundary: gatewayBoundary(),
  };
  return error;
}

function estimateTokens(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return Math.max(1, Math.ceil(text.length / 4));
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runModelGatewayBudgetControllerDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
