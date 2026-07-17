import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  applyConfigCompatibilityMode,
  importOpenCodeConfiguration,
  resolveOpenCodeSourcePaths,
  resolveOpenWorkEnginePaths,
} from "./config-compatibility"

const roots: string[] = []
const makeRoot = (name = "openwork-兼容-") => {
  const root = mkdtempSync(join(tmpdir(), name))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("OpenWork configuration compatibility", () => {
  test("uses isolated engine paths by default", () => {
    const userDataPath = join(makeRoot(), "OpenWork 用户数据")
    const source = resolveOpenCodeSourcePaths({}, join(makeRoot(), "home"))
    const env: Record<string, string | undefined> = {}

    const result = applyConfigCompatibilityMode({ mode: "independent", source, userDataPath, env })

    expect(result.paths).toEqual(resolveOpenWorkEnginePaths(userDataPath))
    expect(env.XDG_CONFIG_HOME).toBe(join(userDataPath, "engine", "config"))
    expect(env.OPENCODE_CONFIG_CONTENT).toBeUndefined()
    expect(env.OPENCODE_AUTH_CONTENT).toBeUndefined()
  })

  test("reads existing JSONC and auth through memory without pointing writes at OpenCode", () => {
    const home = makeRoot()
    const source = resolveOpenCodeSourcePaths({}, home)
    const userDataPath = join(makeRoot(), "desktop")
    mkdirSync(source.app.config, { recursive: true })
    mkdirSync(source.app.data, { recursive: true })
    writeFileSync(join(source.app.config, "opencode.jsonc"), '{\n // keep source untouched\n "theme": "system",\n}\n')
    writeFileSync(join(source.app.data, "auth.json"), '{"provider":{"type":"api","key":"secret"}}')
    const env: Record<string, string | undefined> = {}

    applyConfigCompatibilityMode({ mode: "read", source, userDataPath, env })

    expect(env.XDG_CONFIG_HOME).toBe(join(userDataPath, "engine", "config"))
    expect(env.OPENCODE_CONFIG_DIR).toBeUndefined()
    expect(JSON.parse(env.OPENCODE_CONFIG_CONTENT ?? "{}")).toMatchObject({
      theme: "system",
      skills: { paths: [source.app.config] },
    })
    expect(JSON.parse(env.OPENCODE_AUTH_CONTENT ?? "{}").provider.key).toBe("secret")
    expect(readFileSync(join(source.app.config, "opencode.jsonc"), "utf8")).toContain("keep source untouched")
  })

  test("shares the original XDG roots only after explicit selection", () => {
    const source = resolveOpenCodeSourcePaths({ XDG_CONFIG_HOME: "/source/config" }, "/home/person")
    const env: Record<string, string | undefined> = { OPENCODE_CONFIG_CONTENT: "sensitive" }

    const result = applyConfigCompatibilityMode({ mode: "share", source, userDataPath: "/openwork", env })

    expect(result.paths).toBe(source)
    expect(env.XDG_CONFIG_HOME).toBe("/source/config")
    expect(env.XDG_DATA_HOME).toBe("/home/person/.local/share")
    expect(env.OPENCODE_CONFIG_CONTENT).toBeUndefined()
  })

  test("backs up and imports configuration without changing the source", () => {
    const home = makeRoot()
    const userDataPath = join(makeRoot(), "OpenWork 数据")
    const source = resolveOpenCodeSourcePaths({}, home)
    mkdirSync(join(source.app.config, "skills", "报告助手"), { recursive: true })
    mkdirSync(source.app.data, { recursive: true })
    writeFileSync(join(source.app.config, "opencode.json"), '{"theme":"dark"}')
    writeFileSync(join(source.app.config, "skills", "报告助手", "SKILL.md"), "---\nname: report\n---\n")
    writeFileSync(join(source.app.data, "auth.json"), '{"token":"kept-private"}')

    const result = importOpenCodeConfiguration({ source, userDataPath })
    const target = resolveOpenWorkEnginePaths(userDataPath)

    expect(readFileSync(join(target.app.config, "opencode.json"), "utf8")).toBe('{"theme":"dark"}')
    expect(readFileSync(join(result.backupPath, "data", "opencode", "auth.json"), "utf8")).toContain("kept-private")
    expect(readFileSync(join(source.app.config, "opencode.json"), "utf8")).toBe('{"theme":"dark"}')
  })

  test("refuses symlinks and leaves no partial destination", () => {
    const source = resolveOpenCodeSourcePaths({}, makeRoot())
    const userDataPath = join(makeRoot(), "desktop")
    mkdirSync(source.app.config, { recursive: true })
    writeFileSync(join(source.app.config, "outside.json"), "{}")
    symlinkSync(join(source.app.config, "outside.json"), join(source.app.config, "opencode.json"))

    expect(() => importOpenCodeConfiguration({ source, userDataPath })).toThrow("Symbolic links")
    expect(existsSync(resolveOpenWorkEnginePaths(userDataPath).app.config)).toBe(false)
  })

  test("never overwrites an existing OpenWork engine directory", () => {
    const source = resolveOpenCodeSourcePaths({}, makeRoot())
    const userDataPath = join(makeRoot(), "desktop")
    const target = resolveOpenWorkEnginePaths(userDataPath)
    mkdirSync(source.app.config, { recursive: true })
    mkdirSync(target.app.config, { recursive: true })
    writeFileSync(join(source.app.config, "opencode.json"), "{}")

    expect(() => importOpenCodeConfiguration({ source, userDataPath })).toThrow("refusing to overwrite")
  })
})
