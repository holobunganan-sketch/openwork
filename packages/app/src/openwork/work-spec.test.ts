import { describe, expect, test } from "bun:test"
import { createWorkSpec, formatWorkSpecContext } from "./work-spec"

describe("OpenWork task specification", () => {
  test.each([
    ["把这些材料制作成一份可编辑的PPT", "presentation"],
    ["Analyze this dataset and return an xlsx workbook", "data"],
    ["检索相关学术文献并给出引用", "research"],
    ["Revise the manuscript and preserve its references", "document"],
    ["Fix the failing tests in this repository", "software"],
    ["Help me finish this work", "general"],
  ] as const)("classifies %s as %s", (prompt, kind) => {
    expect(createWorkSpec({ prompt }).kind).toBe(kind)
  })

  test("honors an explicit preset and trims the goal", () => {
    const spec = createWorkSpec({ prompt: "  summarize these results  ", kind: "document", autonomy: "plan" })
    expect(spec.goal).toBe("summarize these results")
    expect(spec.kind).toBe("document")
    expect(spec.autonomy).toBe("plan")
  })

  test("creates a synthetic execution contract with acceptance criteria", () => {
    const context = formatWorkSpecContext(
      createWorkSpec({ prompt: "Build a presentation", kind: "presentation", autonomy: "agent" }),
    )
    expect(context).toContain("<openwork_task_contract")
    expect(context).toContain("Execution mode: agent")
    expect(context).toContain("No text or objects overflow or overlap")
    expect(context).toContain("inspect=[source material and audience inspection]")
    expect(context).toContain("verify=[slide rendering and overflow inspection]")
    expect(context).toContain("verify")
  })
})
