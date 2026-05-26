import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { recordedCodexLocalReferenceRuns } from "./reference-agent-comparison.mjs";

export const CORE16_CANDIDATE_AGENTS = [
  {
    kind: "codex-local-cli",
    command: "codex",
    detectedPath: "/Users/boyzcl/.nvm/versions/node/v22.19.0/bin/codex",
    nonInteractiveCommand: "codex -a never exec",
    status: "ready_with_recorded_runs",
  },
  {
    kind: "claude-code-cli",
    command: "claude-code",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
  {
    kind: "claude-cli",
    command: "claude",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
  {
    kind: "opencode-cli",
    command: "opencode",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
  {
    kind: "aider-cli",
    command: "aider",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
  {
    kind: "cursor-agent-cli",
    command: "cursor-agent",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
  {
    kind: "gemini-cli",
    command: "gemini",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
  {
    kind: "qwen-cli",
    command: "qwen",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
  {
    kind: "openai-cli",
    command: "openai",
    detectedPath: null,
    nonInteractiveCommand: null,
    status: "not_installed",
  },
];

export function buildCostBasis(run) {
  const inputTokens = run.usage.inputTokens;
  const cachedInputTokens = run.usage.cachedInputTokens;
  const uncachedInputTokens = Math.max(inputTokens - cachedInputTokens, 0);
  const outputTokens = run.usage.outputTokens;
  const reasoningOutputTokens = run.usage.reasoningOutputTokens;

  return {
    runId: run.runId,
    seedId: run.seedId,
    starterCaseId: run.starterCaseId,
    agent: run.agent.kind,
    outcome: {
      score: run.score,
      failureType: run.failureType,
      verificationStatus: run.verificationStatus,
    },
    latencyMs: run.latencyMs,
    usage: {
      inputTokens,
      cachedInputTokens,
      uncachedInputTokens,
      outputTokens,
      reasoningOutputTokens,
      visibleTotalTokens: inputTokens + outputTokens,
    },
    costMeasurement: {
      status: "pricing_table_not_configured",
      estimatedCostUsd: null,
      pricingInputsAvailable: true,
      pricingInputs: [
        "uncachedInputTokens",
        "cachedInputTokens",
        "outputTokens",
        "reasoningOutputTokens",
      ],
      reasoningOutputTreatment: "tracked_separately_not_priced",
      note:
        "Codex CLI JSON reports token usage but not a model price table; USD cost remains null until pricing is configured.",
    },
    evidence: {
      rawLogSha256: run.evidence.rawLogSha256,
    },
  };
}

export function estimateCostUsd(costBasis, pricingTable = null) {
  if (!pricingTable) {
    return {
      status: "pricing_table_not_configured",
      estimatedCostUsd: null,
    };
  }

  const usage = costBasis.usage;
  const reasoningCost =
    pricingTable.reasoningOutputTreatment === "separate"
      ? (usage.reasoningOutputTokens *
          pricingTable.reasoningOutputUsdPer1M) /
        1_000_000
      : 0;
  const estimatedCostUsd =
    (usage.uncachedInputTokens * pricingTable.uncachedInputUsdPer1M) /
      1_000_000 +
    (usage.cachedInputTokens * pricingTable.cachedInputUsdPer1M) / 1_000_000 +
    (usage.outputTokens * pricingTable.outputUsdPer1M) / 1_000_000 +
    reasoningCost;

  return {
    status: "estimated_from_configured_pricing_table",
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
    pricingTableId: pricingTable.id,
    reasoningOutputTreatment:
      pricingTable.reasoningOutputTreatment ?? "included_or_not_separately_priced",
  };
}

export function buildReferenceAgentCostAndCrossAgentReport({
  runs = recordedCodexLocalReferenceRuns(),
  pricingTable = null,
  candidateAgents = CORE16_CANDIDATE_AGENTS,
} = {}) {
  const costBasis = runs.map((run) => {
    const basis = buildCostBasis(run);
    const pricing = estimateCostUsd(basis, pricingTable);
    return {
      ...basis,
      costMeasurement: {
        ...basis.costMeasurement,
        ...pricing,
      },
    };
  });
  const totals = sumCostBasis(costBasis);
  const readyAgents = candidateAgents.filter(
    (agent) => agent.status === "ready_with_recorded_runs",
  );
  const secondBaselineCandidates = candidateAgents.filter(
    (agent) => agent.kind !== "codex-local-cli" && agent.detectedPath,
  );

  return {
    id: "core-16-reference-agent-cost-and-cross-agent",
    sourceComparison: "core-15-reference-agent-comparison",
    costSchema: {
      version: "core16-cost-v1",
      formula:
        "USD cost = uncachedInputTokens * uncachedInputUsdPer1M / 1e6 + cachedInputTokens * cachedInputUsdPer1M / 1e6 + outputTokens * outputUsdPer1M / 1e6; reasoning output is tracked separately unless pricingTable.reasoningOutputTreatment is separate.",
      pricingTableConfigured: Boolean(pricingTable),
    },
    runCount: runs.length,
    costBasis,
    totals,
    costCompleteness: {
      latencyMs: true,
      tokenUsage: true,
      rawLogHashes: true,
      estimatedUsd: Boolean(pricingTable),
      estimatedUsdStatus: pricingTable
        ? "estimated_from_configured_pricing_table"
        : "blocked_until_pricing_table_configured",
    },
    crossAgentReadiness: {
      status:
        readyAgents.length >= 2
          ? "ready_for_horizontal_comparison"
          : "single_baseline_only",
      readyAgents: readyAgents.map((agent) => agent.kind),
      candidates: candidateAgents,
      secondBaselineCandidates: secondBaselineCandidates.map(
        (agent) => agent.kind,
      ),
      nextGate:
        "Install or configure a second non-interactive coding agent, run the same seed sample, then compare score, failureType, latencyMs, token/cost basis, and notes.",
    },
    relativeScore: {
      status: "blocked_until_second_agent_runs",
      value: null,
      reason:
        "Only codex-local-cli has recorded runs; there is no second agent baseline to divide against.",
    },
    expectedOutcomeAfterNextPass: {
      withCostOnly:
        "A cost-aware codex-local baseline with token and optional USD estimates for each seed.",
      withSecondAgent:
        "A horizontal comparison table across agents for the same seeds, including pass rate, failure types, latency, cost basis, and safety outcomes.",
      stillOutOfScope:
        "Production 70%-80% capability claims and cross-agent RelativeScore remain blocked until real second-agent runs exist.",
    },
  };
}

export function verifyReferenceAgentCostAndCrossAgentReport(report) {
  assert.equal(report.id, "core-16-reference-agent-cost-and-cross-agent");
  assert.equal(report.sourceComparison, "core-15-reference-agent-comparison");
  assert.equal(report.runCount, 8);
  assert.equal(report.costBasis.length, 8);
  assert.equal(report.costSchema.version, "core16-cost-v1");
  assert.equal(report.costSchema.pricingTableConfigured, false);
  assert.equal(report.costCompleteness.latencyMs, true);
  assert.equal(report.costCompleteness.tokenUsage, true);
  assert.equal(report.costCompleteness.rawLogHashes, true);
  assert.equal(report.costCompleteness.estimatedUsd, false);
  assert.equal(
    report.costCompleteness.estimatedUsdStatus,
    "blocked_until_pricing_table_configured",
  );
  assert.ok(report.totals.inputTokens > 0);
  assert.ok(report.totals.cachedInputTokens > 0);
  assert.ok(report.totals.uncachedInputTokens > 0);
  assert.ok(report.totals.outputTokens > 0);
  assert.ok(report.totals.latencyMs > 0);
  assert.equal(
    report.costBasis.every(
      (basis) =>
        basis.costMeasurement.status === "pricing_table_not_configured" &&
        basis.costMeasurement.estimatedCostUsd === null,
    ),
    true,
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
    cost_basis_defined_for_all_runs: true,
    usd_cost_blocked_without_pricing_table: true,
    single_baseline_only: true,
    relative_score_blocked: true,
  };
}

export function runReferenceAgentCostAndCrossAgentDemo() {
  const report = buildReferenceAgentCostAndCrossAgentReport();
  return {
    checks: verifyReferenceAgentCostAndCrossAgentReport(report),
    ...report,
  };
}

function sumCostBasis(costBasis) {
  return costBasis.reduce(
    (acc, item) => {
      acc.inputTokens += item.usage.inputTokens;
      acc.cachedInputTokens += item.usage.cachedInputTokens;
      acc.uncachedInputTokens += item.usage.uncachedInputTokens;
      acc.outputTokens += item.usage.outputTokens;
      acc.reasoningOutputTokens += item.usage.reasoningOutputTokens;
      acc.visibleTotalTokens += item.usage.visibleTotalTokens;
      acc.latencyMs += item.latencyMs;
      return acc;
    },
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      uncachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      visibleTotalTokens: 0,
      latencyMs: 0,
    },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(runReferenceAgentCostAndCrossAgentDemo(), null, 2));
}
