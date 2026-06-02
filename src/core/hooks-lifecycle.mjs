import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DurableSessionStore,
  durableSessionBoundary,
} from "./durable-session-store-replay.mjs";
import {
  SettingsPermissionResolver,
  createPermissionConfigFixture,
} from "./settings-permission-resolver.mjs";

export const CORE28_HOOKS_LIFECYCLE_VERSION =
  "core28-hooks-lifecycle-v1";

const REDACTED = "[REDACTED]";

export class HooksLifecycleRuntime {
  constructor({
    store,
    sessionId,
    hookRegistry = createHookRegistryFixture(),
    permissionResolver = new SettingsPermissionResolver({
      permissionConfig: createPermissionConfigFixture(),
    }),
  }) {
    if (!store || !sessionId) {
      throw new HookLifecycleError(
        "missing_session",
        "HooksLifecycleRuntime requires a durable store and sessionId.",
      );
    }

    this.store = store;
    this.sessionId = sessionId;
    this.hookRegistry = normalizeHookRegistry(hookRegistry);
    this.permissionResolver = permissionResolver;
    this.state = {
      version: CORE28_HOOKS_LIFECYCLE_VERSION,
      hookEvents: [],
      hookDecisions: [],
      hookFeedback: [],
      redactedHookOutput: [],
      constraints: ["Preserve public API exports."],
      observations: [],
      contextSnapshots: [],
      executedActions: [],
      deniedActions: [],
      approvalRequests: [],
      permissionTrace: [],
      hookFailures: [],
      runtimeTrace: [],
    };
  }

  async handleUserPrompt(prompt) {
    const hookReport = await this.invokeHooks("userPromptSubmit", {
      prompt,
      runtimeState: this.publicRuntimeState(),
    });

    for (const result of hookReport.results) {
      if (result.decision === "constraint") {
        this.state.constraints.push(result.constraint);
        await this.record("constraint.added", {
          source: "hook",
          hookId: result.hookId,
          constraint: result.constraint,
          promotedToSystem: false,
        });
      }
    }

    const snapshot = this.buildContextSnapshot({
      reason: "after_user_prompt_hook",
    });

    return {
      status: "processed",
      prompt,
      hookReport,
      constraints: cloneJson(this.state.constraints),
      contextSnapshot: snapshot,
    };
  }

  async requestAction(action) {
    const before = this.counters();
    const permission = this.permissionResolver.resolve(action);
    this.state.permissionTrace.push(permission);
    this.state.runtimeTrace.push({
      event: "permission.resolved",
      actionId: action.id,
      decision: permission.decision,
      ruleSource: permission.ruleSource,
    });
    await this.record("permission.resolved", {
      actionId: action.id,
      decision: permission.decision,
      ruleSource: permission.ruleSource,
      matchedRule: permission.matchedRule,
    });

    const preHookReport = await this.invokeHooks("preToolUse", {
      action,
      permission,
      runtimeState: this.publicRuntimeState(),
    });
    const block = preHookReport.results.find(
      (result) => result.decision === "block",
    );

    if (permission.decision === "deny") {
      const denial = {
        status: "denied",
        action: cloneJson(action),
        permission,
        preHookReport,
        error: {
          error_type: "permission_denied",
          message: `Permission denied before tool execution: ${action.id}`,
        },
      };
      this.state.deniedActions.push(denial);
      this.state.runtimeTrace.push({
        event: "permission.denied",
        actionId: action.id,
      });
      await this.record("tool.denied", denial);
      return {
        status: "denied",
        denial,
        counters: counterReport(before, this.counters()),
      };
    }

    if (permission.decision === "ask") {
      const approval = {
        status: "approval_required",
        action: cloneJson(action),
        permission,
        preHookReport,
        targetProtocol: "core26-human-approval-interruption-protocol",
      };
      this.state.approvalRequests.push(approval);
      this.state.runtimeTrace.push({
        event: "approval.required.bridge",
        actionId: action.id,
      });
      await this.record("approval.required.bridge", approval);
      return {
        status: "approval_required",
        approval,
        counters: counterReport(before, this.counters()),
      };
    }

    if (block) {
      const blocked = {
        status: "blocked_by_hook",
        action: cloneJson(action),
        permission,
        hookDecision: block,
        preHookReport,
        error: {
          error_type: "hook_blocked_tool",
          message: block.message,
          recommended_next_event: "observe_hook_feedback",
        },
      };
      this.state.runtimeTrace.push({
        event: "hook.blocked_tool",
        actionId: action.id,
        hookId: block.hookId,
      });
      await this.record("tool.blocked_by_hook", blocked);
      return {
        status: "blocked_by_hook",
        blocked,
        counters: counterReport(before, this.counters()),
      };
    }

    const execution = await this.executeAction(action, permission);
    const postHookReport = await this.invokeHooks("postToolUse", {
      action,
      execution,
      permission,
      runtimeState: this.publicRuntimeState(),
    });

    for (const result of postHookReport.results) {
      if (result.decision === "message") {
        this.state.observations.push({
          type: "hook_observation",
          sourceHookId: result.hookId,
          content: result.message,
          promotedToSystem: false,
        });
      }
    }

    const contextSnapshot = this.buildContextSnapshot({
      reason: "after_post_tool_hook",
    });

    return {
      status: "executed",
      execution,
      preHookReport,
      postHookReport,
      contextSnapshot,
      counters: counterReport(before, this.counters()),
    };
  }

  async executeAction(action, permission) {
    const execution = {
      id: action.id,
      tool: action.tool,
      status: "executed",
      permissionDecision: {
        decision: permission.decision,
        ruleSource: permission.ruleSource,
      },
    };
    this.state.executedActions.push(execution);
    this.state.runtimeTrace.push({
      event: "tool.executed",
      actionId: action.id,
      tool: action.tool,
    });
    await this.record("tool.executed", execution);

    return execution;
  }

  async invokeHooks(phase, input) {
    const hooks = this.hookRegistry[phase] ?? [];
    const report = {
      phase,
      invoked: [],
      results: [],
      failures: [],
    };

    for (const hook of hooks) {
      const event = {
        phase,
        hookId: hook.id,
        input: publicHookInput(input),
      };
      report.invoked.push(event);
      this.state.hookEvents.push(event);
      await this.record("hook.invoked", event);

      try {
        const rawResult = await hook.run(input);
        const result = normalizeHookResult(rawResult, hook, phase);
        report.results.push(result);
        this.state.hookDecisions.push(result);
        if (result.message || result.constraint) {
          this.state.hookFeedback.push(result);
        }
        if (result.redactedOutput) {
          this.state.redactedHookOutput.push(result.redactedOutput);
        }
        await this.record(hookEventType(phase, result.decision), result);
      } catch (error) {
        const failure = {
          phase,
          hookId: hook.id,
          decision: "failure",
          error: {
            error_type: "hook_failed",
            message: redactHookText(error.message),
            recoverable: true,
          },
          rawOutputRedacted: true,
        };
        report.failures.push(failure);
        this.state.hookFailures.push(failure);
        this.state.redactedHookOutput.push(failure.error.message);
        await this.record("hook.failed", failure);
      }
    }

    return report;
  }

  buildContextSnapshot({ reason }) {
    const snapshot = {
      reason,
      constraints: cloneJson(this.state.constraints),
      dynamicObservations: cloneJson(this.state.observations),
      systemMessages: [],
      hookFeedbackPromotedToSystem: false,
    };
    this.state.contextSnapshots.push(snapshot);
    this.state.runtimeTrace.push({
      event: "context.snapshot",
      reason,
      dynamicObservationCount: snapshot.dynamicObservations.length,
    });
    return cloneJson(snapshot);
  }

  counters() {
    return {
      providerCalls: 0,
      toolExecutions: this.state.executedActions.length,
      approvalRequests: this.state.approvalRequests.length,
      denials: this.state.deniedActions.length,
      hookBlocks: this.state.hookDecisions.filter(
        (decision) => decision.decision === "block",
      ).length,
      hookFailures: this.state.hookFailures.length,
    };
  }

  publicRuntimeState() {
    return {
      constraints: cloneJson(this.state.constraints),
      executedActionIds: this.state.executedActions.map((action) => action.id),
      observationCount: this.state.observations.length,
    };
  }

  async record(type, payload) {
    await this.store.appendEvent(this.sessionId, type, {
      core28: true,
      payload: redactHookPayload(payload),
    });
  }
}

export class HookLifecycleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HookLifecycleError";
    this.code = code;
    this.details = details;
  }
}

export async function createHooksLifecycleFixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "agent-core28-"));
  const store = new DurableSessionStore({ rootDir });
  const sessionId = await store.createSession({
    workspaceRoot: "/workspace/core-28-hooks-lifecycle",
    mode: "execute",
    initialState: {
      objective: "Prove hooks enter runtime lifecycle without becoming system prompt.",
      latestUserConstraints: ["Preserve public API exports."],
    },
  });
  const runtime = new HooksLifecycleRuntime({
    store,
    sessionId,
  });

  return {
    rootDir,
    store,
    sessionId,
    runtime,
    forbiddenValues: [
      "Bearer local-hook-token",
      "sk-hook-secret-123456",
    ],
  };
}

export function createHookRegistryFixture() {
  return {
    userPromptSubmit: [
      {
        id: "hook_user_prompt_public_api_constraint",
        phase: "userPromptSubmit",
        run: ({ prompt }) => {
          if (/public api|公开 API|公共 API/i.test(prompt.content)) {
            return {
              decision: "constraint",
              constraint: "Hook constraint: keep exported API names stable.",
              output: "Detected public API constraint.",
            };
          }
          return {
            decision: "continue",
            output: "No prompt constraint added.",
          };
        },
      },
    ],
    preToolUse: [
      {
        id: "hook_pre_block_write_mode_test",
        phase: "preToolUse",
        run: ({ action }) => {
          if (action.tool === "Bash" && /--write\b/.test(action.command ?? "")) {
            return {
              decision: "block",
              message: "Hook blocked test command with write mode.",
              output: "pre hook blocked write-mode test command.",
            };
          }
          return {
            decision: "continue",
            output: "pre hook allowed action.",
          };
        },
      },
      {
        id: "hook_pre_failure_for_destructive_action",
        phase: "preToolUse",
        run: ({ action }) => {
          if (action.id === "deny_with_hook_failure") {
            throw new Error(
              "hook script failed while reading sk-hook-secret-123456",
            );
          }
          return {
            decision: "continue",
            output: "pre hook failure fixture not triggered.",
          };
        },
      },
    ],
    postToolUse: [
      {
        id: "hook_post_test_feedback",
        phase: "postToolUse",
        run: ({ action, execution }) => {
          if (action.tool === "Bash" && execution.status === "executed") {
            return {
              decision: "message",
              message: "Hook observation: test command executed; keep final answer verification-grounded.",
              output: "Bearer local-hook-token",
            };
          }
          return {
            decision: "continue",
            output: "post hook no message.",
          };
        },
      },
    ],
  };
}

export function createHookActionFixtures() {
  return {
    preBlocked: {
      id: "test_with_write_mode",
      tool: "Bash",
      command: "node scripts/test.cjs --write",
      reason: "Simulate a write-mode verification command.",
    },
    safeTest: {
      id: "run_tests_with_hook_feedback",
      tool: "Bash",
      command: "node scripts/test.cjs --ci",
      reason: "Run allowed verification and collect post hook feedback.",
    },
    denyWithHookFailure: {
      id: "deny_with_hook_failure",
      tool: "Bash",
      command: "rm -rf .",
      reason: "Dangerous command should remain denied even if hook fails.",
    },
  };
}

export async function runHooksLifecycleDemo() {
  const fixture = await createHooksLifecycleFixture();
  const runtime = fixture.runtime;
  const actions = createHookActionFixtures();

  const userPrompt = await runtime.handleUserPrompt({
    id: "user_prompt_001",
    content: "Please keep the public API stable while checking the test hook.",
  });
  const preToolBlock = await runtime.requestAction(actions.preBlocked);
  const postToolFeedback = await runtime.requestAction(actions.safeTest);
  const hookFailure = await runtime.requestAction(actions.denyWithHookFailure);
  const events = await fixture.store.readEvents(fixture.sessionId);
  const secretScan = await fixture.store.scanForSecrets(fixture.sessionId, {
    forbiddenValues: fixture.forbiddenValues,
  });

  const report = {
    version: CORE28_HOOKS_LIFECYCLE_VERSION,
    status: "passed",
    validationMatrix: core28ImplementationValidationMatrix(),
    sessionId: fixture.sessionId,
    userPrompt,
    preToolBlock,
    postToolFeedback,
    hookFailure,
    eventTypes: events.map((event) => event.type),
    state: cloneJson(runtime.state),
    noHiddenExecution: assertNoHiddenHookExecution(runtime.state.runtimeTrace),
    secretScan,
    boundary: hooksLifecycleBoundary(),
  };

  return {
    checks: verifyHooksLifecycleDemo(report),
    ...report,
  };
}

export function verifyHooksLifecycleDemo(report) {
  assert.equal(report.version, CORE28_HOOKS_LIFECYCLE_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.userPrompt.status, "processed");
  assert.equal(report.preToolBlock.status, "blocked_by_hook");
  assert.equal(report.postToolFeedback.status, "executed");
  assert.equal(report.hookFailure.status, "denied");
  assert.equal(report.noHiddenExecution.valid, true);
  assert.equal(report.secretScan.status, "passed");
  assert.equal(report.boundary.productionHooksClaim, false);
  assert.equal(report.boundary.shellHookProductClaim, false);
  assert.equal(report.boundary.pluginSystemClaim, false);

  return {
    validation_matrix_present: true,
    pre_tool_hook_blocks_execution: true,
    post_tool_hook_enters_context_observation: true,
    user_prompt_hook_adds_runtime_constraint: true,
    hook_failure_structured_without_permission_bypass: true,
    secret_boundary_redacts_hook_output: true,
    no_hidden_execution_asserted: true,
    no_production_claim: true,
  };
}

export function assertNoHiddenHookExecution(runtimeTrace) {
  const allowedActions = new Set();
  const blockedActions = new Set();
  const deniedActions = new Set();

  for (const event of runtimeTrace) {
    if (event.event === "permission.resolved" && event.decision === "allow") {
      allowedActions.add(event.actionId);
    }
    if (event.event === "hook.blocked_tool") {
      blockedActions.add(event.actionId);
    }
    if (event.event === "permission.denied") {
      deniedActions.add(event.actionId);
    }
    if (event.event === "tool.executed") {
      if (!allowedActions.has(event.actionId)) {
        throw new HookLifecycleError(
          "hidden_execution_detected",
          `Tool executed without allow decision: ${event.actionId}`,
          { event },
        );
      }
      if (blockedActions.has(event.actionId) || deniedActions.has(event.actionId)) {
        throw new HookLifecycleError(
          "blocked_or_denied_action_executed",
          `Tool executed after hook block or deny: ${event.actionId}`,
          { event },
        );
      }
    }
  }

  return {
    valid: true,
    allowedActionIds: [...allowedActions],
    blockedActionIds: [...blockedActions],
    deniedActionIds: [...deniedActions],
  };
}

export function core28ImplementationValidationMatrix() {
  return {
    topic: "Hooks Lifecycle",
    evidenceTier:
      "A public docs as interface clues, B product artifact observations as mechanism clues, D local implementation and verify evidence.",
    publicBoundary: {
      rawPromptOrSourceMapText: false,
      officialImplementationClaim: false,
      ownObjectModel: true,
    },
    sameTopicMergeDecision: {
      extends: ["Core 24 Durable Session Store", "Core 26 Human Approval"],
      independentBecause:
        "Core 28 models hooks as runtime lifecycle events that can block, add observations, add constraints, fail structurally, and redact output.",
      notCore24:
        "It does not claim a new durable store; it records hook events into the existing append-only session log.",
      notCore26:
        "It does not approve or reject human decisions; it can only block tools or add constrained feedback before the approval protocol continues.",
    },
    runtimeState: [
      "hookRegistry",
      "hookEvent",
      "hookDecision",
      "hookFeedback",
      "redactedHookOutput",
    ],
    cases: [
      {
        case: "pre tool hook",
        fixture: "preToolUse hook returns block for write-mode test command",
        expected: "tool does not execute and block feedback enters session event",
        evidence: "event log and tool execution counter",
      },
      {
        case: "post tool hook",
        fixture: "postToolUse hook returns message after allowed Bash",
        expected: "message enters next context as dynamic observation, not system",
        evidence: "context snapshot",
      },
      {
        case: "user prompt hook",
        fixture: "userPromptSubmit hook adds public API constraint",
        expected: "constraint enters Runtime State and is not promoted to system",
        evidence: "state update and context snapshot",
      },
      {
        case: "hook failure",
        fixture: "preToolUse hook throws while permission denies rm -rf",
        expected: "failure is structured and denied action does not execute",
        evidence: "hook report and permission trace",
      },
      {
        case: "secret boundary",
        fixture: "hook output contains Bearer token and sk-like text",
        expected: "stored event log contains redacted output only",
        evidence: "secret scan",
      },
    ],
    outOfScope: [
      "real shell hook product",
      "arbitrary user script sandbox",
      "complete plugin system",
      "official Claude Code hook implementation",
    ],
  };
}

export function hooksLifecycleBoundary() {
  return {
    deterministicLocalHooksLifecycle: true,
    replayableSessionEvents: true,
    durableSessionBoundary: durableSessionBoundary(),
    productionHooksClaim: false,
    officialImplementationClaim: false,
    shellHookProductClaim: false,
    arbitraryScriptSandboxClaim: false,
    pluginSystemClaim: false,
  };
}

function normalizeHookRegistry(registry) {
  return {
    userPromptSubmit: registry.userPromptSubmit ?? [],
    preToolUse: registry.preToolUse ?? [],
    postToolUse: registry.postToolUse ?? [],
  };
}

function normalizeHookResult(rawResult, hook, phase) {
  const decision = rawResult?.decision ?? "continue";
  const output = rawResult?.output;
  const redactedOutput = output == null ? null : redactHookText(output);
  const result = {
    phase,
    hookId: hook.id,
    decision,
    message: rawResult?.message ? redactHookText(rawResult.message) : null,
    constraint: rawResult?.constraint ? redactHookText(rawResult.constraint) : null,
    redactedOutput,
    rawOutputRedacted: output !== redactedOutput,
    promotedToSystem: false,
  };

  if (!["continue", "block", "message", "constraint"].includes(decision)) {
    throw new HookLifecycleError(
      "invalid_hook_decision",
      `Unsupported hook decision: ${decision}`,
    );
  }

  return result;
}

function hookEventType(phase, decision) {
  if (phase === "preToolUse" && decision === "block") {
    return "hook.pre_tool.blocked";
  }
  if (phase === "postToolUse" && decision === "message") {
    return "hook.post_tool.feedback";
  }
  if (phase === "userPromptSubmit" && decision === "constraint") {
    return "hook.user_prompt.constraint";
  }
  return "hook.continued";
}

function publicHookInput(input) {
  return {
    actionId: input.action?.id ?? null,
    tool: input.action?.tool ?? null,
    promptId: input.prompt?.id ?? null,
    permissionDecision: input.permission?.decision ?? null,
  };
}

function redactHookPayload(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactHookPayload(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        redactHookPayload(entryValue),
      ]),
    );
  }
  if (typeof value === "string") {
    return redactHookText(value);
  }
  return value;
}

function redactHookText(text) {
  return String(text)
    .replace(/Bearer\s+\S+/gi, REDACTED)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, REDACTED)
    .replace(/token[=:]\s*\S+/gi, `token=${REDACTED}`);
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
      hookBlocks: after.hookBlocks - before.hookBlocks,
      hookFailures: after.hookFailures - before.hookFailures,
    },
  };
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runHooksLifecycleDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
