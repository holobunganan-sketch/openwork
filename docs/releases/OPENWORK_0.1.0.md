OpenWork 0.1.0 is the first independent Windows desktop release of OpenWork, a general-purpose agent workspace built on the OpenCode engine.

## Highlights

- General-work home with bilingual task starters for documents, research, data, presentations, and software development.
- Managed Skills inventory with ZIP validation, safe install, enable/disable, automatic backups, rollback, export, and recoverable uninstall.
- MCP manager with OpenCode JSON/JSONC and Claude `mcpServers` import, comment-preserving updates, encrypted secret storage, backup, and restore.
- OpenCode Go usage view with an opt-in official-provider adapter and an explicitly labelled local session-cost fallback.
- Independent OpenWork identity, protocol, data paths, updater, NSIS installer, portable executable, CI, and release track.

## Windows downloads

- `OpenWork-Setup-0.1.0-windows-x64.exe`: per-user NSIS installer for Windows 11 x64.
- `OpenWork-Portable-0.1.0-windows-x64.exe`: portable Windows 11 x64 executable.
- RC assets include the `-rc.N` version in their file names.
- `SHA256SUMS.txt`: SHA-256 verification values for every published asset.
- `OpenWork-*.cdx.json`: CycloneDX 1.6 software bill of materials generated from the locked dependency graph.

The 0.1.0 artifacts are unsigned unless the release run explicitly enables configured OpenWork Windows signing. Windows SmartScreen may therefore show an unknown-publisher warning. Verify the SHA-256 checksum before running an unsigned download.

## Data and compatibility

OpenWork uses its own application identity and isolated engine directories. Installing, launching, updating, or uninstalling OpenWork does not remove OpenCode configuration or application data. Existing OpenCode configuration is used only through an explicit read, import, or share choice; imports create backups and refuse destructive replacement.

MCP changes made while the local engine is running require an OpenWork restart. Secret values detected during import are removed from JSON/JSONC and encrypted through the operating-system credential store; they are never returned to the renderer.

## Support boundary

This release targets Windows 11 x64. Internal OpenCode engine and SDK package names remain compatible with upstream. Report OpenWork-specific defects at the OpenWork repository and include exported debug logs only after reviewing them for project-sensitive content.
