# Agent Working Guide

This file is the root Agent control entry for this repository. Use it to route work, not as a full project encyclopedia.

## Start Here

1. Read `CURRENT_STATE.md` for the current breakpoint, latest verification, and next action.
2. Read `docs/authority-map.md` when documents disagree.
3. Read `docs/index.md` to find current rules, history, and evidence.
4. Use the nearest `docs/core/core-XX-*.md` or `docs/lab/lab-XX-*.md` file for implementation context.

## Work Rules

- Preserve the course -> lab -> core naming system.
- Prefer the existing runtime, tool, policy, context, plan, compaction, eval, and model-gateway boundaries.
- Do not turn prompt guidance into a substitute for Policy or ToolRuntime.
- Do not treat historical analysis documents as current rules unless `docs/authority-map.md` names them as canonical.
- Do not commit API keys, tokens, `.env.local`, traces with secrets, or provider credentials.
- Do not print stored API keys in summaries or verification records.

## Commands

Run the full verification before a handoff:

```bash
npm run verify:all
```

Useful focused commands:

```bash
npm run verify:labs
npm run core:07:verify
npm run core:07:live
npm run core:10:verify
```

## Completion Definition

A Core stage is complete only when all of these are true:

1. The implementation exists under `src/core/`.
2. A matching `*.verify.mjs` script proves the behavior.
3. The stage document explains what was proven and what remains out of scope.
4. `package.json` exposes the demo and verify scripts.
5. `CURRENT_STATE.md` and `docs/records/core-run-record.md` reflect the new stage.

## Secret Handling

Local model configuration may live in `.env.local`. It is intentionally ignored by git. The key can be used for ongoing local tests, but it must not be copied into source files, docs, eval reports, runtime traces, or final handoff text.
