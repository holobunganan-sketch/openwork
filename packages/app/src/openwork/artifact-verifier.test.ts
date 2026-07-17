import { describe, expect, test } from "bun:test"
import {
  collectWorkArtifactEvidence,
  discoverWorkArtifactCandidates,
  verifyWorkArtifacts,
  type WorkArtifactContent,
} from "./artifact-verifier"

const content = (value: string, type: "text" | "binary" = "text"): WorkArtifactContent => ({
  type,
  content: value,
  encoding: type === "binary" ? "base64" : undefined,
})

describe("OpenWork artifact verifier", () => {
  test("discovers the requested artifact type and ignores deleted files", () => {
    const result = discoverWorkArtifactCandidates({
      workKind: "presentation",
      workspace: "/work",
      diffs: [
        { file: "deck.pptx", status: "added" },
        { file: "render.py", status: "added" },
        { file: "old.pptx", status: "deleted" },
      ],
      parts: [],
    })

    expect(result.map((item) => item.path)).toEqual(["deck.pptx"])
    expect(result[0]?.kind).toBe("presentation")
  })

  test("requires presentation rendering evidence before passing", () => {
    const [candidate] = discoverWorkArtifactCandidates({
      workKind: "presentation",
      workspace: "/work",
      diffs: [{ file: "deck.pptx", status: "added" }],
      parts: [],
    })
    const pending = verifyWorkArtifacts({
      candidates: [candidate!],
      contents: { "deck.pptx": content("UEsDB", "binary") },
      evidence: { commands: [], tools: [] },
      at: 10,
    })
    const verified = verifyWorkArtifacts({
      candidates: [candidate!],
      contents: { "deck.pptx": content("UEsDB", "binary") },
      evidence: { commands: ["python render_slides.py deck.pptx"], tools: ["bash"] },
      at: 20,
    })

    expect(pending[0]?.status).toBe("warning")
    expect(verified[0]?.status).toBe("passed")
  })

  test("aggregates software changes and recognizes successful tests and builds", () => {
    const parts = [
      { type: "tool", tool: "bash", state: { status: "completed", input: { command: "bun test" } } },
      { type: "tool", tool: "bash", state: { status: "completed", input: { command: "bun run build" } } },
    ]
    const [candidate] = discoverWorkArtifactCandidates({
      workKind: "software",
      workspace: "/repo",
      diffs: [
        { file: "src/app.ts", status: "modified" },
        { file: "src/app.test.ts", status: "added" },
      ],
      parts,
    })
    const [artifact] = verifyWorkArtifacts({
      candidates: [candidate!],
      contents: {},
      evidence: collectWorkArtifactEvidence(parts),
      at: 20,
    })

    expect(artifact?.status).toBe("passed")
    expect(artifact?.changedFiles).toHaveLength(2)
  })

  test("detects citation markers in research deliverables", () => {
    const [candidate] = discoverWorkArtifactCandidates({
      workKind: "research",
      workspace: "/work",
      diffs: [{ file: "brief.md", status: "added" }],
      parts: [],
    })
    const [artifact] = verifyWorkArtifacts({
      candidates: [candidate!],
      contents: { "brief.md": content("# Brief\n\nSupported claim ([source](https://example.com)).") },
      evidence: { commands: [], tools: [] },
      at: 30,
    })

    expect(artifact?.checks.find((check) => check.id === "citations")?.status).toBe("passed")
    expect(artifact?.status).toBe("passed")
  })
})
