import { describe, expect, test } from "bun:test"
import { estimateLocalUsage } from "./openwork-usage"

describe("OpenWork Go usage fallback", () => {
  test("aggregates local rolling windows without claiming official usage", () => {
    const now = Date.UTC(2026, 6, 17, 12)
    const usage = estimateLocalUsage(
      [
        { cost: 3, updatedAt: now - 60 * 60 * 1000 },
        { cost: 4, updatedAt: now - 2 * 24 * 60 * 60 * 1000 },
        { cost: 5, updatedAt: now - 20 * 24 * 60 * 60 * 1000 },
        { cost: 100, updatedAt: now - 40 * 24 * 60 * 60 * 1000 },
      ],
      now,
    )
    expect(usage.source).toBe("local-estimate")
    expect(usage.periods.map((period) => [period.id, period.used, period.limit])).toEqual([
      ["five-hour", 3, 12],
      ["weekly", 7, 30],
      ["monthly", 12, 60],
    ])
  })
})
