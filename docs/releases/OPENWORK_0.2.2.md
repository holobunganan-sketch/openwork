OpenWork 0.2.2 fixes duplicate task tabs when launching work from the task-first home.

## Fixes and improvements

- Task launch is now single-flight while the draft and route transition are being created. Rapid repeated activation no longer creates an orphan draft beside the running session.
- The home task boundary coalesces concurrent launch requests before they reach `tabs.newDraft()`, while preserving normal retries after a failed or completed transition.
- Keyboard launch ignores input-method composition and key-repeat events so confirming composed text or holding the shortcut cannot submit the same task twice.
- The production browser gate now sends two rapid launch activations and requires exactly one server session, one prompt submission, and one titlebar tab.

## Windows downloads

- `OpenWork-Setup-0.2.2-windows-x64.exe`: assisted per-user NSIS installer for Windows 11 x64.
- `OpenWork-Portable-0.2.2-windows-x64.exe`: portable Windows 11 x64 executable.
- RC assets include the `-rc.N` version in their file names.
- `SHA256SUMS.txt`: SHA-256 verification values for every published asset.
- `OpenWork-*.cdx.json`: CycloneDX 1.6 software bill of materials generated from the locked dependency graph.

The artifacts are unsigned unless the release run explicitly enables configured OpenWork Windows signing. Windows SmartScreen may therefore show an unknown-publisher warning. Verify the SHA-256 checksum before running an unsigned download.

## Upgrade, data, and compatibility

Installing 0.2.2 over 0.2.1 retains the isolated OpenWork user-data directory and upgrades versioned UI state in place. User-created projects, task state, OpenWork memory, managed Skills, MCP backups, encrypted secret references, and OpenCode configuration remain outside the installer payload and are not removed by uninstall.

OpenWork and OpenCode keep distinct application identities, protocols, updater state, and default engine directories. Existing OpenCode configuration is used only through an explicit read, import, or share choice; imports create backups and refuse destructive replacement. MCP changes made while the local engine is running still require an OpenWork restart.

## Validation and rollback

Every release asset is rebuilt after the source commit has passed lint, typechecking, App and Desktop tests, the production Playwright harness gate, desktop build, Windows x64 package verification, SBOM generation, portable launch, silent install, installed launch, OpenCode coexistence-marker checks, and silent uninstall.

Published tags and assets are immutable. A defective RC is superseded by a new RC. A defective formal release is followed by a later patch release; the 0.2.2 tag is never moved. OpenWork user data is retained during uninstall, but exporting task state before a downgrade is recommended.

## Support boundary

This release targets Windows 11 x64. Internal OpenCode engine and SDK package names remain compatible with upstream. Report OpenWork-specific defects at the OpenWork repository and include exported debug logs only after reviewing them for project-sensitive content.
