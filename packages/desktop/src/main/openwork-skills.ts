import { randomUUID } from "node:crypto"
import { cp, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join, posix, relative, resolve, sep } from "node:path"
import { BlobReader, BlobWriter, ZipReader, ZipWriter } from "@zip.js/zip.js"
import type { OpenWorkSkill, OpenWorkSkillInstallResult, OpenWorkSkillZipPreview } from "@opencode-ai/app"

const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024
const MAX_ENTRY_BYTES = 2 * 1024 * 1024
const MAX_EXPANDED_BYTES = 25 * 1024 * 1024
const MAX_ENTRIES = 512
const MAX_SKILL_FILE_BYTES = 256 * 1024
const MAX_DISCOVERY_DEPTH = 6
const MAX_DISCOVERY_DIRECTORIES = 512
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

type SkillSource = OpenWorkSkill["source"]

type SkillLocation = {
  path: string
  enabled: boolean
  managed: boolean
  source: SkillSource
}

type ZipEntryLike = {
  filename: string
  directory?: boolean
  uncompressedSize?: number
  externalFileAttributes?: number
  getData?: (writer: BlobWriter) => Promise<Blob>
}

export type OpenWorkSkillsManager = ReturnType<typeof createOpenWorkSkillsManager>

export function createOpenWorkSkillsManager(input: { configDir: string; homeDir: string; readOnlyRoots?: string[] }) {
  const enabledRoot = join(input.configDir, "skills")
  const disabledRoot = join(input.configDir, "skills-disabled")
  const backupRoot = join(input.configDir, ".openwork-backups", "skills")
  const stagingRoot = join(input.configDir, ".openwork-staging", "skills")

  async function list() {
    const roots: Array<{
      root: string
      enabled: boolean
      managed: boolean
      source: SkillSource
      recursive: boolean
    }> = [
      { root: enabledRoot, enabled: true, managed: true, source: "openwork", recursive: false },
      { root: disabledRoot, enabled: false, managed: true, source: "openwork", recursive: false },
      {
        root: join(input.configDir, "skill"),
        enabled: true,
        managed: false,
        source: "openwork",
        recursive: true,
      },
      {
        root: join(input.homeDir, ".agents", "skills"),
        enabled: true,
        managed: false,
        source: "agents",
        recursive: true,
      },
      {
        root: join(input.homeDir, ".claude", "skills"),
        enabled: true,
        managed: false,
        source: "claude",
        recursive: true,
      },
      ...(input.readOnlyRoots ?? []).map((root) => ({
        root,
        enabled: true,
        managed: false,
        source: "opencode" as const,
        recursive: true,
      })),
    ]
    const found = await Promise.all(roots.map(scanRoot))
    const unique = new Map<string, OpenWorkSkill>()
    for (const skill of found.flat()) {
      const key = `${skill.source}:${skill.id}`
      if (!unique.has(key)) unique.set(key, skill)
    }
    const backupEntries = await readdir(backupRoot, { withFileTypes: true }).catch(() => [])
    for (const entry of backupEntries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !ID_PATTERN.test(entry.name)) continue
      const key = `openwork:${entry.name}`
      if (unique.has(key)) continue
      const backup = await latestBackup(entry.name)
      if (!backup) continue
      const skill = await readSkill(
        { path: backup, enabled: false, managed: true, source: "openwork" },
        entry.name,
      ).catch(() => undefined)
      if (skill) unique.set(key, { ...skill, installed: false, enabled: false, hasBackup: true })
    }
    return [...unique.values()].sort((a, b) => Number(b.managed) - Number(a.managed) || a.name.localeCompare(b.name))
  }

  async function scanRoot(root: {
    root: string
    enabled: boolean
    managed: boolean
    source: SkillSource
    recursive: boolean
  }) {
    const skills: OpenWorkSkill[] = []
    const pending = [{ path: root.root, depth: 0 }]
    let inspected = 0
    while (pending.length > 0 && inspected < MAX_DISCOVERY_DIRECTORIES) {
      const current = pending.shift()!
      inspected += 1
      const entries = await readdir(current.path, { withFileTypes: true }).catch(() => [])
      const manifest = entries.find((entry) => entry.name === "SKILL.md" && entry.isFile() && !entry.isSymbolicLink())
      if (current.depth > 0 && manifest) {
        const skill = await readSkill({ ...root, path: current.path }, basename(current.path)).catch(() => undefined)
        if (skill) skills.push(skill)
        continue
      }
      const maxDepth = root.recursive ? MAX_DISCOVERY_DEPTH : 1
      if (current.depth >= maxDepth) continue
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          pending.push({ path: join(current.path, entry.name), depth: current.depth + 1 })
        }
      }
    }
    return skills
  }

  async function readSkill(location: SkillLocation, fallbackID: string): Promise<OpenWorkSkill> {
    const manifestPath = join(location.path, "SKILL.md")
    const info = await lstat(manifestPath)
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SKILL_FILE_BYTES) {
      throw new Error(`Invalid SKILL.md for ${fallbackID}`)
    }
    const metadata = parseSkillManifest(await readFile(manifestPath, "utf8"))
    const id = normalizeSkillID(metadata.name || fallbackID)
    const updatedAt = (await stat(location.path)).mtimeMs
    const hasBackup = location.managed && (await latestBackup(id)) !== undefined
    return {
      id,
      name: metadata.name || fallbackID,
      description: metadata.description,
      installed: true,
      enabled: location.enabled,
      managed: location.managed,
      source: location.source,
      updatedAt,
      hasBackup,
    }
  }

  async function installZip(data: ArrayBuffer | Uint8Array): Promise<OpenWorkSkillInstallResult> {
    const bytes = validateZipBytes(data)
    await mkdir(stagingRoot, { recursive: true, mode: 0o700 })
    const stage = join(stagingRoot, randomUUID())
    await mkdir(stage, { recursive: true, mode: 0o700 })
    const reader = new ZipReader(new BlobReader(new Blob([copyArrayBuffer(bytes)])))
    let target: string | undefined
    let backup: string | undefined
    try {
      const entries = (await reader.getEntries()) as ZipEntryLike[]
      const plan = await validateArchive(entries)
      const metadata = parseSkillManifest(await readZipText(plan.manifest))
      if (!metadata.name) throw new Error("SKILL.md frontmatter must include a name")
      const id = normalizeSkillID(metadata.name)
      const files = plan.files.map((item) => ({ ...item, relative: stripSkillRoot(item.path, plan.root) }))
      for (const file of files) {
        const destination = safeJoin(stage, file.relative)
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
        const blob = await file.entry.getData?.(new BlobWriter())
        if (!blob) throw new Error(`Unable to read ${file.path}`)
        const buffer = new Uint8Array(await blob.arrayBuffer())
        if (buffer.byteLength > MAX_ENTRY_BYTES) throw new Error(`Skill file is too large: ${file.path}`)
        await writeFile(destination, buffer, { mode: 0o600 })
      }
      await validateExtractedTree(stage)

      await mkdir(enabledRoot, { recursive: true, mode: 0o700 })
      target = join(enabledRoot, id)
      const disabledTarget = join(disabledRoot, id)
      const existing = (await exists(target)) ? target : (await exists(disabledTarget)) ? disabledTarget : undefined
      if (existing) backup = await moveToBackup(id, existing, "replace")
      try {
        await rename(stage, target)
      } catch (error) {
        if (backup) await restoreBackupPath(backup, existing ?? target).catch(() => undefined)
        throw error
      }
      const skill = await readSkill({ path: target, enabled: true, managed: true, source: "openwork" }, id)
      return { skill, replaced: Boolean(existing), backupCreated: Boolean(backup) }
    } finally {
      await reader.close().catch(() => undefined)
      await rm(stage, { recursive: true, force: true })
    }
  }

  async function previewZip(data: ArrayBuffer | Uint8Array): Promise<OpenWorkSkillZipPreview> {
    const bytes = validateZipBytes(data)
    const reader = new ZipReader(new BlobReader(new Blob([copyArrayBuffer(bytes)])))
    try {
      const plan = await validateArchive((await reader.getEntries()) as ZipEntryLike[])
      const metadata = parseSkillManifest(await readZipText(plan.manifest))
      if (!metadata.name) throw new Error("SKILL.md frontmatter must include a name")
      const id = normalizeSkillID(metadata.name)
      return {
        id,
        name: metadata.name,
        description: metadata.description,
        fileCount: plan.files.length,
        uncompressedBytes: plan.expanded,
        replacesExisting: (await managedPath(id)) !== undefined,
      }
    } finally {
      await reader.close().catch(() => undefined)
    }
  }

  async function setEnabled(id: string, enabled: boolean) {
    assertManagedID(id)
    const source = join(enabled ? disabledRoot : enabledRoot, id)
    const destination = join(enabled ? enabledRoot : disabledRoot, id)
    if (!(await exists(source))) {
      if (await exists(destination)) return list()
      throw new Error(`Managed skill not found: ${id}`)
    }
    if (await exists(destination)) throw new Error(`Skill destination already exists: ${id}`)
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
    await rename(source, destination)
    return list()
  }

  async function uninstall(id: string) {
    assertManagedID(id)
    const current = await managedPath(id)
    if (!current) throw new Error(`Managed skill not found: ${id}`)
    await moveToBackup(id, current, "uninstall")
    return list()
  }

  async function rollback(id: string) {
    assertManagedID(id)
    const backup = await latestBackup(id)
    if (!backup) throw new Error(`No backup is available for ${id}`)
    const current = await managedPath(id)
    if (current) await moveToBackup(id, current, "pre-rollback")
    await mkdir(enabledRoot, { recursive: true, mode: 0o700 })
    await restoreBackupPath(backup, join(enabledRoot, id))
    return list()
  }

  async function exportZip(id: string) {
    assertManagedID(id)
    const root = await managedPath(id)
    if (!root) throw new Error(`Managed skill not found: ${id}`)
    const files = await collectFiles(root)
    const writer = new ZipWriter(new BlobWriter("application/zip"))
    try {
      for (const file of files) {
        const data = await readFile(file.path)
        await writer.add(
          `${id}/${file.relative.split(sep).join("/")}`,
          new BlobReader(new Blob([copyArrayBuffer(data)])),
        )
      }
      const blob = await writer.close()
      return new Uint8Array(await blob.arrayBuffer())
    } catch (error) {
      await writer.close().catch(() => undefined)
      throw error
    }
  }

  async function validateArchive(entries: ZipEntryLike[]) {
    if (entries.length === 0 || entries.length > MAX_ENTRIES) throw new Error("Skill ZIP has an invalid entry count")
    let expanded = 0
    const files: Array<{ entry: ZipEntryLike; path: string }> = []
    const seen = new Set<string>()
    for (const entry of entries) {
      const path = normalizeZipPath(entry.filename)
      if (!path || entry.directory || path.endsWith("/")) continue
      if (isMetadataPath(path)) continue
      const collisionKey = path.toLocaleLowerCase("en-US")
      if (seen.has(collisionKey)) throw new Error(`Skill ZIP contains a duplicate path: ${path}`)
      seen.add(collisionKey)
      if (isSymbolicLink(entry)) throw new Error(`Symbolic links are not allowed in skill ZIPs: ${path}`)
      const size = entry.uncompressedSize
      if (size === undefined || !Number.isSafeInteger(size) || size < 0 || size > MAX_ENTRY_BYTES) {
        throw new Error(`Skill file has an invalid expanded size: ${path}`)
      }
      expanded += size
      if (expanded > MAX_EXPANDED_BYTES) throw new Error("Skill ZIP expands beyond the allowed size")
      if (!entry.getData) throw new Error(`Unsupported ZIP entry: ${path}`)
      files.push({ entry, path })
    }
    const manifests = files.filter((file) => posix.basename(file.path) === "SKILL.md")
    if (manifests.length !== 1) throw new Error("Skill ZIP must contain exactly one SKILL.md")
    const manifest = manifests[0]
    const root = posix.dirname(manifest.path) === "." ? "" : posix.dirname(manifest.path)
    if (files.some((file) => root && file.path !== root && !file.path.startsWith(`${root}/`))) {
      throw new Error("Skill ZIP contains files outside its skill directory")
    }
    return { root, manifest: manifest.entry, files, expanded }
  }

  async function readZipText(entry: ZipEntryLike) {
    const blob = await entry.getData?.(new BlobWriter("text/plain"))
    if (!blob || blob.size > MAX_SKILL_FILE_BYTES) throw new Error("SKILL.md is missing or too large")
    return blob.text()
  }

  async function managedPath(id: string) {
    for (const root of [enabledRoot, disabledRoot]) {
      const path = join(root, id)
      if (await exists(path)) return path
    }
    return undefined
  }

  async function moveToBackup(id: string, source: string, reason: string) {
    const destination = join(backupRoot, id, `${timestamp()}-${reason}-${randomUUID()}`)
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
    await rename(source, destination)
    return destination
  }

  async function latestBackup(id: string) {
    const root = join(backupRoot, id)
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    return entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => join(root, entry.name))
      .sort()
      .at(-1)
  }

  async function restoreBackupPath(source: string, destination: string) {
    if (await exists(destination)) throw new Error(`Refusing to overwrite restore destination: ${destination}`)
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
    try {
      await rename(source, destination)
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EXDEV") throw error
      await cp(source, destination, { recursive: true, errorOnExist: true })
      await rm(source, { recursive: true, force: true })
    }
  }

  let queue = Promise.resolve()
  function serial<T>(operation: () => Promise<T>) {
    const result = queue.then(operation, operation)
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    list: () => serial(list),
    previewZip: (data: ArrayBuffer | Uint8Array) => serial(() => previewZip(data)),
    installZip: (data: ArrayBuffer | Uint8Array) => serial(() => installZip(data)),
    setEnabled: (id: string, enabled: boolean) => serial(() => setEnabled(id, enabled)),
    uninstall: (id: string) => serial(() => uninstall(id)),
    rollback: (id: string) => serial(() => rollback(id)),
    exportZip: (id: string) => serial(() => exportZip(id)),
  }
}

export function parseSkillManifest(markdown: string) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/)
  if (!match) return { name: "", description: "" }
  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/)
    if (!item) continue
    fields[item[1].toLowerCase()] = unquote(item[2])
  }
  return {
    name: (fields.name ?? "").trim().slice(0, 120),
    description: (fields.description ?? "").trim().slice(0, 500),
  }
}

export function normalizeSkillID(name: string) {
  const id = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "")
  if (!ID_PATTERN.test(id)) throw new Error("Skill name must contain letters or numbers")
  return id
}

export function normalizeZipPath(value: string) {
  if (value.includes("\0")) throw new Error("Skill ZIP contains a null byte in a path")
  const path = value.replace(/\\/g, "/")
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path)) throw new Error(`Absolute ZIP path is not allowed: ${value}`)
  const normalized = posix.normalize(path).replace(/^\.\//, "")
  if (normalized === ".." || normalized.startsWith("../"))
    throw new Error(`ZIP path traversal is not allowed: ${value}`)
  return normalized
}

function stripSkillRoot(path: string, root: string) {
  if (!root) return path
  return path.slice(root.length + 1)
}

function safeJoin(root: string, value: string) {
  const destination = resolve(root, value)
  const scope = `${resolve(root)}${sep}`
  if (destination !== resolve(root) && !destination.startsWith(scope)) throw new Error(`Unsafe skill path: ${value}`)
  return destination
}

function isSymbolicLink(entry: ZipEntryLike) {
  const mode = ((entry.externalFileAttributes ?? 0) >>> 16) & 0xffff
  return (mode & 0xf000) === 0xa000
}

function isMetadataPath(path: string) {
  return path === ".DS_Store" || path.startsWith("__MACOSX/") || path.endsWith("/.DS_Store")
}

function assertManagedID(id: string) {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid managed skill ID")
}

async function validateExtractedTree(root: string) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Extracted skill contains a symbolic link: ${path}`)
    if (entry.isDirectory()) await validateExtractedTree(path)
    else if (!entry.isFile()) throw new Error(`Extracted skill contains an unsupported file: ${path}`)
  }
  const manifest = await lstat(join(root, "SKILL.md"))
  if (!manifest.isFile() || manifest.isSymbolicLink()) throw new Error("Extracted skill is missing SKILL.md")
}

async function collectFiles(root: string, current = root): Promise<Array<{ path: string; relative: string }>> {
  const result: Array<{ path: string; relative: string }> = []
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Refusing to export symbolic link: ${path}`)
    if (entry.isDirectory()) result.push(...(await collectFiles(root, path)))
    else if (entry.isFile()) result.push({ path, relative: relative(root, path) })
    else throw new Error(`Refusing to export unsupported file: ${path}`)
  }
  return result.sort((a, b) => a.relative.localeCompare(b.relative))
}

async function exists(path: string) {
  return lstat(path).then(
    () => true,
    () => false,
  )
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function copyArrayBuffer(value: Uint8Array) {
  const result = new ArrayBuffer(value.byteLength)
  new Uint8Array(result).set(value)
  return result
}

function validateZipBytes(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`Skill ZIP must be between 1 byte and ${MAX_ARCHIVE_BYTES} bytes`)
  }
  return bytes
}
