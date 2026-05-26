import assert from "node:assert/strict";
import {
  CORE17_LOCAL_PRICING_TABLE,
  buildReferenceAgentPricingTableBaseline,
  validatePricingTable,
  verifyReferenceAgentPricingTableBaseline,
} from "./reference-agent-pricing-table-baseline.mjs";

const cases = [];
const report = buildReferenceAgentPricingTableBaseline();

await record("core17: pricing table baseline runs and verifies", () => {
  return verifyReferenceAgentPricingTableBaseline(report);
});

await record("pricing table contract: local table is explicit and bounded", () => {
  const checks = validatePricingTable(CORE17_LOCAL_PRICING_TABLE);

  assert.equal(CORE17_LOCAL_PRICING_TABLE.currency, "USD");
  assert.equal(CORE17_LOCAL_PRICING_TABLE.realVendorPriceClaim, false);
  assert.equal(
    CORE17_LOCAL_PRICING_TABLE.source,
    "local_configured_example_not_vendor_price",
  );

  return checks;
});

await record("per-run estimates: all 8 codex-local runs have configured USD estimates", () => {
  assert.equal(report.runEstimates.length, 8);
  assert.equal(
    report.runEstimates.every(
      (item) =>
        item.costStatus === "estimated_from_configured_pricing_table" &&
        item.estimatedCostUsd > 0,
    ),
    true,
  );

  assert.deepEqual(
    report.runEstimates.map((item) => item.estimatedCostUsd),
    [
      0.078556,
      0.131522,
      0.030142,
      0.044632,
      0.059356,
      0.036888,
      0.087186,
      0.141252,
    ],
  );

  return {
    priced_run_count: report.runEstimates.length,
    first_run_estimated_cost_usd: report.runEstimates[0].estimatedCostUsd,
  };
});

await record("totals: configured estimate sums are stable", () => {
  assert.equal(report.totals.inputTokens, 660067);
  assert.equal(report.totals.cachedInputTokens, 523904);
  assert.equal(report.totals.uncachedInputTokens, 136163);
  assert.equal(report.totals.outputTokens, 7233);
  assert.equal(report.totals.reasoningOutputTokens, 2174);
  assert.equal(report.totals.visibleTotalTokens, 667300);
  assert.equal(report.totals.latencyMs, 362003);
  assert.equal(report.totals.estimatedCostUsd, 0.609534);
  assert.equal(report.totals.averageEstimatedCostUsd, 0.07619175);

  return {
    estimated_cost_usd: report.totals.estimatedCostUsd,
    average_estimated_cost_usd: report.totals.averageEstimatedCostUsd,
  };
});

await record("evidence boundary: pricing does not rewrite raw run hashes", () => {
  assert.equal(
    report.runEstimates.every((item) =>
      /^[a-f0-9]{64}$/.test(item.rawLogSha256),
    ),
    true,
  );
  assert.equal(report.boundary.rawRunEvidenceUnchanged, true);
  assert.equal(report.boundary.estimatedUsdIsNotVendorBill, true);

  return {
    raw_hashes_preserved: true,
    estimated_usd_is_not_vendor_bill: true,
  };
});

await record("relative score boundary: pricing table does not create a second baseline", () => {
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
    single_baseline_only: true,
    relative_score_blocked: true,
  };
});

await record("pricing validation: invalid local table is rejected", () => {
  assert.throws(
    () =>
      validatePricingTable({
        ...CORE17_LOCAL_PRICING_TABLE,
        realVendorPriceClaim: true,
      }),
    /must not claim real vendor pricing/,
  );
  assert.throws(
    () =>
      validatePricingTable({
        ...CORE17_LOCAL_PRICING_TABLE,
        uncachedInputUsdPer1M: -1,
      }),
    /must be non-negative/,
  );

  return {
    vendor_price_claim_rejected: true,
    negative_rate_rejected: true,
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
