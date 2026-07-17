# OpenWork upstream base

- Upstream repository: `anomalyco/opencode`
- Upstream branch: `dev`
- OpenWork repository: `holobunganan-sketch/openwork`
- OpenWork product branch: `openwork-main`
- Initial baseline commit: `3a1c6df9e24672f0761a6ced18e1315d89334baf`
- Baseline subject: `fix(app): deduplicate diff summaries linearly (#37414)`
- Sync date: 2026-07-17
- OpenWork product version: `0.2.1`

## Baseline policy

`dev` remains the thin-fork tracking branch. OpenWork product work is developed on feature branches and merged into `openwork-main`. Upstream synchronization must use the manual `openwork-sync-upstream.yml` workflow. It creates a new branch and a pull request; it never resets or writes directly to `openwork-main`.

## Core differences

At this baseline, the product branch is being separated from the upstream release system. OpenWork adds an independent desktop identity, a general-work information architecture, Skills and MCP management, OpenCode Go usage adapters, privacy defaults, GitHub-hosted CI, and a Windows-only OpenWork release track. Internal `@opencode-ai/*` package names and engine protocols remain compatible with upstream.
