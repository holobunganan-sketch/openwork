# OpenWork 0.2 product and harness plan

OpenWork 0.2 moves the desktop product from an OpenCode-shaped control surface to a task-first general-work agent. The OpenCode engine remains the compatible execution core. OpenWork owns the task contract, context assembly, permissions, checkpoints, artifacts, verification, product navigation, and desktop settings around it.

The implemented harness now persists a per-task Context Graph with source provenance and explicit assumptions, composes inspect/create/verify Skill capability routes by work type, and enforces independent workspace, command, network, external, and destructive permission scopes. Destructive actions always require approval, including when the task uses Agent autonomy.

The task runtime also discovers deliverables from session diffs, patches, and tool attachments; persists them as reviewable artifacts; reads the actual files; and applies type-specific checks for document structure, editable and rendered presentations, spreadsheet structure and formulas, research citations, software tests/builds, and package smoke evidence. A task reaches Verified only when every discovered artifact has passing evidence.

## Product principles

- The home screen starts work. Configuration belongs in Settings.
- A rough request is compiled into a durable task specification with an explicit goal, autonomy mode, deliverables, and acceptance criteria.
- Safe and reversible defaults should keep work moving. Material choices, external actions, secrets, and destructive operations require an appropriate approval.
- The UI exposes plans, actions, files, changes, artifacts, and verification evidence without exposing private model reasoning.
- Completion requires evidence appropriate to the artifact: tests and builds for software, rendering and overflow checks for presentations, formula checks for spreadsheets, source traceability for research, and openability plus structural checks for documents.
- Existing OpenWork Skills, MCP, usage, identity, updater, data isolation, and Windows release behavior remain compatible through migration.

## Target architecture

```text
request and attachments
  -> WorkSpec intent contract
  -> Context Graph
  -> Planner and Skill Router
  -> Work Runtime and permissions
  -> Artifact service
  -> Verifier
  -> handoff, journal, and scoped memory
```

The first vertical slice stores a `WorkSpec` on every task draft and sends it to the engine as synthetic model context. It also introduces task autonomy modes and moves Skills, MCP, and usage management from the home launchpad into the main Settings navigation.

## Delivery sequence

1. Task-first shell, WorkSpec contract, autonomy selection, and Settings information architecture.
2. Durable task journal, task state machine, activity summaries, and crash-safe resume.
3. Workspace Context Graph, source provenance, assumption tracking, and material-question policy.
4. Planner, composable Skill routing, permission scopes, checkpoints, diffs, and rollback.
5. Artifact workspace and validators for documents, presentations, spreadsheets, research, software, and Windows packages.
6. Scoped user/project memory, correction capture, migration, performance, accessibility, and visual regression coverage.
7. Wish-prompt evaluation suite, release candidate, Windows 11 x64 verification, and formal `openwork-v0.2.0` release.

## Release gates

- Existing 0.1 settings and managed data migrate without loss.
- A user can start a task from one rough request and inspect its task contract and autonomy mode.
- Restart, pause, resume, retry, and rollback preserve task integrity.
- Workspace, network, MCP, command, secret, GitHub, and destructive permissions remain independently enforceable.
- Skills, MCP, and usage are usable from Settings and no longer occupy the task home.
- General-work artifact validators provide concrete completion evidence.
- App unit tests, desktop tests, typechecking, lint, production build, Windows packaging, SBOM, portable launch, install, installed launch, coexistence, and uninstall all pass.
