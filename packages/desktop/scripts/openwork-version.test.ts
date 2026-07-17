import { describe, expect, test } from "bun:test"
import { assertOpenWorkVersion } from "./openwork-version"

describe("OpenWork 0.2.1 release versions", () => {
  test.each(["0.2.1", "0.2.1-rc.1", "0.2.1-rc.20"])("accepts %s", (version) => {
    expect(assertOpenWorkVersion(version)).toBe(version)
  })

  test.each([
    undefined,
    null,
    201,
    "",
    "0.1.0",
    "0.2.0",
    "0.2.01",
    "0.2.1-rc.0",
    "0.2.1-rc",
    "0.2.2",
    "0.2.1-beta.1",
  ])(
    "rejects %s",
    (version) => {
      expect(() => assertOpenWorkVersion(version)).toThrow("0.2.1 or 0.2.1-rc.N")
    },
  )
})
