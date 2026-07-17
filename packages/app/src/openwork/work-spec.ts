import { defaultWorkPermissions, type WorkPermissions } from "./work-permissions"
import { routeWorkSkills, type WorkSkillRouteStep } from "./work-skill-router"
import {
  compileWorkIntent,
  workOutputFormatLabel,
  type WorkIntent,
  type WorkKind,
  type WorkOutputFormat,
} from "./work-intent"

export type { WorkKind, WorkOutputFormat } from "./work-intent"

export type WorkAutonomy = "plan" | "collaborate" | "agent"

export type WorkSpec = {
  version: 1
  goal: string
  kind: WorkKind
  autonomy: WorkAutonomy
  deliverables: string[]
  acceptanceCriteria: string[]
  constraints: string[]
  requestedFormats: WorkOutputFormat[]
  intentConfidence: WorkIntent["confidence"]
  intentEvidence: string[]
  assumptions: string[]
  skillHints: string[]
  skillRoute: WorkSkillRouteStep[]
  questionPolicy: "only-material"
  permissions: WorkPermissions
}

const defaults: Record<WorkKind, { deliverables: string[]; acceptanceCriteria: string[] }> = {
  general: {
    deliverables: ["A complete result in the format implied by the request"],
    acceptanceCriteria: [
      "The result directly satisfies the stated goal",
      "Material assumptions are stated",
      "The result is checked before delivery",
    ],
  },
  document: {
    deliverables: ["An editable document in the requested format"],
    acceptanceCriteria: [
      "Content is complete and coherent",
      "Formatting is consistent",
      "Sources and references remain traceable",
      "The final file opens successfully",
    ],
  },
  research: {
    deliverables: ["A source-backed research brief or requested research artifact"],
    acceptanceCriteria: [
      "Claims are supported by relevant sources",
      "Uncertainty and evidence limits are clear",
      "Citations link to the claims they support",
      "The requested scope is covered",
    ],
  },
  data: {
    deliverables: ["A validated analysis and the requested data artifact"],
    acceptanceCriteria: [
      "Inputs and assumptions are checked",
      "Calculations and references are valid",
      "Findings answer the decision question",
      "The final artifact opens and updates correctly",
    ],
  },
  presentation: {
    deliverables: ["An editable presentation file"],
    acceptanceCriteria: [
      "The narrative has a clear progression",
      "Slides are readable and visually balanced",
      "No text or objects overflow or overlap",
      "The presentation renders and opens successfully",
    ],
  },
  software: {
    deliverables: ["A working implementation in the selected workspace"],
    acceptanceCriteria: [
      "The requested behavior is implemented",
      "Relevant tests and type checks pass",
      "Changes stay within the authorized scope",
      "The handoff identifies validation evidence",
    ],
  },
}

const harnessDefaults: Record<WorkKind, { assumptions: string[] }> = {
  general: {
    assumptions: ["Use the current workspace and attached materials as the source of truth"],
  },
  document: {
    assumptions: [
      "Prefer an editable deliverable and a professional neutral tone unless the source material says otherwise",
    ],
  },
  research: {
    assumptions: ["Prefer current primary or authoritative sources and make evidence limits explicit"],
  },
  data: {
    assumptions: [
      "Preserve the original data, make calculations reproducible, and prioritize decision-relevant findings",
    ],
  },
  presentation: {
    assumptions: ["Prefer an editable deck with a concise narrative and a restrained visual system"],
  },
  software: {
    assumptions: ["Preserve unrelated user changes and follow repository-local instructions before editing"],
  },
}

export function createWorkSpec(input: {
  prompt: string
  kind?: WorkKind
  autonomy?: WorkAutonomy
  permissions?: WorkPermissions
}): WorkSpec {
  const goal = input.prompt.trim()
  const intent = compileWorkIntent(goal)
  const kind = input.kind ?? intent.kind
  const autonomy = input.autonomy ?? "collaborate"
  const skillRoute = routeWorkSkills(kind)
  const deliverables = intent.requestedFormats.length
    ? intent.requestedFormats.map(deliverableForFormat)
    : defaults[kind].deliverables
  const acceptanceCriteria = unique([
    ...defaults[kind].acceptanceCriteria,
    ...intent.requestedFormats.map((format) => `The ${workOutputFormatLabel(format)} opens successfully`),
    ...intent.constraints.map((constraint) => `Requested constraint is satisfied: ${constraint}`),
  ])
  return {
    version: 1,
    goal,
    kind,
    autonomy,
    deliverables,
    acceptanceCriteria,
    constraints: intent.constraints,
    requestedFormats: intent.requestedFormats,
    intentConfidence: intent.confidence,
    intentEvidence: intent.evidence,
    assumptions: harnessDefaults[kind].assumptions,
    skillHints: skillRoute.map((step) => step.capability),
    skillRoute,
    questionPolicy: "only-material",
    permissions: input.permissions ?? defaultWorkPermissions(autonomy),
  }
}

export function normalizeWorkSpec(spec: WorkSpec): WorkSpec {
  const intent = compileWorkIntent(spec.goal)
  const defaults = harnessDefaults[spec.kind]
  const skillRoute = spec.skillRoute ?? routeWorkSkills(spec.kind)
  return {
    ...spec,
    constraints: spec.constraints ?? intent.constraints,
    requestedFormats: spec.requestedFormats ?? intent.requestedFormats,
    intentConfidence: spec.intentConfidence ?? intent.confidence,
    intentEvidence: spec.intentEvidence ?? intent.evidence,
    assumptions: spec.assumptions ?? defaults.assumptions,
    skillHints: spec.skillHints ?? skillRoute.map((step) => step.capability),
    skillRoute,
    questionPolicy: spec.questionPolicy ?? "only-material",
    permissions: spec.permissions ?? defaultWorkPermissions(spec.autonomy),
  }
}

export function migrateWorkSpec(value: unknown): WorkSpec | undefined {
  if (!isRecord(value) || typeof value.goal !== "string" || !value.goal.trim()) return undefined
  const intent = compileWorkIntent(value.goal)
  const kind = isWorkKind(value.kind) ? value.kind : intent.kind
  const autonomy = isWorkAutonomy(value.autonomy) ? value.autonomy : "collaborate"
  const base = createWorkSpec({
    prompt: value.goal,
    kind,
    autonomy,
    permissions: migratePermissions(value.permissions, autonomy),
  })
  const requestedFormats = stringArray(value.requestedFormats).filter(isWorkOutputFormat)
  const confidence = value.intentConfidence
  return normalizeWorkSpec({
    ...base,
    deliverables: stringArray(value.deliverables, base.deliverables),
    acceptanceCriteria: stringArray(value.acceptanceCriteria, base.acceptanceCriteria),
    constraints: stringArray(value.constraints, intent.constraints),
    requestedFormats: requestedFormats.length ? requestedFormats : intent.requestedFormats,
    intentConfidence:
      confidence === "low" || confidence === "medium" || confidence === "high" ? confidence : intent.confidence,
    intentEvidence: stringArray(value.intentEvidence, intent.evidence),
    assumptions: stringArray(value.assumptions, base.assumptions),
    skillHints: stringArray(value.skillHints, base.skillHints),
    skillRoute: migrateWorkSkillRoute(value.skillRoute, base.skillRoute),
    questionPolicy: "only-material",
  })
}

export function formatWorkSpecContext(spec: WorkSpec) {
  spec = normalizeWorkSpec(spec)
  const autonomy = {
    plan: "Inspect and plan only. Do not write files, run mutating commands, or perform external actions.",
    collaborate:
      "Proceed through safe, reversible work in the selected workspace. Ask only when a missing choice would materially change the result or when an external or destructive action needs approval.",
    agent:
      "Complete the task end to end inside the selected workspace. Make reasonable reversible assumptions, verify the result, and request approval for external, sensitive, or destructive actions.",
  }[spec.autonomy]
  return [
    '<openwork_task_contract version="1">',
    `Goal: ${spec.goal}`,
    `Work type: ${spec.kind}`,
    `Execution mode: ${spec.autonomy}. ${autonomy}`,
    `Expected deliverables: ${spec.deliverables.join("; ")}`,
    `Requested formats: ${spec.requestedFormats.length ? spec.requestedFormats.join("; ") : "none explicitly requested"}`,
    `Explicit constraints: ${spec.constraints.length ? spec.constraints.join("; ") : "none supplied"}`,
    `Intent inference: confidence=${spec.intentConfidence}; evidence=${spec.intentEvidence.join("; ") || "none"}`,
    `Acceptance criteria: ${spec.acceptanceCriteria.join("; ")}`,
    `Working assumptions: ${spec.assumptions.join("; ")}`,
    `Skill route: ${spec.skillRoute.map((step) => `${step.phase}=[${step.capability}]`).join(" -> ")}`,
    `Scoped permissions: ${Object.entries(spec.permissions)
      .map(([scope, decision]) => `${scope}=${decision}`)
      .join("; ")}`,
    "Question policy: ask only when a missing answer would materially change the deliverable, authorization, cost, or irreversible outcome. Otherwise state a reasonable reversible assumption and continue.",
    "Completion protocol: save deliverables in the selected workspace and run the route's type-specific verification. Do not claim completion without concrete evidence such as successful tests/builds, document or slide rendering, spreadsheet checks, citation traceability, or package smoke tests as applicable.",
    "First inspect the available workspace and attachments. Preserve user-authored work, compose only the skills needed for the task, continue until the acceptance criteria are verified, and report concrete evidence in the handoff.",
    "</openwork_task_contract>",
  ].join("\n")
}

function deliverableForFormat(format: WorkOutputFormat) {
  const article = ["docx", "pptx", "xlsx", "html"].includes(format) ? "An" : "A"
  return `${article} ${workOutputFormatLabel(format)}`
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback
  const result = value.filter((item): item is string => typeof item === "string" && !!item.trim())
  return result.length ? result : fallback
}

function isWorkKind(value: unknown): value is WorkKind {
  return workKinds.has(value)
}

function isWorkAutonomy(value: unknown): value is WorkAutonomy {
  return value === "plan" || value === "collaborate" || value === "agent"
}

function isWorkOutputFormat(value: string): value is WorkOutputFormat {
  return workOutputFormats.has(value)
}

function migrateWorkSkillRoute(value: unknown, fallback: WorkSkillRouteStep[]) {
  if (!Array.isArray(value)) return fallback
  const result = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.capability !== "string") return []
    if (!isWorkSkillPhase(item.phase) || typeof item.required !== "boolean") return []
    return [{ id: item.id, phase: item.phase, capability: item.capability, required: item.required }]
  })
  return result.length ? result : fallback
}

function isWorkSkillPhase(value: unknown): value is WorkSkillRouteStep["phase"] {
  return workSkillPhases.has(value)
}

function migratePermissions(value: unknown, autonomy: WorkAutonomy): WorkPermissions {
  const base = defaultWorkPermissions(autonomy)
  if (!isRecord(value)) return base
  const decision = (key: Exclude<keyof WorkPermissions, "destructive">) =>
    value[key] === "allow" || value[key] === "ask" ? value[key] : base[key]
  return {
    read: decision("read"),
    workspace: decision("workspace"),
    commands: decision("commands"),
    network: decision("network"),
    external: decision("external"),
    destructive: "ask",
  }
}

const workKinds = new Set<unknown>(["general", "document", "research", "data", "presentation", "software"])
const workOutputFormats = new Set<unknown>([
  "docx",
  "pdf",
  "markdown",
  "pptx",
  "xlsx",
  "csv",
  "json",
  "html",
  "zip",
  "windows-installer",
])
const workSkillPhases = new Set<unknown>(["inspect", "create", "verify"])
