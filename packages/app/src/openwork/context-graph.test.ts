import { describe, expect, test } from "bun:test"
import { createContextGraph, formatContextGraph } from "./context-graph"
import { createWorkSpec } from "./work-spec"

describe("OpenWork context graph", () => {
  test("deduplicates sources while retaining provenance", () => {
    const graph = createContextGraph({
      workspace: "/work",
      workSpec: createWorkSpec({ prompt: "Analyze the attached data" }),
      sources: [
        { kind: "file", label: "data.csv", path: "/work/data.csv", provenance: "attachment" },
        { kind: "file", label: "data.csv", path: "/work/data.csv", provenance: "context" },
      ],
    })

    expect(graph.sources).toHaveLength(2)
    expect(graph.sources[1]).toMatchObject({ path: "/work/data.csv", provenance: "attachment" })
  })

  test("formats provenance, assumptions, skills, and question policy as model context", () => {
    const graph = createContextGraph({
      workspace: "/work",
      workSpec: createWorkSpec({ prompt: "Research this topic", kind: "research" }),
    })
    const context = formatContextGraph(graph)

    expect(context).toContain("<openwork_context_graph")
    expect(context).toContain("provenance=workspace")
    expect(context).toContain("Skill route: inspect=")
    expect(context).toContain("verify=[claim and citation validation]")
    expect(context).toContain("pause only for a material choice")
  })
})
