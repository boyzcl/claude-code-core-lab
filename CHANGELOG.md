# Changelog

This project uses a human-readable changelog for learning-system and repository-governance changes. It is not a substitute for `CURRENT_STATE.md`, which remains the current progress and next-action source of truth.

## Unreleased

### Added

- Added `docs/core-logic-map.md` as the first mechanism overview for the full Claude Code-like Agent logic chain.
- Added `assets/diagrams/claude-code-core-mechanism.png` as the README first visual, using a GPT-generated visual base with deterministic labels.

### Changed

- Reordered README, learner entry, learning plan, docs index, course README, authority map, and project structure guidance so learners understand mechanism logic before treating code and verify scripts as evidence.

## v0.1-learning-preview - 2026-06-02

### Added

- Added a current synthesis article explaining how to implement a code agent from runtime loop to product-surface boundaries, with Chinese-first terminology.
- Added a Chinese-first terminology rule for current explanatory docs, with explicit exceptions for file names, commands, code fields, verify cases, outputs, and historical text.
- Added `docs/learning-plan.md` to give first-time learners a 30-minute, half-day, and seven-session learning path from README to Course 18 and Core verification.
- Added `docs/troubleshooting.md`, `exercises/`, `projects/`, `solutions/`, and `projects/capstone-mini-runtime/` to complete the first public learning practice layer.
- Added `docs/reference/claude-code-capability-coverage-matrix.md` to map official public Claude Code capabilities to this project's Course / Lab / Core coverage, verify evidence, and out-of-scope boundaries.
- Added `docs/releases/v0.1-learning-preview.md` as the release note for the first learning preview.
- Added `scripts/check-doc-links.mjs` and `npm run docs:links` for local Markdown internal link checks.
- Added GitHub issue templates for reproducible bug reports and course or learning feedback.
- Added a pull request template with evidence and public-boundary checks.
- Added reference guidance for GitHub project standards and core runtime object mapping.

### Notes

- No production Claude Code capability, official implementation claim, real provider billing claim, or RelativeScore claim is introduced by changelog entries.
