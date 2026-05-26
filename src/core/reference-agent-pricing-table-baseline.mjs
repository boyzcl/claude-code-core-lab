import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  buildReferenceAgentCostAndCrossAgentReport,
} from "./reference-agent-cost-and-cross-agent.mjs";
import { recordedCodexLocalReferenceRuns } from "./reference-agent-comparison.mjs";

export const CORE17_LOCAL_PRICING_TABLE = Object.freeze({
  id: "local-example-codex-cost-table-2026-05-27",
  currency: "USD",
  providerScope: "local-explicit-example",
  modelScope: "codex-local-recorded-runs",
  source: "local_configured_example_not_vendor_price",
  realVendorPriceClaim: false,
  uncachedInputUsdPer1M: 2,
  cachedInputUsdPer1M: 0.5,
  outputUsdPer1M: 8,
  reasoningOutputTreatment: "separate",
  reasoningOutputUsdPer1M: 8,
});

export function validatePricingTable(pricingTable) {
  assert.ok(pricingTable, "pricing table is required");
  assert.equal(typeof pricingTable.id, "string");
  assert.ok(pricingTable.id.length > 0, "pricing table id is required");
  assert.equal(pricingTable.currency, "USD");
  assert.equal(typeof pricingTable.source, "string");
  assert.ok(pricingTable.source.length > 0, "pricing table source is required");
  assert.equal(
    pricingTable.realVendorPriceClaim,
    false,
    "Core 17 local baseline must not claim real vendor pricing",
  );

  for (const field of [
    "uncachedInputUsdPer1M",
    "cachedInputUsdPer1M",
    "outputUsdPer1M",
  ]) {
    assert.equal(Number.isFinite(pricingTable[field]), true);
    assert.ok(pricingTable[field] >= 0, `${field} must be non-negative`);
  }

  if (pricingTable.reasoningOutputTreatment === "separate") {
    assert.equal(Number.isFinite(pricingTable.reasoningOutputUsdPer1M), true);
    assert.ok(
      pricingTable.reasoningOutputUsdPer1M >= 0,
      "reasoningOutputUsdPer1M must be non-negative",
    );
  }

  return {
    pricing_table_id_present: true,
    currency_usd: true,
    rates_non_negative: true,
    no_real_vendor_price_claim: true,
  };
}

export function buildReferenceAgentPricingTableBaseline({
  runs = recordedCodexLocalReferenceRuns(),
  pricingTable = CORE17_LOCAL_PRICING_TABLE,
} = {}) {
  const pricingValidation = validatePricingTable(pricingTable);
  const pricedReport = buildReferenceAgentCostAndCrossAgentReport({
    runs,
    pricingTable,
  });
  const runEstimates = pricedReport.costBasis.map((basis) => ({
    runId: basis.runId,
    seedId: basis.seedId,
    starterCaseId: basis.starterCaseId,
    agent: basis.agent,
    outcome: basis.outcome,
    latencyMs: basis.latencyMs,
    usage: basis.usage,
    estimatedCostUsd: basis.costMeasurement.estimatedCostUsd,
    costStatus: basis.costMeasurement.status,
    pricingTableId: basis.costMeasurement.pricingTableId,
    rawLogSha256: basis.evidence.rawLogSha256,
  }));
  const estimatedCostUsd = roundUsd(
    runEstimates.reduce((sum, item) => sum + item.estimatedCostUsd, 0),
  );

  return {
    id: "core-17-reference-agent-pricing-table-baseline",
    sourceCostReport: "core-16-reference-agent-cost-and-cross-agent",
    goal:
      "Configure an explicit local pricing table so the existing codex-local cost basis produces stable per-run and total estimated USD without claiming real vendor prices.",
    pricingTable: {
      id: pricingTable.id,
      currency: pricingTable.currency,
      providerScope: pricingTable.providerScope,
      modelScope: pricingTable.modelScope,
      source: pricingTable.source,
      realVendorPriceClaim: pricingTable.realVendorPriceClaim,
      rates: {
        uncachedInputUsdPer1M: pricingTable.uncachedInputUsdPer1M,
        cachedInputUsdPer1M: pricingTable.cachedInputUsdPer1M,
        outputUsdPer1M: pricingTable.outputUsdPer1M,
        reasoningOutputTreatment: pricingTable.reasoningOutputTreatment,
        reasoningOutputUsdPer1M: pricingTable.reasoningOutputUsdPer1M,
      },
    },
    pricingValidation,
    runCount: runEstimates.length,
    runEstimates,
    totals: {
      ...pricedReport.totals,
      estimatedCostUsd,
      averageEstimatedCostUsd: roundUsd(estimatedCostUsd / runEstimates.length),
    },
    costCompleteness: pricedReport.costCompleteness,
    crossAgentReadiness: pricedReport.crossAgentReadiness,
    relativeScore: pricedReport.relativeScore,
    boundary: {
      estimatedUsdIsConfiguredEstimate: true,
      estimatedUsdIsNotVendorBill: true,
      rawRunEvidenceUnchanged: true,
      noRelativeScoreWithoutSecondAgent: true,
    },
  };
}

export function verifyReferenceAgentPricingTableBaseline(report) {
  assert.equal(report.id, "core-17-reference-agent-pricing-table-baseline");
  assert.equal(
    report.sourceCostReport,
    "core-16-reference-agent-cost-and-cross-agent",
  );
  assert.equal(report.runCount, 8);
  assert.equal(report.runEstimates.length, 8);
  assert.equal(report.pricingTable.realVendorPriceClaim, false);
  assert.equal(report.costCompleteness.estimatedUsd, true);
  assert.equal(
    report.costCompleteness.estimatedUsdStatus,
    "estimated_from_configured_pricing_table",
  );
  assert.equal(
    report.runEstimates.every(
      (item) =>
        item.costStatus === "estimated_from_configured_pricing_table" &&
        item.pricingTableId === report.pricingTable.id &&
        item.estimatedCostUsd > 0 &&
        /^[a-f0-9]{64}$/.test(item.rawLogSha256),
    ),
    true,
  );
  assert.equal(report.totals.estimatedCostUsd, 0.609534);
  assert.equal(report.totals.averageEstimatedCostUsd, 0.07619175);
  assert.deepEqual(report.crossAgentReadiness.readyAgents, [
    "codex-local-cli",
  ]);
  assert.equal(report.crossAgentReadiness.status, "single_baseline_only");
  assert.equal(
    report.relativeScore.status,
    "blocked_until_second_agent_runs",
  );
  assert.equal(report.relativeScore.value, null);

  return {
    pricing_table_baseline_estimated: true,
    estimated_cost_usd: report.totals.estimatedCostUsd,
    no_real_vendor_price_claim: true,
    relative_score_still_blocked: true,
  };
}

export function runReferenceAgentPricingTableBaselineDemo() {
  const report = buildReferenceAgentPricingTableBaseline();
  return {
    checks: verifyReferenceAgentPricingTableBaseline(report),
    ...report,
  };
}

function roundUsd(value) {
  return Number(value.toFixed(8));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(
    JSON.stringify(runReferenceAgentPricingTableBaselineDemo(), null, 2),
  );
}
