import { normalizeWorkSpec, type WorkSpec } from "./work-spec"
import type { WorkSkillRouteStep } from "./work-skill-router"

export type ContextSourceKind = "workspace" | "file" | "image" | "agent" | "memory"
export type ContextSourceProvenance =
  | "workspace"
  | "attachment"
  | "context"
  | "mention"
  | "memory-user"
  | "memory-project"

export type ContextSource = {
  id: string
  kind: ContextSourceKind
  label: string
  provenance: ContextSourceProvenance
  path?: string
}

export type ContextGraph = {
  version: 1
  workspace: string
  sources: ContextSource[]
  assumptions: string[]
  skillHints: string[]
  skillRoute: WorkSkillRouteStep[]
  questionPolicy: "only-material"
}

export function createContextGraph(input: {
  workspace: string
  workSpec: WorkSpec
  sources?: Omit<ContextSource, "id">[]
}): ContextGraph {
  const workSpec = normalizeWorkSpec(input.workSpec)
  const supplied = input.sources ?? []
  const all: Omit<ContextSource, "id">[] = [
    {
      kind: "workspace",
      label: input.workspace,
      path: input.workspace,
      provenance: "workspace",
    },
    ...supplied,
  ]
  const seen = new Set<string>()
  const sources = all.flatMap((source) => {
    const key =
      source.kind === "memory"
        ? `${source.kind}\n${source.provenance}\n${source.label}`
        : `${source.kind}\n${source.path ?? source.label}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...source, id: `source-${seen.size}` }]
  })
  return {
    version: 1,
    workspace: input.workspace,
    sources,
    assumptions: workSpec.assumptions,
    skillHints: workSpec.skillHints,
    skillRoute: workSpec.skillRoute,
    questionPolicy: workSpec.questionPolicy,
  }
}

export function mergeContextGraphs(current: ContextGraph | undefined, next: ContextGraph): ContextGraph {
  if (!current) return next
  const seen = new Set<string>()
  const sources = [...current.sources, ...next.sources].flatMap((source) => {
    const key =
      source.kind === "memory"
        ? `${source.kind}\n${source.provenance}\n${source.label}`
        : `${source.kind}\n${source.path ?? source.label}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...source, id: `source-${seen.size}` }]
  })
  return {
    ...next,
    sources,
    assumptions: [...new Set([...current.assumptions, ...next.assumptions])],
    skillHints: [...new Set([...current.skillHints, ...next.skillHints])],
    skillRoute: next.skillRoute,
  }
}

export function formatContextGraph(graph: ContextGraph) {
  const sources = graph.sources.map((source) => {
    const path = source.path ? ` path=${JSON.stringify(source.path)}` : ""
    return `- [${source.id}] kind=${source.kind} provenance=${source.provenance}${path} label=${JSON.stringify(source.label)}`
  })
  return [
    '<openwork_context_graph version="1">',
    `Workspace: ${graph.workspace}`,
    "Sources:",
    ...sources,
    `Assumptions: ${graph.assumptions.join("; ")}`,
    `Skill route: ${graph.skillRoute.map((step) => `${step.phase}=[${step.capability}]`).join(" -> ")}`,
    "Provenance policy: use the source identifiers when describing material inputs, keep sourced facts distinct from inferred assumptions, and identify any source that could not be inspected.",
    "Question policy: continue with reversible assumptions; pause only for a material choice, missing authorization, secret, external side effect, or destructive action.",
    "</openwork_context_graph>",
  ].join("\n")
}
