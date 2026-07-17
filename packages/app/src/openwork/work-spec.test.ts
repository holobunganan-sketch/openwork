import { describe, expect, test } from "bun:test"
import { createWorkSpec, formatWorkSpecContext, migrateWorkSpec } from "./work-spec"

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
      createWorkSpec({
        prompt: "Build a presentation",
        kind: "presentation",
        autonomy: "agent",
        workspace: "C:/Work/Quarterly",
        model: { providerID: "opencode-go", modelID: "gpt-5", name: "GPT-5", variant: "high" },
      }),
    )
    expect(context).toContain("<openwork_task_contract")
    expect(context).toContain("Execution mode: agent")
    expect(context).toContain("Workspace: C:/Work/Quarterly")
    expect(context).toContain("Model: GPT-5 (high)")
    expect(context).toContain("No text or objects overflow or overlap")
    expect(context).toContain("inspect=[source material and audience inspection]")
    expect(context).toContain("verify=[slide rendering and overflow inspection]")
    expect(context).toContain("Do not claim completion without concrete evidence")
    expect(context).toContain("verify")
  })

  test("makes inferred formats and constraints visible to the harness", () => {
    const spec = createWorkSpec({
      prompt: "Make a board-ready editable PPTX by Monday in at most 8 slides",
    })
    const context = formatWorkSpecContext(spec)

    expect(spec.kind).toBe("presentation")
    expect(spec.requestedFormats).toEqual(["pptx"])
    expect(spec.constraints).toEqual(
      expect.arrayContaining(["Maximum 8 slides", "Audience: board members", "Deliverable remains editable"]),
    )
    expect(context).toContain("Requested formats: pptx")
    expect(context).toContain("Explicit constraints: Maximum 8 slides")
    expect(context).toContain("Intent inference: confidence=")
  })

  test("migrates an old task contract without losing user-authored fields", () => {
    const migrated = migrateWorkSpec({
      version: 1,
      goal: "Analyze this table and return an editable XLSX",
      kind: "data",
      autonomy: "collaborate",
      deliverables: ["My existing workbook"],
      acceptanceCriteria: ["Totals reconcile"],
      permissions: { read: "allow", workspace: "allow", commands: "ask" },
      workspace: " C:/Work/Analysis ",
      model: { providerID: "opencode-go", modelID: "gpt-5", name: " GPT-5 " },
    })

    expect(migrated?.deliverables).toEqual(["My existing workbook"])
    expect(migrated?.acceptanceCriteria).toEqual(["Totals reconcile"])
    expect(migrated?.requestedFormats).toEqual(["xlsx"])
    expect(migrated?.constraints).toContain("Deliverable remains editable")
    expect(migrated?.permissions.destructive).toBe("ask")
    expect(migrated?.workspace).toBe("C:/Work/Analysis")
    expect(migrated?.model).toEqual({ providerID: "opencode-go", modelID: "gpt-5", name: "GPT-5" })
  })
})
