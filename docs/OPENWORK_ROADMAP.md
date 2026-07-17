# OpenWork delivery tracker

This file mirrors the GitHub issue tracker so the delivery state remains reviewable even when repository Issues are temporarily unavailable. The `openwork-project-bootstrap.yml` workflow creates the corresponding labels and issues after Issues are enabled.

- [x] Audit repository architecture and record upstream baseline
- [x] Create `openwork-main` and `feature/openwork-foundation`
- [x] Merge independent GitHub-hosted CI and upstream-sync workflows
- [x] Isolate OpenWork identity, user data, protocol, telemetry, and update source
- [x] Build bilingual general-work home and navigation
- [x] Implement global Skill inventory and non-destructive state management
- [x] Implement safe ZIP Skill preview, install, backup, rollback, export, and uninstall
- [x] Implement MCP manager, JSON/JSONC import, secret vault, backup, restore, and tests
- [x] Implement OpenCode Go usage adapter and clearly labelled local fallback
- [x] Produce Windows 11 x64 NSIS and portable artifacts
- [x] Run install, launch, coexistence, and uninstall smoke tests
- [x] Publish and validate `openwork-v0.1.0-rc.1`
- [x] Fix RC defects and publish `openwork-v0.1.0`

Formal release gates are defined in the release workflow and release documentation. An unchecked item may not be reported as complete.

## OpenWork 0.2.0

- [x] Replace the card-based home with a task-first composer and lightweight work presets
- [x] Add WorkSpec intent contracts and per-task autonomy modes
- [x] Move Skills, MCP, and Go usage into the primary Settings information architecture
- [x] Add durable task state, activity journals, pause/resume, retry, and checkpoints
- [x] Add workspace context assembly, source provenance, and material-question policy
- [x] Add composable Skill routing and scoped permissions
- [x] Add artifact management and type-specific verification
- [x] Add user/project memory with view, edit, export, and delete controls
- [x] Add wish-prompt evaluations, accessibility, visual regression, and migration coverage
- [x] Publish and validate `openwork-v0.2.0-rc.1`
- [x] Fix RC defects and publish `openwork-v0.2.0`

## OpenWork 0.2.1

- [x] Accept valid Skill ZIP packages with nested helper directories and a single root manifest
- [x] Add project-folder, model, and model-variant selection to the task-first home
- [x] Start a task directly from the task-first composer without returning to the legacy session shell
- [x] Persist the selected workspace and model in the WorkSpec and active task workbench
- [x] Add browser coverage for one-click task launch and server-backed prompt submission
- [x] Publish and validate `openwork-v0.2.1-rc.1`
- [x] Fix RC defects and publish `openwork-v0.2.1`
