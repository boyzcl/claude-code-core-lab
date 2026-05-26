import assert from "node:assert/strict";
import {
  CORE16_CANDIDATE_AGENTS,
  buildReferenceAgentCostAndCrossAgentReport,
  estimateCostUsd,
  verifyReferenceAgentCostAndCrossAgentReport,
} from "./reference-agent-cost-and-cross-agent.mjs";

const cases = [];
const report = buildReferenceAgentCostAndCrossAgentReport();

await record("core16: cost and cross-agent report runs and verifies", () => {
  return verifyReferenceAgentCostAndCrossAgentReport(report);
});

await record("cost basis: every recorded run has token, latency, outcome, and hash evidence", () => {
  assert.equal(report.runCount, 8);
  assert.equal(report.costBasis.length, 8);

  for (const basis of report.costBasis) {
    assert.equal(basis.agent, "codex-local-cli");
    assert.equal(typeof basis.latencyMs, "number");
    assert.ok(basis.latencyMs > 0);
    assert.equal(basis.outcome.score, 1);
    assert.equal(basis.outcome.failureType, null);
    assert.match(basis.evidence.rawLogSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      basis.usage.uncachedInputTokens,
      basis.usage.inputTokens - basis.usage.cachedInputTokens,
    );
    assert.equal(
      basis.usage.visibleTotalTokens,
      basis.usage.inputTokens + basis.usage.outputTokens,
    );
    assert.equal(
      basis.costMeasurement.pricingInputs.includes("uncachedInputTokens"),
      true,
    );
  }

  return {
    cost_basis_count: report.costBasis.length,
    outcome_and_hash_evidence_present: true,
  };
});

await record("totals: token and latency sums are stable for the 8-run codex-local sample", () => {
  assert.deepEqual(report.totals, {
    inputTokens: 660067,
    cachedInputTokens: 523904,
    uncachedInputTokens: 136163,
    outputTokens: 7233,
    reasoningOutputTokens: 2174,
    visibleTotalTokens: 667300,
    latencyMs: 362003,
  });

  return {
    input_tokens: report.totals.inputTokens,
    cached_input_tokens: report.totals.cachedInputTokens,
    uncached_input_tokens: report.totals.uncachedInputTokens,
    output_tokens: report.totals.outputTokens,
    latency_ms: report.totals.latencyMs,
  };
});

await record("pricing boundary: USD remains null without a configured price table", () => {
  assert.equal(report.costSchema.pricingTableConfigured, false);
  assert.equal(report.costCompleteness.estimatedUsd, false);
  assert.equal(
    report.costCompleteness.estimatedUsdStatus,
    "blocked_until_pricing_table_configured",
  );
  assert.equal(
    report.costBasis.every(
      (basis) =>
        basis.costMeasurement.status === "pricing_table_not_configured" &&
        basis.costMeasurement.estimatedCostUsd === null,
    ),
    true,
  );

  return {
    estimated_usd: null,
    status: report.costCompleteness.estimatedUsdStatus,
  };
});

await record("pricing option: configured pricing table can estimate a run without changing raw evidence", () => {
  const pricingTable = {
    id: "test-pricing-table",
    uncachedInputUsdPer1M: 2,
    cachedInputUsdPer1M: 0.5,
    outputUsdPer1M: 8,
    reasoningOutputTreatment: "separate",
    reasoningOutputUsdPer1M: 8,
  };
  const pricedReport = buildReferenceAgentCostAndCrossAgentReport({
    pricingTable,
  });
  const firstPriced = pricedReport.costBasis[0].costMeasurement;
  const directEstimate = estimateCostUsd(report.costBasis[0], pricingTable);

  assert.equal(pricedReport.costSchema.pricingTableConfigured, true);
  assert.equal(pricedReport.costCompleteness.estimatedUsd, true);
  assert.equal(firstPriced.status, "estimated_from_configured_pricing_table");
  assert.equal(firstPriced.pricingTableId, "test-pricing-table");
  assert.equal(firstPriced.estimatedCostUsd, directEstimate.estimatedCostUsd);
  assert.ok(firstPriced.estimatedCostUsd > 0);
  assert.equal(
    pricedReport.costBasis[0].evidence.rawLogSha256,
    report.costBasis[0].evidence.rawLogSha256,
  );

  return {
    pricing_table_id: firstPriced.pricingTableId,
    first_run_estimated_cost_usd: firstPriced.estimatedCostUsd,
    evidence_hash_preserved: true,
  };
});

await record("cross-agent gate: only codex-local has recorded runs on this machine snapshot", () => {
  assert.equal(
    CORE16_CANDIDATE_AGENTS.filter(
      (agent) => agent.status === "ready_with_recorded_runs",
    ).length,
    1,
  );
  assert.equal(report.crossAgentReadiness.status, "single_baseline_only");
  assert.deepEqual(report.crossAgentReadiness.readyAgents, [
    "codex-local-cli",
  ]);
  assert.deepEqual(report.crossAgentReadiness.secondBaselineCandidates, []);
  assert.equal(
    report.relativeScore.status,
    "blocked_until_second_agent_runs",
  );
  assert.equal(report.relativeScore.value, null);

  return {
    ready_agents: report.crossAgentReadiness.readyAgents,
    relative_score_blocked: true,
  };
});

await record("cross-agent option: a second agent needs recorded runs before RelativeScore can exist", () => {
  const candidateAgents = [
    ...CORE16_CANDIDATE_AGENTS,
    {
      kind: "example-second-agent",
      command: "example-agent",
      detectedPath: "/usr/local/bin/example-agent",
      nonInteractiveCommand: "example-agent run",
      status: "detected_no_recorded_runs",
    },
  ];
  const detectedButUnrunReport = buildReferenceAgentCostAndCrossAgentReport({
    candidateAgents,
  });

  assert.equal(
    detectedButUnrunReport.crossAgentReadiness.status,
    "single_baseline_only",
  );
  assert.deepEqual(detectedButUnrunReport.crossAgentReadiness.readyAgents, [
    "codex-local-cli",
  ]);
  assert.deepEqual(
    detectedButUnrunReport.crossAgentReadiness.secondBaselineCandidates,
    ["example-second-agent"],
  );
  assert.equal(
    detectedButUnrunReport.relativeScore.status,
    "blocked_until_second_agent_runs",
  );

  return {
    detected_second_candidate_without_runs: true,
    relative_score_still_blocked: true,
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
