import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const CORE27_SETTINGS_PERMISSION_RESOLVER_VERSION =
  "core27-settings-permission-resolver-v1";

export const PERMISSION_SOURCE_PRECEDENCE = [
  "policy",
  "local",
  "project",
  "user",
];

const DECISIONS = new Set(["allow", "ask", "deny"]);

export class SettingsPermissionResolver {
  constructor({
    permissionConfig = createPermissionConfigFixture(),
    defaultDecision = "ask",
  } = {}) {
    if (!DECISIONS.has(defaultDecision)) {
      throw new PermissionResolverError(
        "invalid_default_decision",
        `Unsupported default decision: ${defaultDecision}`,
      );
    }

    this.permissionConfig = normalizePermissionConfig(permissionConfig);
    this.defaultDecision = defaultDecision;
    this.configHash = shortHash(stableStringify(this.permissionConfig));
    this.decisionCache = new Map();
    this.resolverTrace = [];
  }

  resolve(action, { useCache = true } = {}) {
    const normalizedAction = normalizeAction(action);
    const cacheKey = buildCacheKey(normalizedAction, this.configHash);

    if (useCache && this.decisionCache.has(cacheKey)) {
      const cached = cloneJson(this.decisionCache.get(cacheKey));
      const result = {
        ...cached,
        fromCache: true,
      };
      this.record("permission.cache_hit", {
        actionId: normalizedAction.id,
        decision: result.decision,
        cacheKey,
      });
      return result;
    }

    const result = this.evaluate(normalizedAction, cacheKey);
    this.decisionCache.set(cacheKey, cloneJson(result));
    this.record("permission.resolved", {
      actionId: normalizedAction.id,
      decision: result.decision,
      ruleSource: result.ruleSource,
      cacheKey,
    });
    return cloneJson(result);
  }

  evaluate(action, cacheKey) {
    const trace = [];
    const matches = [];

    for (const source of PERMISSION_SOURCE_PRECEDENCE) {
      const layer = this.permissionConfig[source];
      for (const rule of layer.rules) {
        const match = ruleMatchesAction(rule, action);
        const traceEntry = {
          source,
          sourceRank: PERMISSION_SOURCE_PRECEDENCE.indexOf(source),
          ruleId: rule.id,
          decision: rule.decision,
          matched: match.matched,
          matchReason: match.reason,
          match: rule.match,
          description: rule.description,
        };
        trace.push(traceEntry);

        if (match.matched) {
          matches.push({
            ...traceEntry,
            rule,
          });
        }
      }
    }

    const winner = matches[0] ?? null;
    const decision = winner?.decision ?? this.defaultDecision;
    const reason = winner
      ? `${winner.source}:${winner.ruleId} matched before lower-precedence rules.`
      : `No rule matched; using default ${this.defaultDecision}.`;

    return {
      version: CORE27_SETTINGS_PERMISSION_RESOLVER_VERSION,
      status: "resolved",
      actionId: action.id,
      tool: action.tool,
      decision,
      allowed: decision === "allow",
      requiresApproval: decision === "ask",
      denied: decision === "deny",
      ruleSource: winner?.source ?? "default",
      matchedRule: winner ? publicRule(winner.rule) : null,
      shadowedMatches: matches.slice(1).map((entry) => ({
        source: entry.source,
        ruleId: entry.ruleId,
        decision: entry.decision,
        matchReason: entry.matchReason,
      })),
      trace: trace.map((entry) => ({
        source: entry.source,
        sourceRank: entry.sourceRank,
        ruleId: entry.ruleId,
        decision: entry.decision,
        matched: entry.matched,
        matchReason: entry.matchReason,
        match: entry.match,
        description: entry.description,
      })),
      precedence: [...PERMISSION_SOURCE_PRECEDENCE],
      cacheKey,
      configHash: this.configHash,
      fromCache: false,
      reason,
    };
  }

  getResolverTrace() {
    return cloneJson(this.resolverTrace);
  }

  record(event, payload = {}) {
    this.resolverTrace.push({
      seq: this.resolverTrace.length + 1,
      event,
      ...cloneJson(payload),
    });
  }
}

export class PermissionedActionHarness {
  constructor({ resolver = new SettingsPermissionResolver() } = {}) {
    this.resolver = resolver;
    this.providerCalls = 0;
    this.toolExecutions = [];
    this.approvalRequests = [];
    this.denials = [];
    this.trace = [];
    this.approvalSeq = 0;
  }

  requestAction(action) {
    const before = this.counters();
    const resolution = this.resolver.resolve(action);
    this.record("permission.resolved", {
      actionId: resolution.actionId,
      decision: resolution.decision,
      ruleSource: resolution.ruleSource,
    });

    if (resolution.decision === "allow") {
      return this.executeAction(action, resolution, before);
    }

    if (resolution.decision === "ask") {
      const approval = {
        id: `approval_bridge_${String(++this.approvalSeq).padStart(3, "0")}`,
        status: "approval_required",
        action: cloneJson(action),
        permissionDecision: resolution,
        targetProtocol: "core26-human-approval-interruption-protocol",
      };
      this.approvalRequests.push(approval);
      this.record("approval.required.bridge", {
        actionId: resolution.actionId,
        approvalId: approval.id,
        targetProtocol: approval.targetProtocol,
      });

      return {
        status: "approval_required",
        approval,
        resolution,
        counters: counterReport(before, this.counters()),
      };
    }

    const denial = {
      status: "denied",
      action: cloneJson(action),
      permissionDecision: resolution,
      error: {
        error_type: "permission_denied",
        message: `Permission resolver denied ${resolution.actionId}.`,
        recommended_next_event: null,
      },
    };
    this.denials.push(denial);
    this.record("permission.denied", {
      actionId: resolution.actionId,
      ruleSource: resolution.ruleSource,
    });

    return {
      status: "denied",
      denial,
      resolution,
      counters: counterReport(before, this.counters()),
    };
  }

  executeAction(action, resolution, before = this.counters()) {
    const execution = {
      id: action.id,
      tool: action.tool,
      status: "executed",
      permissionDecision: {
        decision: resolution.decision,
        ruleSource: resolution.ruleSource,
        matchedRule: resolution.matchedRule,
      },
    };
    this.toolExecutions.push(execution);
    this.record("tool.executed", {
      actionId: action.id,
      tool: action.tool,
      permissionDecision: resolution.decision,
    });

    return {
      status: "executed",
      execution,
      resolution,
      counters: counterReport(before, this.counters()),
    };
  }

  counters() {
    return {
      providerCalls: this.providerCalls,
      toolExecutions: this.toolExecutions.length,
      approvalRequests: this.approvalRequests.length,
      denials: this.denials.length,
    };
  }

  record(event, payload = {}) {
    this.trace.push({
      seq: this.trace.length + 1,
      event,
      ...cloneJson(payload),
    });
  }
}

export class PermissionResolverError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PermissionResolverError";
    this.code = code;
    this.details = details;
  }
}

export function createPermissionConfigFixture() {
  return {
    user: {
      rules: [
        {
          id: "user_allow_git",
          tool: "Bash",
          decision: "allow",
          match: { commandPrefix: "git" },
          description: "User preference allows ordinary git commands.",
        },
        {
          id: "user_ask_node",
          tool: "Bash",
          decision: "ask",
          match: { commandPrefix: "node" },
          description: "User wants review before node commands by default.",
        },
      ],
    },
    project: {
      rules: [
        {
          id: "project_ask_git_push",
          tool: "Bash",
          decision: "ask",
          match: { commandPrefix: "git push" },
          description: "Project requires review before remote pushes.",
        },
        {
          id: "project_ask_public_api_edit",
          tool: "Edit",
          decision: "ask",
          match: { pathExact: "src/public-api.cjs" },
          description: "Project public API edits need review.",
        },
      ],
    },
    local: {
      rules: [
        {
          id: "local_allow_test_runner",
          tool: "Bash",
          decision: "allow",
          match: { commandPrefix: "node scripts/test.cjs" },
          description: "Local trusted test runner can execute directly.",
        },
        {
          id: "local_allow_npm_test",
          tool: "Bash",
          decision: "allow",
          match: { commandPrefix: "npm test" },
          description: "Local npm test command can execute directly.",
        },
      ],
    },
    policy: {
      rules: [
        {
          id: "policy_deny_rm_rf",
          tool: "Bash",
          decision: "deny",
          match: { commandPrefix: "rm -rf" },
          description: "Destructive deletion is denied by policy.",
        },
        {
          id: "policy_deny_main_push",
          tool: "Bash",
          decision: "deny",
          match: { commandPrefix: "git push origin main" },
          description: "Pushing directly to main is denied by policy.",
        },
      ],
    },
  };
}

export function createActionFixtures() {
  return {
    allowTest: {
      id: "run_tests",
      tool: "Bash",
      command: "node scripts/test.cjs --ci",
      reason: "Verify the fixture.",
    },
    askPush: {
      id: "push_feature",
      tool: "Bash",
      command: "git push origin feature",
      reason: "Publish local branch.",
    },
    denyRemove: {
      id: "remove_workspace",
      tool: "Bash",
      command: "rm -rf .",
      reason: "Dangerous cleanup request.",
    },
    precedencePushMain: {
      id: "push_main",
      tool: "Bash",
      command: "git push origin main",
      reason: "Direct push to protected branch.",
    },
    protectedEdit: {
      id: "edit_public_api",
      tool: "Edit",
      path: "src/public-api.cjs",
      reason: "Patch public API guard.",
    },
  };
}

export function createPrefixOnlyResolver() {
  return new SettingsPermissionResolver({
    permissionConfig: {
      policy: {
        rules: [
          {
            id: "policy_allow_npm_test_prefix",
            tool: "Bash",
            decision: "allow",
            match: { commandPrefix: "npm test" },
            description: "Only npm test and explicit arguments are allowed.",
          },
        ],
      },
    },
  });
}

export async function runSettingsPermissionResolverDemo() {
  const resolver = new SettingsPermissionResolver();
  const harness = new PermissionedActionHarness({ resolver });
  const actions = createActionFixtures();

  const precedence = resolver.resolve(actions.precedencePushMain);
  const allowResult = harness.requestAction(actions.allowTest);
  const askResult = harness.requestAction(actions.askPush);
  const denyResult = harness.requestAction(actions.denyRemove);

  const prefixResolver = createPrefixOnlyResolver();
  const prefixAllowed = prefixResolver.resolve({
    id: "npm_test_with_args",
    tool: "Bash",
    command: "npm test -- --runInBand",
  });
  const prefixRejected = prefixResolver.resolve({
    id: "npm_testing_similar",
    tool: "Bash",
    command: "npm testing --fast",
  });

  const firstCache = resolver.resolve(actions.protectedEdit);
  const secondCache = resolver.resolve(actions.protectedEdit);

  const report = {
    version: CORE27_SETTINGS_PERMISSION_RESOLVER_VERSION,
    status: "passed",
    validationMatrix: core27ImplementationValidationMatrix(),
    precedence,
    allowResult,
    askResult,
    denyResult,
    prefixAllowed,
    prefixRejected,
    cache: {
      first: firstCache,
      second: secondCache,
      cacheSize: resolver.decisionCache.size,
      resolverTrace: resolver.getResolverTrace(),
    },
    noHiddenExecution: assertNoHiddenPermissionExecution(harness.trace),
    harnessTrace: cloneJson(harness.trace),
    boundary: settingsPermissionResolverBoundary(),
  };

  return {
    checks: verifySettingsPermissionResolverDemo(report),
    ...report,
  };
}

export function verifySettingsPermissionResolverDemo(report) {
  assert.equal(report.version, CORE27_SETTINGS_PERMISSION_RESOLVER_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(
    report.validationMatrix.cases.some((item) => item.case === "config precedence"),
    true,
  );
  assert.equal(report.precedence.decision, "deny");
  assert.equal(report.precedence.ruleSource, "policy");
  assert.equal(report.allowResult.status, "executed");
  assert.equal(report.askResult.status, "approval_required");
  assert.equal(report.denyResult.status, "denied");
  assert.equal(report.prefixAllowed.decision, "allow");
  assert.notEqual(report.prefixRejected.decision, "allow");
  assert.equal(report.cache.second.fromCache, true);
  assert.equal(report.noHiddenExecution.valid, true);
  assert.equal(report.boundary.productionClaudeCodeClaim, false);
  assert.equal(report.boundary.enterprisePolicyClaim, false);
  assert.equal(report.boundary.core22TransactionClaim, false);
  assert.equal(report.boundary.core26ApprovalDecisionClaim, false);

  return {
    validation_matrix_present: true,
    precedence_resolved_before_tool_runtime: true,
    allow_ask_deny_resolved: true,
    prefix_rule_does_not_match_similar_command: true,
    decision_cache_recorded: true,
    no_hidden_execution_asserted: true,
    no_production_claim: true,
  };
}

export function assertNoHiddenPermissionExecution(trace) {
  const allowedActionIds = new Set();
  const executedActionIds = [];

  for (const event of trace) {
    if (event.event === "permission.resolved" && event.decision === "allow") {
      allowedActionIds.add(event.actionId);
    }

    if (event.event === "tool.executed") {
      executedActionIds.push(event.actionId);
      if (!allowedActionIds.has(event.actionId)) {
        throw new PermissionResolverError(
          "hidden_execution_detected",
          `Tool executed before allow decision: ${event.actionId}`,
          { event },
        );
      }
    }
  }

  return {
    valid: true,
    allowedActionIds: [...allowedActionIds],
    executedActionIds,
  };
}

export function core27ImplementationValidationMatrix() {
  return {
    topic: "Settings / Permission Resolver",
    evidenceTier: "A public docs as interface clues, B product artifact observations as mechanism clues, D local implementation and verify evidence.",
    publicBoundary: {
      rawPromptOrSourceMapText: false,
      officialImplementationClaim: false,
      ownObjectModel: true,
    },
    sameTopicMergeDecision: {
      extends: ["Core 22 ToolRuntime Transaction", "Core 26 Human Approval"],
      independentBecause:
        "Core 27 resolves layered settings into allow/ask/deny before transaction preview or human approval events.",
      notCore22:
        "It does not preview, commit, rollback, or write files.",
      notCore26:
        "It does not approve, reject, interrupt, or execute approval decisions.",
    },
    runtimeState: [
      "permissionConfig",
      "resolverTrace",
      "ruleSource",
      "decisionCache",
    ],
    cases: [
      {
        case: "config precedence",
        fixture: "user/project/local/policy layered rules",
        expected: "policy > local > project > user is stable and explainable",
        evidence: "resolver report with trace and shadowedMatches",
      },
      {
        case: "allow ask deny",
        fixture: "Bash actions that hit local allow, project ask, and policy deny",
        expected: "allow executes, ask bridges to Core 26 approval, deny refuses",
        evidence: "permission trace and harness counters",
      },
      {
        case: "prefix command rule",
        fixture: "npm test prefix and similar npm testing command",
        expected: "explicit prefix matches only command plus arguments",
        evidence: "command decision",
      },
      {
        case: "no hidden execution",
        fixture: "ask and deny actions before approval",
        expected: "provider and tool execution deltas remain zero",
        evidence: "trace assertion",
      },
    ],
    outOfScope: [
      "complete enterprise policy product",
      "GUI permission prompt",
      "official Claude Code permission implementation",
      "shell parser or sandbox",
    ],
  };
}

export function settingsPermissionResolverBoundary() {
  return {
    deterministicLocalPermissionResolver: true,
    preToolExecutionDecision: true,
    configPrecedenceEvidence: true,
    core22TransactionClaim: false,
    core26ApprovalDecisionClaim: false,
    productionClaudeCodeClaim: false,
    officialImplementationClaim: false,
    enterprisePolicyClaim: false,
    guiPermissionProductClaim: false,
  };
}

function normalizePermissionConfig(permissionConfig) {
  const normalized = {};

  for (const source of PERMISSION_SOURCE_PRECEDENCE) {
    const layer = permissionConfig[source] ?? {};
    normalized[source] = {
      source,
      rules: (layer.rules ?? []).map((rule, index) =>
        normalizeRule(rule, source, index),
      ),
    };
  }

  return normalized;
}

function normalizeRule(rule, source, index) {
  if (!rule || typeof rule !== "object") {
    throw new PermissionResolverError(
      "invalid_rule",
      `Invalid rule at ${source}[${index}].`,
    );
  }

  if (!DECISIONS.has(rule.decision)) {
    throw new PermissionResolverError(
      "invalid_rule_decision",
      `Unsupported decision for ${source}:${rule.id ?? index}.`,
    );
  }

  return {
    id: rule.id ?? `${source}_rule_${index + 1}`,
    source,
    order: index,
    tool: rule.tool ?? "*",
    decision: rule.decision,
    match: cloneJson(rule.match ?? {}),
    description: rule.description ?? "",
  };
}

function normalizeAction(action) {
  if (!action || typeof action !== "object") {
    throw new PermissionResolverError(
      "invalid_action",
      "Permission resolver action must be an object.",
    );
  }
  if (!action.id || !action.tool) {
    throw new PermissionResolverError(
      "invalid_action",
      "Permission resolver action requires id and tool.",
    );
  }

  return cloneJson(action);
}

function ruleMatchesAction(rule, action) {
  if (rule.tool !== "*" && rule.tool !== action.tool) {
    return {
      matched: false,
      reason: `tool mismatch: ${rule.tool} != ${action.tool}`,
    };
  }

  const checks = [];
  const match = rule.match ?? {};

  if (match.actionId != null) {
    checks.push({
      ok: action.id === match.actionId,
      reason: `actionId ${action.id} ${action.id === match.actionId ? "==" : "!="} ${match.actionId}`,
    });
  }

  if (match.commandExact != null) {
    const ok = normalizeCommand(action.command) === normalizeCommand(match.commandExact);
    checks.push({
      ok,
      reason: ok
        ? `command exactly matched ${match.commandExact}`
        : `command did not exactly match ${match.commandExact}`,
    });
  }

  if (match.commandPrefix != null) {
    const ok = commandMatchesPrefix(action.command, match.commandPrefix);
    checks.push({
      ok,
      reason: ok
        ? `command matched prefix ${match.commandPrefix}`
        : `command did not match prefix ${match.commandPrefix}`,
    });
  }

  if (match.pathExact != null) {
    const ok = action.path === match.pathExact;
    checks.push({
      ok,
      reason: ok
        ? `path exactly matched ${match.pathExact}`
        : `path did not exactly match ${match.pathExact}`,
    });
  }

  if (match.pathPrefix != null) {
    const ok = pathMatchesPrefix(action.path, match.pathPrefix);
    checks.push({
      ok,
      reason: ok
        ? `path matched prefix ${match.pathPrefix}`
        : `path did not match prefix ${match.pathPrefix}`,
    });
  }

  if (checks.length === 0) {
    return {
      matched: true,
      reason: "tool matched and rule has no extra match fields",
    };
  }

  const failed = checks.find((check) => !check.ok);
  return {
    matched: !failed,
    reason: failed
      ? failed.reason
      : checks.map((check) => check.reason).join("; "),
  };
}

function commandMatchesPrefix(command, prefix) {
  const normalizedCommand = normalizeCommand(command);
  const normalizedPrefix = normalizeCommand(prefix);

  if (!normalizedCommand || !normalizedPrefix) return false;
  if (normalizedCommand === normalizedPrefix) return true;
  return normalizedCommand.startsWith(`${normalizedPrefix} `);
}

function pathMatchesPrefix(targetPath, prefix) {
  if (typeof targetPath !== "string" || typeof prefix !== "string") {
    return false;
  }
  if (targetPath === prefix) return true;
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return targetPath.startsWith(normalizedPrefix);
}

function normalizeCommand(command) {
  return typeof command === "string"
    ? command.trim().replace(/\s+/g, " ")
    : "";
}

function publicRule(rule) {
  return {
    id: rule.id,
    source: rule.source,
    tool: rule.tool,
    decision: rule.decision,
    match: cloneJson(rule.match),
    description: rule.description,
  };
}

function buildCacheKey(action, configHash) {
  return shortHash(`${configHash}:${stableStringify(action)}`);
}

function counterReport(before, after) {
  return {
    before,
    after,
    delta: {
      providerCalls: after.providerCalls - before.providerCalls,
      toolExecutions: after.toolExecutions - before.toolExecutions,
      approvalRequests: after.approvalRequests - before.approvalRequests,
      denials: after.denials - before.denials,
    },
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function shortHash(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runSettingsPermissionResolverDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
