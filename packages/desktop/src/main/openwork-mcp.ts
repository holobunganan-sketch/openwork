import { createHash, randomUUID } from "node:crypto"
import { chmod, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser"
import type { OpenWorkMcpImportPreview, OpenWorkMcpMutationResult, OpenWorkMcpServer } from "@opencode-ai/app"

const CONFIG_LIMIT = 2 * 1024 * 1024
const IMPORT_LIMIT = 512 * 1024
const SERVER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/
const SECRET_KEY = /(token|secret|password|credential|api[-_]?key|authorization|private[-_]?key)/i
const NON_SECRET_HEADER = /^(accept|content-type|user-agent)$/i
const VAULT_ENV_PREFIX = "OPENWORK_MCP_SECRET_"

type McpServerConfig = Record<string, unknown> & {
  type: "local" | "remote"
  enabled?: boolean
}

type McpMap = Record<string, McpServerConfig>

type VaultCodec = {
  available(): boolean
  encrypt(value: string): Uint8Array
  decrypt(value: Uint8Array): string
}

type VaultDocument = {
  version: 1
  secrets: Record<string, string>
}

export type OpenWorkMcpManager = ReturnType<typeof createOpenWorkMcpManager>

export function createOpenWorkMcpManager(input: {
  configDir: string
  userDataPath: string
  codec: VaultCodec
  env?: Record<string, string | undefined>
  isSidecarRunning: () => boolean
}) {
  const env = input.env ?? process.env
  const vaultPath = join(input.userDataPath, "secrets", "mcp-vault.json")
  const backupRoot = join(input.configDir, ".openwork-backups", "mcp")
  let queue = Promise.resolve<unknown>(undefined)

  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation)
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async function list() {
    return serial(async () => views((await readConfiguration()).mcp))
  }

  async function previewImport(raw: string): Promise<OpenWorkMcpImportPreview> {
    const parsed = parseMcpImport(raw)
    const prepared = prepareSecrets(parsed.servers)
    return { servers: views(prepared.servers), format: parsed.format, warnings: prepared.warnings }
  }

  async function applyImport(raw: string): Promise<OpenWorkMcpMutationResult> {
    return serial(async () => {
      const imported = parseMcpImport(raw)
      const prepared = prepareSecrets(imported.servers)
      await persistSecrets(prepared.secrets)
      const current = await readConfiguration()
      const next = { ...current.mcp, ...prepared.servers }
      const backupCreated = await writeMcp(current, next)
      applySecretsToEnvironment(prepared.secrets)
      return mutationResult(next, backupCreated, input.isSidecarRunning())
    })
  }

  async function setEnabled(name: string, enabled: boolean): Promise<OpenWorkMcpMutationResult> {
    return serial(async () => {
      assertServerName(name)
      const current = await readConfiguration()
      const server = current.mcp[name]
      if (!server) throw new Error(`MCP server not found: ${name}`)
      const next = { ...current.mcp, [name]: { ...server, enabled } }
      const backupCreated = await writeMcp(current, next)
      return mutationResult(next, backupCreated, input.isSidecarRunning())
    })
  }

  async function remove(name: string): Promise<OpenWorkMcpMutationResult> {
    return serial(async () => {
      assertServerName(name)
      const current = await readConfiguration()
      if (!current.mcp[name]) throw new Error(`MCP server not found: ${name}`)
      const next = { ...current.mcp }
      delete next[name]
      const backupCreated = await writeMcp(current, next)
      return mutationResult(next, backupCreated, input.isSidecarRunning())
    })
  }

  async function restoreLatest(): Promise<OpenWorkMcpMutationResult> {
    return serial(async () => {
      const entries = await readdir(backupRoot, { withFileTypes: true }).catch(() => [])
      const latest = entries
        .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".json"))
        .map((entry) => join(backupRoot, entry.name))
        .sort()
        .at(-1)
      if (!latest) throw new Error("No MCP configuration backup is available")
      const backup = parseJsonRecord(await readRegularFile(latest, CONFIG_LIMIT), "MCP backup")
      const restored = validateMcpMap(backup.mcp ?? {})
      const current = await readConfiguration()
      const backupCreated = await writeMcp(current, restored)
      return mutationResult(restored, backupCreated, input.isSidecarRunning())
    })
  }

  async function hydrateSecrets() {
    const vault = await readVault()
    if (Object.keys(vault.secrets).length === 0) return 0
    if (!input.codec.available()) throw new Error("The operating-system credential store is unavailable")
    let count = 0
    for (const [name, encoded] of Object.entries(vault.secrets)) {
      assertVaultEnvironmentName(name)
      env[name] = input.codec.decrypt(Buffer.from(encoded, "base64"))
      count += 1
    }
    return count
  }

  async function readConfiguration() {
    const path = await resolveConfigPath(input.configDir)
    const exists = await fileExists(path)
    const content = exists ? await readRegularFile(path, CONFIG_LIMIT) : "{\n}\n"
    const errors: ParseError[] = []
    const parsed = parse(content, errors, { allowTrailingComma: true, disallowComments: false })
    if (errors.length > 0 || !isRecord(parsed)) throw new Error(`OpenWork configuration is invalid: ${path}`)
    return { path, content, mcp: validateMcpMap(parsed.mcp ?? {}) }
  }

  async function writeMcp(current: Awaited<ReturnType<typeof readConfiguration>>, mcp: McpMap) {
    const backupCreated = await backupMcp(current.mcp)
    const edits = modify(current.content, ["mcp"], mcp, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
      getInsertionIndex: (properties) => properties.length,
    })
    const content = applyEdits(current.content, edits)
    const errors: ParseError[] = []
    const checked = parse(content, errors, { allowTrailingComma: true, disallowComments: false })
    if (errors.length > 0 || !isRecord(checked)) throw new Error("MCP update produced invalid JSONC")
    await atomicWrite(current.path, content)
    return backupCreated
  }

  async function backupMcp(mcp: McpMap) {
    await mkdir(backupRoot, { recursive: true, mode: 0o700 })
    const path = join(backupRoot, `${timestamp()}-${randomUUID()}.json`)
    await writeFile(path, `${JSON.stringify({ version: 1, createdAt: Date.now(), mcp }, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    })
    return true
  }

  async function persistSecrets(secrets: Record<string, string>) {
    if (Object.keys(secrets).length === 0) return
    if (!input.codec.available()) {
      throw new Error("Cannot import MCP secrets because the operating-system credential store is unavailable")
    }
    const vault = await readVault()
    for (const [name, secret] of Object.entries(secrets)) {
      assertVaultEnvironmentName(name)
      vault.secrets[name] = Buffer.from(input.codec.encrypt(secret)).toString("base64")
    }
    await atomicWrite(vaultPath, `${JSON.stringify(vault, null, 2)}\n`, 0o600)
  }

  async function readVault(): Promise<VaultDocument> {
    if (!(await fileExists(vaultPath))) return { version: 1, secrets: {} }
    const parsed = parseJsonRecord(await readRegularFile(vaultPath, CONFIG_LIMIT), "MCP secret vault")
    if (parsed.version !== 1 || !isRecord(parsed.secrets)) throw new Error("MCP secret vault has an unsupported format")
    const secrets = Object.fromEntries(
      Object.entries(parsed.secrets).map(([name, value]) => {
        assertVaultEnvironmentName(name)
        if (typeof value !== "string") throw new Error("MCP secret vault contains an invalid entry")
        return [name, value]
      }),
    )
    return { version: 1, secrets }
  }

  function applySecretsToEnvironment(secrets: Record<string, string>) {
    for (const [name, value] of Object.entries(secrets)) env[name] = value
  }

  return { list, previewImport, applyImport, setEnabled, remove, restoreLatest, hydrateSecrets }
}

export function parseMcpImport(raw: string): {
  servers: McpMap
  format: OpenWorkMcpImportPreview["format"]
} {
  if (Buffer.byteLength(raw, "utf8") > IMPORT_LIMIT) throw new Error("MCP import is too large")
  const errors: ParseError[] = []
  const parsed = parse(raw, errors, { allowTrailingComma: true, disallowComments: false })
  if (errors.length > 0 || !isRecord(parsed)) throw new Error("MCP import must be valid JSON or JSONC")
  if (isRecord(parsed.mcp)) return { servers: validateMcpMap(parsed.mcp), format: "opencode" }
  if (isRecord(parsed.mcpServers)) {
    return { servers: convertClaudeServers(parsed.mcpServers), format: "claude" }
  }
  return { servers: validateMcpMap(parsed), format: "server-map" }
}

function convertClaudeServers(value: Record<string, unknown>): McpMap {
  return Object.fromEntries(
    Object.entries(value).map(([name, server]) => {
      assertServerName(name)
      if (!isRecord(server)) throw new Error(`MCP server ${name} must be an object`)
      if (typeof server.url === "string") {
        return [
          name,
          validateServer(name, {
            type: "remote",
            url: server.url,
            headers: server.headers,
            enabled: server.disabled === true ? false : server.enabled,
          }),
        ]
      }
      if (typeof server.command !== "string") throw new Error(`Claude MCP server ${name} is missing command or url`)
      if (server.args !== undefined && !isStringArray(server.args)) {
        throw new Error(`Claude MCP server ${name} args must be an array of strings`)
      }
      return [
        name,
        validateServer(name, {
          type: "local",
          command: [server.command, ...(server.args ?? [])],
          environment: server.env,
          cwd: server.cwd,
          enabled: server.disabled === true ? false : server.enabled,
        }),
      ]
    }),
  )
}

function validateMcpMap(value: unknown): McpMap {
  if (!isRecord(value)) throw new Error("MCP configuration must be an object")
  return Object.fromEntries(
    Object.entries(value).map(([name, server]) => {
      assertServerName(name)
      if (!isRecord(server)) throw new Error(`MCP server ${name} must be an object`)
      return [name, validateServer(name, server)]
    }),
  )
}

function validateServer(name: string, input: Record<string, unknown>): McpServerConfig {
  const type = input.type ?? (typeof input.url === "string" ? "remote" : "local")
  if (type === "local") {
    if (!isStringArray(input.command) || input.command.length === 0 || input.command.some((part) => !part.trim())) {
      throw new Error(`Local MCP server ${name} requires a non-empty command array`)
    }
    if (input.environment !== undefined && !isStringRecord(input.environment)) {
      throw new Error(`Local MCP server ${name} environment must contain string values`)
    }
    if (input.cwd !== undefined && typeof input.cwd !== "string")
      throw new Error(`Local MCP server ${name} cwd is invalid`)
  } else if (type === "remote") {
    if (typeof input.url !== "string") throw new Error(`Remote MCP server ${name} requires a URL`)
    validateRemoteUrl(name, input.url)
    if (input.headers !== undefined && !isStringRecord(input.headers)) {
      throw new Error(`Remote MCP server ${name} headers must contain string values`)
    }
  } else {
    throw new Error(`MCP server ${name} has unsupported type: ${JSON.stringify(type)}`)
  }
  if (input.enabled !== undefined && typeof input.enabled !== "boolean")
    throw new Error(`MCP server ${name} enabled is invalid`)
  if (input.timeout !== undefined && (!Number.isFinite(input.timeout) || Number(input.timeout) <= 0)) {
    throw new Error(`MCP server ${name} timeout is invalid`)
  }
  const result: McpServerConfig = { ...input, type }
  return structuredClone(result)
}

function prepareSecrets(servers: McpMap) {
  const secrets: Record<string, string> = {}
  const warnings: string[] = []
  const prepared = structuredClone(servers)
  for (const [name, server] of Object.entries(prepared)) {
    const fields: Array<{ container: Record<string, unknown>; key: string; path: string }> = []
    if (isRecord(server.environment)) {
      for (const key of Object.keys(server.environment)) {
        if (SECRET_KEY.test(key)) fields.push({ container: server.environment, key, path: `environment.${key}` })
      }
    }
    if (isRecord(server.headers)) {
      for (const key of Object.keys(server.headers)) {
        if (!NON_SECRET_HEADER.test(key)) fields.push({ container: server.headers, key, path: `headers.${key}` })
      }
    }
    if (isRecord(server.oauth) && typeof server.oauth.clientSecret === "string") {
      fields.push({ container: server.oauth, key: "clientSecret", path: "oauth.clientSecret" })
    }
    if (server.type === "remote" && typeof server.url === "string" && !/^\{env:[^}]+\}$/.test(server.url)) {
      const url = new URL(server.url)
      const hasSecretQuery = [...url.searchParams.keys()].some((key) => SECRET_KEY.test(key))
      if (url.username || url.password || hasSecretQuery) {
        fields.push({ container: server, key: "url", path: "url" })
      }
    }
    for (const field of fields) {
      const value = field.container[field.key]
      if (typeof value !== "string" || /^\{env:[^}]+\}$/.test(value)) continue
      const variable = secretEnvironmentName(name, field.path)
      secrets[variable] = value
      field.container[field.key] = `{env:${variable}}`
      warnings.push(`${name}.${field.path} will be stored in the encrypted OpenWork vault`)
    }
    if (server.type === "local" && Array.isArray(server.command)) {
      for (let index = 1; index < server.command.length; index += 1) {
        const argument = server.command[index]
        if (typeof argument !== "string") continue
        const inline = argument.match(/^(--?[^=]*(?:token|secret|password|credential|api[-_]?key)[^=]*)=(.+)$/i)
        if (inline) {
          const path = `command.${index}`
          const variable = secretEnvironmentName(name, path)
          secrets[variable] = inline[2]!
          server.command[index] = `${inline[1]}={env:${variable}}`
          warnings.push(`${name}.${path} will be stored in the encrypted OpenWork vault`)
          continue
        }
        if (!/^--?/.test(argument) || !SECRET_KEY.test(argument)) continue
        const next = server.command[index + 1]
        if (typeof next !== "string" || next.startsWith("-")) continue
        const path = `command.${index + 1}`
        const variable = secretEnvironmentName(name, path)
        secrets[variable] = next
        server.command[index + 1] = `{env:${variable}}`
        warnings.push(`${name}.${path} will be stored in the encrypted OpenWork vault`)
        index += 1
      }
    }
  }
  return { servers: prepared, secrets, warnings }
}

function views(servers: McpMap): OpenWorkMcpServer[] {
  return Object.entries(servers)
    .map(([name, server]) => {
      const secretFields: string[] = []
      collectSecretFields(server, "", secretFields)
      const summary =
        server.type === "remote"
          ? redactUrl(typeof server.url === "string" ? server.url : "")
          : Array.isArray(server.command)
            ? redactCommand(server.command)
            : ""
      return {
        name,
        type: server.type,
        enabled: server.enabled !== false,
        summary,
        secretFields: [...new Set(secretFields)].sort(),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function collectSecretFields(value: unknown, path: string, result: string[]) {
  if (typeof value === "string" && /^\{env:OPENWORK_MCP_SECRET_[A-Z0-9_]+\}$/.test(value)) {
    result.push(path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectSecretFields(child, path ? `${path}.${index}` : String(index), result))
    return
  }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) collectSecretFields(child, path ? `${path}.${key}` : key, result)
}

function mutationResult(mcp: McpMap, backupCreated: boolean, restartRequired: boolean): OpenWorkMcpMutationResult {
  return { servers: views(mcp), backupCreated, restartRequired }
}

async function resolveConfigPath(configDir: string) {
  const jsonc = join(configDir, "opencode.jsonc")
  const json = join(configDir, "opencode.json")
  if (await fileExists(jsonc)) return jsonc
  if (await fileExists(json)) return json
  return jsonc
}

async function atomicWrite(path: string, content: string, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, content, { encoding: "utf8", mode })
    await chmod(temporary, mode)
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

async function readRegularFile(path: string, limit: number) {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Refusing to read non-regular file: ${path}`)
  if (info.size > limit) throw new Error(`Refusing to read oversized file: ${path}`)
  return readFile(path, "utf8")
}

async function fileExists(path: string) {
  return lstat(path).then(
    () => true,
    () => false,
  )
}

function parseJsonRecord(raw: string, label: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${label} is invalid`)
  }
  if (!isRecord(parsed)) throw new Error(`${label} must be an object`)
  return parsed
}

function assertServerName(name: string) {
  if (!SERVER_NAME.test(name) || name === "__proto__" || name === "constructor" || name === "prototype") {
    throw new Error(`Invalid MCP server name: ${name}`)
  }
}

function validateRemoteUrl(name: string, value: string) {
  if (/^\{env:[A-Za-z_][A-Za-z0-9_]*\}$/.test(value)) return
  const expanded = value.replace(/\{env:[A-Za-z_][A-Za-z0-9_]*\}/g, "openwork-placeholder")
  let url: URL
  try {
    url = new URL(expanded)
  } catch {
    throw new Error(`Remote MCP server ${name} URL is invalid`)
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Remote MCP server ${name} URL is invalid`)
  }
}

function secretEnvironmentName(server: string, path: string) {
  const suffix = `${server}_${path}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const hash = createHash("sha256").update(`${server}\0${path}`).digest("hex").slice(0, 10).toUpperCase()
  return `${VAULT_ENV_PREFIX}${suffix}`.slice(0, 168) + `_${hash}`
}

function assertVaultEnvironmentName(name: string) {
  if (!name.startsWith(VAULT_ENV_PREFIX) || !/^[A-Z0-9_]+$/.test(name)) throw new Error("Invalid MCP vault key")
}

function redactUrl(value: string) {
  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return "remote server"
  }
}

function redactCommand(command: unknown[]) {
  const output: string[] = []
  for (let index = 0; index < Math.min(command.length, 4); index += 1) {
    const argument = command[index]
    if (typeof argument !== "string") continue
    const inline = argument.match(/^(--?[^=]*(?:token|secret|password|credential|api[-_]?key)[^=]*)=/i)
    if (inline) {
      output.push(`${inline[1]}=<redacted>`)
      continue
    }
    output.push(argument)
    if (index > 0 && /^--?/.test(argument) && SECRET_KEY.test(argument)) {
      if (index + 1 < command.length) output.push("<redacted>")
      index += 1
    }
  }
  return output.join(" ")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string")
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}
