# OpenWork repository audit

Audit date: 2026-07-17  
Audited baseline: `3a1c6df9e24672f0761a6ced18e1315d89334baf` (`dev`)

## Monorepo structure

The repository is a Bun workspace pinned by the root `packageManager` field to Bun `1.3.14`. Turbo coordinates package-level typechecking and tests. The relevant product boundaries are:

| Area                        | Current location                                        | OpenWork treatment                                          |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Desktop shell               | `packages/desktop`                                      | Primary thin-fork product layer                             |
| Shared renderer             | `packages/app`                                          | General-work navigation and pages are added here            |
| OpenCode engine/CLI         | `packages/opencode`                                     | Kept compatible; extended only at stable service boundaries |
| Shared core/schema/protocol | `packages/core`, `packages/schema`, `packages/protocol` | Preserve upstream types and runtime dependency direction    |
| UI primitives               | `packages/ui`, `packages/session-ui`                    | Reuse rather than duplicate                                 |
| SDK/client                  | `packages/sdk`, `packages/client`                       | Preserve generated interfaces and package names             |

The root remains MIT licensed and retains the upstream Git history and attribution.

## Desktop entry and process boundaries

The Desktop application uses Electron `42.3.3`, Electron Vite, SolidJS, and Electron Builder.

- Main entry: `packages/desktop/src/main/index.ts`
- Preload entry: `packages/desktop/src/preload/index.ts`
- Preload contract: `packages/desktop/src/preload/types.ts`
- Renderer entry: `packages/desktop/src/renderer/index.tsx`
- Shared application UI: `packages/app/src`
- IPC registration: `packages/desktop/src/main/ipc.ts`
- Window creation and renderer protocol: `packages/desktop/src/main/windows.ts`
- Packaging configuration: `packages/desktop/electron-builder.config.ts`

The current security boundary already uses a preload API: renderer code calls `window.api`; Main owns filesystem, shell, dialogs, update operations, and process management. OpenWork-specific privileged services must be registered in Main and exposed through narrow, typed IPC methods. Renderer code must not receive provider tokens or unrestricted filesystem/process access.

## CLI sidecar and Desktop relationship

Desktop does not spawn the public CLI executable for its normal embedded server. `packages/desktop/src/main/server.ts` starts an Electron `utilityProcess`; `packages/desktop/src/main/sidecar.ts` dynamically imports `virtual:opencode-server` and listens only on loopback with per-launch Basic Auth credentials. The Vite build aliases the OpenCode server into this sidecar bundle.

`packages/desktop/scripts/prebuild.ts` copies channel icons and metadata, then runs `packages/opencode/script/build-node.ts`. Release preparation can also retrieve/copy platform CLI artifacts into `resources/opencode-cli(.exe)` through the Desktop scripts. OpenWork must keep this build relationship intact while giving the installed application, protocol, data paths, artifacts, and update source an independent identity.

## Configuration and local state

The engine uses `xdg-basedir` through `packages/core/src/global.ts` with the application key `opencode`:

- Config: the platform XDG config root plus `opencode` (normally `~/.config/opencode` on Unix-like systems)
- Data: the platform XDG data root plus `opencode`
- Cache/state/logs: corresponding XDG roots plus `opencode`

Global configuration candidates are `config.json`, `opencode.json`, and `opencode.jsonc`. `packages/opencode/src/config/config.ts` already uses `jsonc-parser` edits for structured updates. The engine merges global, project, environment-provided, managed, and remote configuration sources.

Desktop state is separate from engine state. Main currently sets Electron `userData` to an App-ID-derived directory below `appData`. OpenWork will use its own App ID and therefore its own window state, updater state, cache, logs, crash dumps, and UI preferences. Engine configuration compatibility will be explicit: read existing OpenCode configuration, import with backup, share, or remain independent. No existing OpenCode configuration may be silently moved, overwritten, or deleted.

## Accounts and providers

Provider credentials are managed by the engine Auth service. Legacy/provider auth is stored in the engine data directory as `auth.json` with restrictive file permissions. The newer Account service stores account, organization, access-token, refresh-token, and expiry records through the account repository/database and refreshes tokens through authenticated service endpoints.

Provider availability and connection state are synchronized into the shared app. The existing settings UI updates provider configuration through the authenticated local server client. OpenWork usage and credential features must stay in Main/engine services; plaintext secrets must never be sent to Renderer or emitted to logs.

## Skill discovery

`packages/opencode/src/skill/index.ts` is the compatibility source of truth. It discovers:

- OpenCode config directories under `{skill,skills}/**/SKILL.md`
- Global and project `.claude/skills/**/SKILL.md`
- Global and project `.agents/skills/**/SKILL.md`
- Extra paths and remote URLs declared by the `skills` config section

Skills are parsed through the existing Markdown/frontmatter parser, duplicate names are reported, and agent permission rules determine availability. The OpenWork manager will add metadata, validation, non-destructive enable/disable state, backup, ZIP preview/install, export, and recovery without changing the model-facing Skill protocol.

## MCP configuration and lifecycle

The MCP schema is defined in `packages/core/src/v1/config/mcp.ts` and referenced by the global `mcp` record. Local definitions use an argument array (`command`), optional working directory/environment, enabled state, and timeout. Remote definitions use URL, headers, OAuth configuration, enabled state, and timeout.

`packages/opencode/src/mcp/index.ts` owns connection lifecycle, OAuth, status, tool/resource discovery, add, and remove operations. Existing server routes and shared-app synchronization expose engine status. OpenWork will build import/export and configuration management around this schema. JSONC writes must use structural edits, merge only the `mcp` field, preserve unrelated configuration/comments, serialize writes, and create timestamped backups.

## Updates, telemetry, and crash reporting

Electron Updater is configured in `packages/desktop/src/main/updater.ts`; the publish repository comes from Electron Builder channel configuration. The current beta and production channels point to `anomalyco/opencode-beta` and `anomalyco/opencode`. These sources must be replaced with `holobunganan-sketch/openwork`, filtered to the `openwork-v*` release track.

Desktop crash reporting currently starts Electron Crashpad with `uploadToServer: false`. Vite disables build telemetry, but upstream publish/deploy workflows inject Sentry DSN, release, organization, project, and auth-token values. OpenWork workflows will not inject upstream Sentry values, and non-essential telemetry remains disabled by default. Debug log export names and manifests must be rebranded and redact secrets.

## Existing Windows packaging

Electron Builder produces NSIS packages and currently uses channel-specific OpenCode App IDs, product names, icons, protocol registration, and GitHub publish destinations. Windows signing is delegated to `script/sign-windows.ps1` whenever a GitHub Actions Windows build runs. Upstream release jobs require Azure Trusted Signing credentials and also build macOS/Linux variants.

The upstream `.github/workflows/publish.yml` cannot be reused by this fork because it:

- is gated to `anomalyco/opencode`
- uses Blacksmith private runners
- relies on the OpenCode GitHub App secret
- relies on OpenCode Azure Trusted Signing credentials
- relies on Apple signing/notarization secrets
- injects OpenCode Sentry configuration
- publishes ordinary upstream `v*` tags and OpenCode-branded artifacts

OpenWork therefore needs independent GitHub-hosted CI and release workflows. Signing is opt-in; an absent OpenWork certificate must produce an unsigned but tested release with a SmartScreen notice rather than fail the build.

## Compatibility boundaries to preserve

- Session, provider, model, terminal, file, Git, Diff, tool-call, and plugin semantics
- Internal `@opencode-ai/*` package names
- SDK and generated protocol shapes
- Config, Skill, MCP, Agent, and permission schemas unless extended compatibly
- Loopback sidecar authentication and renderer isolation
- MIT license, upstream copyright, and Git history

## OpenWork product modules to isolate

- Desktop identity, paths, protocol, update source, icons, installer, and artifact naming
- General-work home/navigation/task presets and bilingual copy
- Configuration compatibility/migration UI and backup service
- Skill inventory and safe ZIP installer in Main
- MCP JSON/JSONC import, secret vault, backup, recovery, and connection UI
- `UsageProviderAdapter`, official OpenCode Go adapter, and clearly labelled local estimator
- OpenWork privacy, logging redaction, CI, Windows smoke tests, and release automation

This isolation keeps the fork thin: user-facing product code changes substantially while upstream engine and protocol surfaces remain mergeable.
