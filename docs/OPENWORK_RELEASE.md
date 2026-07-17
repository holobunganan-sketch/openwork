# OpenWork release procedure

OpenWork releases use only the `openwork-v*` tag namespace and the independent `openwork-release.yml` workflow. Upstream OpenCode publish workflows, credentials, tags, and release repositories are outside this release path.

## Required gates

1. Merge the release pull request into `openwork-main` after OpenWork CI passes.
2. Tag the tested merge as `openwork-v0.1.0-rc.N`. The release workflow rebuilds version `0.1.0-rc.N`, runs lint, typechecking, unit tests, the desktop build, Windows packaging, portable launch, silent NSIS install, installed launch, coexistence-marker verification, and silent uninstall.
3. Inspect the prerelease assets, checksums, SBOM, workflow logs, and Windows launch result. Fix defects through a pull request and publish a new RC tag; never replace an existing tag or release asset.
4. After an RC passes without release-blocking defects, tag the same or a later tested `openwork-main` commit as `openwork-v0.1.0`. The workflow repeats every gate before publishing the latest release.

## Artifact policy

The supported 0.1.0 deliverables are Windows 11 x64 NSIS and portable executables, Electron update metadata, SHA-256 checksums, and a CycloneDX 1.6 SBOM. Artifacts are generated from the tagged commit and uploaded by GitHub Actions; locally built binaries are not release inputs.

Windows signing is opt-in through the OpenWork signing configuration. If signing is not configured, the workflow publishes validated unsigned artifacts and the release notes retain the SmartScreen warning. A missing signing identity must not fall back to upstream OpenCode credentials.

## Rollback and recovery

- Published tags and assets are immutable. A defective RC is superseded by the next RC.
- A defective formal release is marked as affected and followed by a patch release; its tag is not moved.
- OpenWork uninstallation leaves user-created projects and isolated OpenWork user data intact. Configuration changes made by the Skills and MCP managers retain timestamped, recoverable backups.
- Updater metadata is served only from `holobunganan-sketch/openwork` releases and stable clients ignore prereleases.
