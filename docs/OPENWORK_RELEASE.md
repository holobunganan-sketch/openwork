# OpenWork release procedure

OpenWork releases use only the `openwork-v*` tag namespace and the independent `openwork-release.yml` workflow. Upstream OpenCode publish workflows, credentials, tags, and release repositories are outside this release path.

## Required gates

1. Merge the release pull request into `openwork-main` after OpenWork CI passes.
2. Start an RC from the tested merge with either supported control event:
   - Push a `release-020-rcN` branch at the tested merge.
   - For GitHub App/API clients whose ref writes do not trigger Actions, create a same-repository `release-020-rcN` branch, add only `.github/openwork-release-control`, and open a pull request to `openwork-main`. The workflow releases the already-merged base commit, never the unmerged control commit.
     The release workflow derives `openwork-v0.2.0-rc.N`, rebuilds that version, runs lint, typechecking, unit tests, the production harness browser gate, the desktop build, Windows packaging, portable launch, silent NSIS install, installed launch, coexistence-marker verification, and silent uninstall. Only after every gate passes does it create the immutable RC tag. Successful control branches are removed, and control pull requests are closed automatically.
3. Inspect the prerelease assets, checksums, SBOM, workflow logs, and Windows launch result. Fix defects through a pull request and publish a new RC tag; never replace an existing tag or release asset.
4. After an RC passes without release-blocking defects, use `release-020` at the same or a later tested `openwork-main` commit through either the branch-push or control-PR event. The workflow requires a published 0.2.0 RC, repeats every gate, then creates `openwork-v0.2.0` and publishes it as the latest release.

## Artifact policy

The supported 0.2.0 deliverables are Windows 11 x64 NSIS and portable executables, Electron update metadata, SHA-256 checksums, and a CycloneDX 1.6 SBOM. Artifacts are generated from the release commit and uploaded by GitHub Actions; locally built binaries are not release inputs.

Windows signing is opt-in through the OpenWork signing configuration. If signing is not configured, the workflow publishes validated unsigned artifacts and the release notes retain the SmartScreen warning. A missing signing identity must not fall back to upstream OpenCode credentials.

## Rollback and recovery

- Published tags and assets are immutable. A defective RC is superseded by the next RC.
- A defective formal release is marked as affected and followed by a patch release; its tag is not moved.
- OpenWork uninstallation leaves user-created projects and isolated OpenWork user data intact. Configuration changes made by the Skills and MCP managers retain timestamped, recoverable backups.
- Updater metadata is served only from `holobunganan-sketch/openwork` releases and stable clients ignore prereleases.
