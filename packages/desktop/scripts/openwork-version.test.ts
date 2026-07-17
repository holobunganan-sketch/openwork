import { describe, expect, test } from "bun:test"
import { assertOpenWorkVersion } from "./openwork-version"

describe("OpenWork 0.2 release versions", () => {
  test.each(["0.2.0", "0.2.0-rc.1", "0.2.0-rc.20"])("accepts %s", (version) => {
    expect(assertOpenWorkVersion(version)).toBe(version)
  })

  test.each([undefined, "", "0.1.0", "0.2.0-rc.0", "0.2.0-rc", "0.2.1", "0.2.0-beta.1"])("rejects %s", (version) => {
    expect(() => assertOpenWorkVersion(version)).toThrow("0.2.0 or 0.2.0-rc.N")
  })
})
