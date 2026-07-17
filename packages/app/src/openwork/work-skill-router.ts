import type { WorkKind } from "./work-spec"

export type WorkSkillPhase = "inspect" | "create" | "verify"

export type WorkSkillRouteStep = {
  id: string
  phase: WorkSkillPhase
  capability: string
  required: boolean
}

const routes: Record<WorkKind, Omit<WorkSkillRouteStep, "id">[]> = {
  general: [
    { phase: "inspect", capability: "workspace and attachment inspection", required: true },
    { phase: "create", capability: "task-specific artifact creation", required: true },
    { phase: "verify", capability: "result verification", required: true },
  ],
  document: [
    { phase: "inspect", capability: "source and reference inspection", required: true },
    { phase: "create", capability: "editable document creation", required: true },
    { phase: "verify", capability: "document rendering and reference verification", required: true },
  ],
  research: [
    { phase: "inspect", capability: "source discovery and evidence screening", required: true },
    { phase: "create", capability: "source-backed synthesis", required: true },
    { phase: "verify", capability: "claim and citation validation", required: true },
  ],
  data: [
    { phase: "inspect", capability: "data quality assessment", required: true },
    { phase: "create", capability: "reproducible analysis and visualization", required: true },
    { phase: "verify", capability: "calculation and artifact validation", required: true },
  ],
  presentation: [
    { phase: "inspect", capability: "source material and audience inspection", required: true },
    { phase: "create", capability: "editable presentation creation", required: true },
    { phase: "verify", capability: "slide rendering and overflow inspection", required: true },
  ],
  software: [
    { phase: "inspect", capability: "repository and instruction inspection", required: true },
    { phase: "create", capability: "scoped software implementation", required: true },
    { phase: "verify", capability: "tests and build verification", required: true },
  ],
}

export function routeWorkSkills(kind: WorkKind): WorkSkillRouteStep[] {
  return routes[kind].map((step, index) => ({ ...step, id: `${step.phase}-${index + 1}` }))
}
