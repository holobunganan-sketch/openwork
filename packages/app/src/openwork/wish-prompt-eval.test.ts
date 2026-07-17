import { describe, expect, test } from "bun:test"
import { runWishPromptEvals, wishPromptEvalCases } from "./wish-prompt-eval"

describe("OpenWork wish-prompt evaluations", () => {
  test("compiles rough English and Chinese wishes into complete task contracts", () => {
    const report = runWishPromptEvals()
    expect(report.results.filter((result) => !result.passed)).toEqual([])
    expect(report.passed).toBe(wishPromptEvalCases.length)
    expect(report.score).toBe(1)
  })
})
