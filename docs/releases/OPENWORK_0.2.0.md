OpenWork 0.2.0 turns the Windows desktop application into a task-first general-work harness while retaining the compatible OpenCode execution core.

## Highlights

- A focused work composer replaces the configuration-heavy home. Document, research, data, presentation, and software presets remain lightweight starting points rather than separate product silos.
- Rough English, Simplified Chinese, and Traditional Chinese requests compile into a durable WorkSpec with explicit deliverables, formats, audience, tone, language, size, timing, platform, editability, citation, preservation, and coexistence constraints.
- Plan, Collaborate, and Agent modes combine with independent workspace, command, network, external, and destructive controls. Destructive operations always require approval.
- Durable tasks retain state, activity, checkpoints, pause/resume/retry behavior, Context Graph sources, assumptions, Skill routes, artifacts, and verification evidence across restarts.
- Completion is evidence-based: OpenWork applies artifact-specific checks for documents, presentations, spreadsheets, research, software, and Windows packages.
- User and exact-project memory is visible and controlled in Settings. Entries can be edited, disabled, exported, or permanently deleted and cannot expand permissions or override current evidence.
- Skills with safe ZIP installation, MCP with JSON/JSONC import and encrypted secrets, and OpenCode Go usage with a labelled local fallback live in Settings.
- Persisted 0.1 task drafts and OpenWork-managed state are migrated before use. The production harness now has wish-prompt, accessibility, narrow-layout, and visual-stability release gates.

## Windows downloads

- `OpenWork-Setup-0.2.0-windows-x64.exe`: assisted per-user NSIS installer for Windows 11 x64.
- `OpenWork-Portable-0.2.0-windows-x64.exe`: portable Windows 11 x64 executable.
- RC assets include the `-rc.N` version in their file names.
- `SHA256SUMS.txt`: SHA-256 verification values for every published asset.
- `OpenWork-*.cdx.json`: CycloneDX 1.6 software bill of materials generated from the locked dependency graph.

The artifacts are unsigned unless the release run explicitly enables configured OpenWork Windows signing. Windows SmartScreen may therefore show an unknown-publisher warning. Verify the SHA-256 checksum before running an unsigned download.

## Upgrade, data, and compatibility

Installing 0.2.0 over 0.1.0 retains the isolated OpenWork user-data directory and upgrades versioned UI state in place. User-created projects, OpenWork memory, managed Skills, MCP backups, encrypted secret references, and OpenCode configuration remain outside the installer payload and are not removed by uninstall.

OpenWork and OpenCode keep distinct application identities, protocols, updater state, and default engine directories. Existing OpenCode configuration is used only through an explicit read, import, or share choice; imports create backups and refuse destructive replacement. MCP changes made while the local engine is running still require an OpenWork restart.

## Validation and rollback

Every release asset is rebuilt after the source commit has passed lint, typechecking, App and Desktop tests, the production Playwright harness gate, desktop build, Windows x64 package verification, SBOM generation, portable launch, silent install, installed launch, OpenCode coexistence-marker checks, and silent uninstall.

Published tags and assets are immutable. A defective RC is superseded by a new RC. A defective formal release is followed by a patch release; the 0.2.0 tag is never moved. Because user data is isolated from the application payload, uninstalling 0.2.0 and reinstalling 0.1.0 does not delete it, though task state newly written by 0.2.0 should be exported before a downgrade.

## Support boundary

This release targets Windows 11 x64. Internal OpenCode engine and SDK package names remain compatible with upstream. Report OpenWork-specific defects at the OpenWork repository and include exported debug logs only after reviewing them for project-sensitive content.
