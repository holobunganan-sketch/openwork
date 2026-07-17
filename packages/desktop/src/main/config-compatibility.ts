import { randomUUID } from "node:crypto"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { parse, type ParseError } from "jsonc-parser"

export const CONFIG_COMPATIBILITY_MODES = ["independent", "read", "import", "share"] as const
export type ConfigCompatibilityMode = (typeof CONFIG_COMPATIBILITY_MODES)[number]

type MutableEnvironment = Record<string, string | undefined>
type Scope = "config" | "data" | "cache" | "state"

export type OpenCodeSourcePaths = {
  base: Record<Scope, string>
  app: Record<Scope, string>
}

export type OpenWorkEnginePaths = OpenCodeSourcePaths

const APP_DIRECTORY = "opencode"
const CONFIG_LIMIT = 2 * 1024 * 1024
const AUTH_LIMIT = 5 * 1024 * 1024

export function isConfigCompatibilityMode(value: unknown): value is ConfigCompatibilityMode {
  return typeof value === "string" && CONFIG_COMPATIBILITY_MODES.includes(value as ConfigCompatibilityMode)
}

export function configCompatibilityModeFromEnv(env: MutableEnvironment) {
  const value = env.OPENWORK_CONFIG_MODE
  return isConfigCompatibilityMode(value) ? value : undefined
}

export function resolveOpenCodeSourcePaths(env: MutableEnvironment, home: string): OpenCodeSourcePaths {
  const base = {
    config: env.XDG_CONFIG_HOME ?? join(home, ".config"),
    data: env.XDG_DATA_HOME ?? join(home, ".local", "share"),
    cache: env.XDG_CACHE_HOME ?? join(home, ".cache"),
    state: env.XDG_STATE_HOME ?? join(home, ".local", "state"),
  }
  return {
    base,
    app: mapPaths(base, (value) => join(value, APP_DIRECTORY)),
  }
}

export function resolveOpenWorkEnginePaths(userDataPath: string): OpenWorkEnginePaths {
  const root = join(userDataPath, "engine")
  const base = {
    config: join(root, "config"),
    data: join(root, "data"),
    cache: join(root, "cache"),
    state: join(root, "state"),
  }
  return {
    base,
    app: mapPaths(base, (value) => join(value, APP_DIRECTORY)),
  }
}

export function applyConfigCompatibilityMode(input: {
  mode: ConfigCompatibilityMode
  source: OpenCodeSourcePaths
  userDataPath: string
  env?: MutableEnvironment
}) {
  const env = input.env ?? process.env
  const independent = resolveOpenWorkEnginePaths(input.userDataPath)

  delete env.OPENCODE_CONFIG_DIR
  delete env.OPENCODE_CONFIG_CONTENT
  delete env.OPENCODE_AUTH_CONTENT

  if (input.mode === "share") {
    applyBasePaths(env, input.source.base)
    return { effectiveMode: input.mode, paths: input.source }
  }

  applyBasePaths(env, independent.base)
  if (input.mode !== "read") return { effectiveMode: "independent" as const, paths: independent }

  const config = loadReadOnlyConfig(input.source.app.config)
  env.OPENCODE_CONFIG_CONTENT = JSON.stringify(config)

  const authPath = join(input.source.app.data, "auth.json")
  if (existsSync(authPath)) env.OPENCODE_AUTH_CONTENT = readRegularFile(authPath, AUTH_LIMIT)
  return { effectiveMode: input.mode, paths: independent }
}

export function importOpenCodeConfiguration(input: { source: OpenCodeSourcePaths; userDataPath: string }) {
  const target = resolveOpenWorkEnginePaths(input.userDataPath)
  const scopes = (["config", "data", "state"] as const).filter((scope) => existsSync(input.source.app[scope]))

  for (const scope of scopes) {
    validateTree(input.source.app[scope])
    if (existsSync(target.app[scope])) {
      throw new Error(`OpenWork ${scope} destination already exists; refusing to overwrite it`)
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = join(input.userDataPath, "migration-backups", `${stamp}-${randomUUID()}`)
  const stagingPath = join(input.userDataPath, "migration-staging", randomUUID())
  const installed: Scope[] = []

  try {
    for (const scope of scopes) copyTreeSafe(input.source.app[scope], join(backupPath, scope, APP_DIRECTORY))
    for (const scope of scopes) copyTreeSafe(input.source.app[scope], join(stagingPath, scope, APP_DIRECTORY))

    for (const scope of scopes) {
      mkdirSync(target.base[scope], { recursive: true, mode: 0o700 })
      renameSync(join(stagingPath, scope, APP_DIRECTORY), target.app[scope])
      installed.push(scope)
    }
  } catch (error) {
    for (const scope of installed.reverse()) rmSync(target.app[scope], { recursive: true, force: true })
    throw error
  } finally {
    rmSync(stagingPath, { recursive: true, force: true })
  }

  return { backupPath, installed }
}

function loadReadOnlyConfig(configDir: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const name of ["opencode.json", "opencode.jsonc"]) {
    const file = join(configDir, name)
    if (!existsSync(file)) continue
    const errors: ParseError[] = []
    const parsed = parse(readRegularFile(file, CONFIG_LIMIT), errors, { allowTrailingComma: true })
    if (errors.length > 0 || !isRecord(parsed)) throw new Error(`Existing OpenCode configuration is invalid: ${name}`)
    mergeRecord(result, parsed)
  }

  const current = isRecord(result.skills) ? result.skills : {}
  const paths = Array.isArray(current.paths)
    ? current.paths.filter((value): value is string => typeof value === "string")
    : []
  result.skills = { ...current, paths: [...new Set([...paths, configDir])] }
  return result
}

function readRegularFile(file: string, limit: number) {
  const info = lstatSync(file)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Refusing to read non-regular file: ${file}`)
  if (info.size > limit) throw new Error(`Refusing to read oversized compatibility file: ${file}`)
  return readFileSync(file, "utf8")
}

function validateTree(root: string) {
  const info = lstatSync(root)
  if (info.isSymbolicLink()) throw new Error(`Symbolic links and junctions are not allowed during import: ${root}`)
  if (info.isFile()) return
  if (!info.isDirectory()) throw new Error(`Unsupported file type during import: ${root}`)
  for (const entry of readdirSync(root)) validateTree(join(root, entry))
}

function copyTreeSafe(source: string, destination: string) {
  const info = lstatSync(source)
  if (info.isSymbolicLink()) throw new Error(`Symbolic links and junctions are not allowed during import: ${source}`)
  if (info.isDirectory()) {
    mkdirSync(destination, { recursive: true, mode: 0o700 })
    for (const entry of readdirSync(source)) copyTreeSafe(join(source, entry), join(destination, entry))
    return
  }
  if (!info.isFile()) throw new Error(`Unsupported file type during import: ${source}`)
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
  copyFileSync(source, destination)
  chmodSync(destination, info.mode & 0o777)
}

function applyBasePaths(env: MutableEnvironment, paths: Record<Scope, string>) {
  env.XDG_CONFIG_HOME = paths.config
  env.XDG_DATA_HOME = paths.data
  env.XDG_CACHE_HOME = paths.cache
  env.XDG_STATE_HOME = paths.state
}

function mapPaths<T extends Record<string, string>>(value: T, map: (value: string) => string): T {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, map(item)])) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mergeRecord(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(target[key])) {
      mergeRecord(target[key], value)
      continue
    }
    target[key] = value
  }
}
