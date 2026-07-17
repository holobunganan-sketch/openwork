import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { BlobReader, BlobWriter, ZipWriter } from "@zip.js/zip.js"
import { createOpenWorkSkillsManager, normalizeSkillID, normalizeZipPath, parseSkillManifest } from "./openwork-skills"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("OpenWork skills", () => {
  test("parses manifests and rejects unsafe paths", () => {
    expect(parseSkillManifest('---\nname: "Report Helper"\ndescription: Draft reports\n---\n# Skill')).toEqual({
      name: "Report Helper",
      description: "Draft reports",
    })
    expect(normalizeSkillID("Report Helper")).toBe("report-helper")
    expect(() => normalizeZipPath("../escape.txt")).toThrow("traversal")
    expect(() => normalizeZipPath("C:\\escape.txt")).toThrow("Absolute")
  })

  test("installs, exports, disables, uninstalls, and rolls back a ZIP", async () => {
    const root = await mkdtemp(join(tmpdir(), "openwork-skills-test-"))
    roots.push(root)
    const manager = createOpenWorkSkillsManager({ configDir: join(root, "config"), homeDir: join(root, "home") })
    const writer = new ZipWriter(new BlobWriter("application/zip"))
    await writer.add(
      "report-helper/SKILL.md",
      new BlobReader(new Blob(["---\nname: Report Helper\ndescription: Draft reports\n---\n# Report Helper\n"])),
    )
    await writer.add("report-helper/reference.md", new BlobReader(new Blob(["reference"])))
    await writer.add("report-helper/agents/reviewer.md", new BlobReader(new Blob(["nested helper"])))
    const zip = new Uint8Array(await (await writer.close()).arrayBuffer())

    const preview = await manager.previewZip(zip)
    expect(preview).toMatchObject({ id: "report-helper", fileCount: 3, replacesExisting: false })
    const installed = await manager.installZip(zip)
    expect(installed.skill.id).toBe("report-helper")
    expect(installed.skill.installed).toBe(true)
    expect(installed.replaced).toBe(false)
    expect((await manager.list())[0]?.enabled).toBe(true)

    expect((await manager.previewZip(zip)).replacesExisting).toBe(true)

    const exported = await manager.exportZip("report-helper")
    expect(exported.byteLength).toBeGreaterThan(0)
    expect(await readFile(join(root, "config", "skills", "report-helper", "reference.md"), "utf8")).toBe("reference")
    expect(await readFile(join(root, "config", "skills", "report-helper", "agents", "reviewer.md"), "utf8")).toBe(
      "nested helper",
    )

    await manager.setEnabled("report-helper", false)
    expect((await manager.list())[0]?.enabled).toBe(false)
    await manager.uninstall("report-helper")
    expect(await manager.list()).toMatchObject([
      { id: "report-helper", installed: false, enabled: false, managed: true, hasBackup: true },
    ])
    await manager.rollback("report-helper")
    expect((await manager.list())[0]).toMatchObject({ installed: true, enabled: true })
  })

  test("discovers nested OpenCode, Agents, and Claude skills without managing them", async () => {
    const root = await mkdtemp(join(tmpdir(), "openwork-skills-discovery-test-"))
    roots.push(root)
    const configDir = join(root, "config")
    const homeDir = join(root, "home")
    const sourceConfigDir = join(root, "source-config")
    const locations = [
      join(configDir, "skill", "team", "legacy"),
      join(homeDir, ".agents", "skills", "writing", "editor"),
      join(homeDir, ".claude", "skills", "reviewer"),
      join(sourceConfigDir, "skills", "shared"),
    ]
    await Promise.all(
      locations.map(async (location, index) => {
        await mkdir(location, { recursive: true })
        await writeFile(join(location, "SKILL.md"), `---\nname: Discovered ${index}\n---\n`)
      }),
    )
    const manager = createOpenWorkSkillsManager({ configDir, homeDir, readOnlyRoots: [sourceConfigDir] })
    const skills = await manager.list()
    expect(skills).toHaveLength(4)
    expect(skills.map((skill) => skill.source).sort()).toEqual(["agents", "claude", "opencode", "openwork"])
    expect(skills.every((skill) => skill.installed && !skill.managed)).toBe(true)
  })
})
