import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createOpenWorkMcpManager, parseMcpImport } from "./openwork-mcp"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("OpenWork MCP manager", () => {
  test("imports Claude JSON and converts stdio shape", () => {
    const result = parseMcpImport(`{
      // Claude Desktop format
      "mcpServers": {
        "docs": { "command": "npx", "args": ["-y", "docs-mcp"], "env": { "API_KEY": "secret" } }
      }
    }`)
    expect(result.format).toBe("claude")
    expect(result.servers.docs?.command).toEqual(["npx", "-y", "docs-mcp"])
  })

  test("masks command secrets and accepts environment-backed remote URLs", async () => {
    const root = await mkdtemp(join(tmpdir(), "openwork-mcp-preview-test-"))
    roots.push(root)
    const manager = createOpenWorkMcpManager({
      configDir: join(root, "config"),
      userDataPath: join(root, "user-data"),
      isSidecarRunning: () => false,
      codec: {
        available: () => true,
        encrypt: (value) => Buffer.from(value),
        decrypt: (value) => Buffer.from(value).toString(),
      },
    })
    const preview = await manager.previewImport(`{
      "command-server": { "command": ["npx", "tool", "--api-key", "top-secret"] },
      "remote-server": { "type": "remote", "url": "{env:MCP_ENDPOINT}" }
    }`)
    expect(preview.servers.find((server) => server.name === "command-server")?.secretFields).toEqual(["command.3"])
    expect(preview.servers.find((server) => server.name === "command-server")?.summary).not.toContain("top-secret")
    expect(preview.servers.find((server) => server.name === "remote-server")?.summary).toBe("remote server")
  })

  test("preserves JSONC comments, encrypts secrets, and restores backups", async () => {
    const root = await mkdtemp(join(tmpdir(), "openwork-mcp-test-"))
    roots.push(root)
    const configDir = join(root, "config")
    await mkdir(configDir, { recursive: true })
    await writeFile(
      join(configDir, "opencode.jsonc"),
      '{\n  // keep this setting\n  "theme": "system",\n  "mcp": {}\n}\n',
    )
    const environment: Record<string, string | undefined> = {}
    const manager = createOpenWorkMcpManager({
      configDir,
      userDataPath: join(root, "user-data"),
      isSidecarRunning: () => true,
      env: environment,
      codec: {
        available: () => true,
        encrypt: (value) => Buffer.from(value.split("").reverse().join("")),
        decrypt: (value) => Buffer.from(value).toString().split("").reverse().join(""),
      },
    })

    const result = await manager.applyImport(`{
      "mcp": {
        "remote-docs": {
          "type": "remote",
          "url": "https://example.com/mcp?private=true",
          "headers": { "Authorization": "Bearer top-secret" }
        }
      }
    }`)
    expect(result.restartRequired).toBe(true)
    expect(result.servers[0]?.summary).toBe("https://example.com")
    expect(result.servers[0]?.secretFields).toEqual(["headers.Authorization"])

    const config = await readFile(join(configDir, "opencode.jsonc"), "utf8")
    expect(config).toContain("// keep this setting")
    const variable = config.match(/\{env:(OPENWORK_MCP_SECRET_REMOTE_DOCS_HEADERS_AUTHORIZATION_[A-F0-9]+)\}/)?.[1]
    expect(variable).toBeDefined()
    expect(config).not.toContain("top-secret")
    expect(environment[variable!]).toBe("Bearer top-secret")

    await manager.remove("remote-docs")
    expect(await manager.list()).toEqual([])
    await manager.restoreLatest()
    expect((await manager.list())[0]?.name).toBe("remote-docs")

    delete environment[variable!]
    await manager.hydrateSecrets()
    expect(environment[variable!]).toBe("Bearer top-secret")
  })
})
