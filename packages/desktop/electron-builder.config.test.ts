import { describe, expect, test } from "bun:test"

const channels = [
  { channel: "dev", appId: "io.github.holobunganansketch.openwork.dev", productName: "OpenWork Dev" },
  { channel: "beta", appId: "io.github.holobunganansketch.openwork.beta", productName: "OpenWork Beta" },
  { channel: "prod", appId: "io.github.holobunganansketch.openwork", productName: "OpenWork" },
] as const

const load = async (channel: (typeof channels)[number]["channel"], suffix: string) => {
  const previous = process.env.OPENCODE_CHANNEL
  process.env.OPENCODE_CHANNEL = channel
  const module = await import(`./electron-builder.config.ts?channel=${channel}&case=${suffix}`)
  if (previous === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous
  return module.default
}

describe("OpenWork desktop identity", () => {
  for (const channel of channels) {
    test(`isolates ${channel.channel} from OpenCode`, async () => {
      const config = await load(channel.channel, "identity")

      expect(config.appId).toBe(channel.appId)
      expect(config.productName).toBe(channel.productName)
      expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
      expect(config.linux?.executableName).toBe(channel.appId)
      expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
      expect(config.protocols).toEqual({ name: channel.productName, schemes: ["openwork"] })
      expect(config.win?.executableName).toBe("OpenWork")
      expect(JSON.stringify(config)).not.toContain("ai.opencode.desktop")
      expect(JSON.stringify(config)).not.toContain('"opencode"')
    })
  }

  test("uses the OpenWork repository as the only update source", async () => {
    for (const channel of ["beta", "prod"] as const) {
      const config = await load(channel, "updates")
      expect(config.publish).toEqual({
        provider: "github",
        owner: "holobunganan-sketch",
        repo: "openwork",
        channel: "latest",
      })
    }
  })

  test("builds an assisted per-user Windows installer", async () => {
    const config = await load("prod", "installer")
    expect(config.win?.target).toEqual(["nsis", "portable"])
    expect(config.nsis).toMatchObject({
      oneClick: false,
      perMachine: false,
      allowElevation: false,
      allowToChangeInstallationDirectory: true,
      createStartMenuShortcut: true,
      createDesktopShortcut: true,
      shortcutName: "OpenWork",
      artifactName: "OpenWork-Setup-${version}-windows-${arch}.${ext}",
    })
    expect(config.portable).toEqual({
      artifactName: "OpenWork-Portable-${version}-windows-${arch}.${ext}",
    })
  })
})
