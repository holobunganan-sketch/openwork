import { migrateWorkSpec, type WorkSpec } from "./work-spec"
import {
  mergeContextGraphs,
  type ContextGraph,
  type ContextSource,
  type ContextSourceKind,
  type ContextSourceProvenance,
} from "./context-graph"
import type {
  WorkArtifact,
  WorkArtifactKind,
  WorkVerificationCheck,
  WorkVerificationCheckID,
  WorkVerificationStatus,
} from "./artifact-verifier"
import type { WorkSkillPhase, WorkSkillRouteStep } from "./work-skill-router"

export type WorkTaskStatus = "draft" | "running" | "waiting" | "paused" | "ready" | "failed" | "completed"

export type WorkActivityKind =
  | "created"
  | "started"
  | "resumed"
  | "waiting"
  | "paused"
  | "ready"
  | "failed"
  | "checkpoint"
  | "verified"

export type WorkActivity = {
  id: string
  at: number
  kind: WorkActivityKind
  detail?: string
}

export type WorkCheckpoint = {
  id: string
  at: number
  label: string
  messageID?: string
}

export type WorkTask = {
  version: 1
  scope: string
  sessionID: string
  directory: string
  spec: WorkSpec
  context?: ContextGraph
  artifacts?: WorkArtifact[]
  verificationAt?: number
  status: WorkTaskStatus
  createdAt: number
  updatedAt: number
  activities: WorkActivity[]
  checkpoints: WorkCheckpoint[]
}

export type OpenWorkTaskStore = { items: Record<string, WorkTask> }

export function setWorkTaskContext(task: WorkTask, context: ContextGraph, at: number): WorkTask {
  return {
    ...task,
    context: mergeContextGraphs(task.context, context),
    updatedAt: at,
  }
}

export function setWorkTaskArtifacts(task: WorkTask, artifacts: WorkArtifact[], at: number): WorkTask {
  return {
    ...task,
    artifacts,
    verificationAt: at,
    updatedAt: at,
  }
}

const ACTIVITY_LIMIT = 100
const CHECKPOINT_LIMIT = 20

export function workTaskKey(scope: string, sessionID: string) {
  return `${scope}\n${sessionID}`
}

export function createWorkTask(input: {
  scope: string
  sessionID: string
  directory: string
  spec: WorkSpec
  at: number
  activityID: string
}): WorkTask {
  return {
    version: 1,
    scope: input.scope,
    sessionID: input.sessionID,
    directory: input.directory,
    spec: input.spec,
    status: "draft",
    createdAt: input.at,
    updatedAt: input.at,
    activities: [{ id: input.activityID, at: input.at, kind: "created" }],
    checkpoints: [],
  }
}

const activityForStatus: Record<Exclude<WorkTaskStatus, "draft">, WorkActivityKind> = {
  running: "started",
  waiting: "waiting",
  paused: "paused",
  ready: "ready",
  failed: "failed",
  completed: "verified",
}

export function transitionWorkTask(
  task: WorkTask,
  status: WorkTaskStatus,
  input: { at: number; activityID: string; detail?: string; resumed?: boolean },
): WorkTask {
  if (task.status === status) return task
  const kind =
    status === "draft" ? undefined : input.resumed && status === "running" ? "resumed" : activityForStatus[status]
  const activities = kind
    ? [...task.activities, { id: input.activityID, at: input.at, kind, detail: input.detail }].slice(-ACTIVITY_LIMIT)
    : task.activities
  return { ...task, status, updatedAt: input.at, activities }
}

export function addWorkCheckpoint(
  task: WorkTask,
  input: { at: number; checkpointID: string; activityID: string; label: string; messageID?: string },
): WorkTask {
  const checkpoint = {
    id: input.checkpointID,
    at: input.at,
    label: input.label,
    messageID: input.messageID,
  }
  const activity = {
    id: input.activityID,
    at: input.at,
    kind: "checkpoint" as const,
    detail: input.label,
  }
  return {
    ...task,
    updatedAt: input.at,
    activities: [...task.activities, activity].slice(-ACTIVITY_LIMIT),
    checkpoints: [...task.checkpoints, checkpoint].slice(-CHECKPOINT_LIMIT),
  }
}

export function migrateOpenWorkTaskStore(value: unknown): OpenWorkTaskStore {
  if (!isRecord(value) || !isRecord(value.items)) return { items: {} }
  const items: Record<string, WorkTask> = {}
  for (const raw of Object.values(value.items)) {
    if (!isRecord(raw)) continue
    if (typeof raw.scope !== "string" || typeof raw.sessionID !== "string" || typeof raw.directory !== "string") {
      continue
    }
    const spec = migrateWorkSpec(raw.spec)
    if (!spec) continue
    const createdAt = finiteNumber(raw.createdAt) ?? finiteNumber(raw.updatedAt) ?? 0
    const updatedAt = finiteNumber(raw.updatedAt) ?? createdAt
    const task: WorkTask = {
      version: 1,
      scope: raw.scope,
      sessionID: raw.sessionID,
      directory: raw.directory,
      spec,
      status: isWorkTaskStatus(raw.status) ? raw.status : "draft",
      createdAt,
      updatedAt,
      activities: migrateActivities(raw.activities),
      checkpoints: migrateCheckpoints(raw.checkpoints),
    }
    const context = migrateContextGraph(raw.context)
    if (context) task.context = context
    const artifacts = migrateArtifacts(raw.artifacts)
    if (artifacts) task.artifacts = artifacts
    const verificationAt = finiteNumber(raw.verificationAt)
    if (verificationAt !== undefined) task.verificationAt = verificationAt
    items[workTaskKey(task.scope, task.sessionID)] = task
  }
  return { items }
}

function migrateActivities(value: unknown): WorkActivity[] {
  if (!Array.isArray(value)) return []
  return value
    .flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || !isWorkActivityKind(item.kind)) return []
      const at = finiteNumber(item.at)
      if (at === undefined) return []
      return [{ id: item.id, at, kind: item.kind, detail: typeof item.detail === "string" ? item.detail : undefined }]
    })
    .slice(-ACTIVITY_LIMIT)
}

function migrateCheckpoints(value: unknown): WorkCheckpoint[] {
  if (!Array.isArray(value)) return []
  return value
    .flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.label !== "string") return []
      const at = finiteNumber(item.at)
      if (at === undefined) return []
      return [
        {
          id: item.id,
          at,
          label: item.label,
          messageID: typeof item.messageID === "string" ? item.messageID : undefined,
        },
      ]
    })
    .slice(-CHECKPOINT_LIMIT)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function isWorkTaskStatus(value: unknown): value is WorkTaskStatus {
  return workTaskStatuses.has(value)
}

function isWorkActivityKind(value: unknown): value is WorkActivityKind {
  return workActivityKinds.has(value)
}

function migrateContextGraph(value: unknown): ContextGraph | undefined {
  if (!isRecord(value) || typeof value.workspace !== "string") return undefined
  return {
    version: 1,
    workspace: value.workspace,
    sources: migrateContextSources(value.sources),
    assumptions: stringArray(value.assumptions),
    skillHints: stringArray(value.skillHints),
    skillRoute: migrateSkillRoute(value.skillRoute),
    questionPolicy: "only-material",
  }
}

function migrateContextSources(value: unknown): ContextSource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.label !== "string") return []
    if (!isContextSourceKind(item.kind) || !isContextSourceProvenance(item.provenance)) return []
    return [
      {
        id: item.id,
        kind: item.kind,
        label: item.label,
        provenance: item.provenance,
        path: typeof item.path === "string" ? item.path : undefined,
      },
    ]
  })
}

function migrateSkillRoute(value: unknown): WorkSkillRouteStep[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.capability !== "string") return []
    if (!isWorkSkillPhase(item.phase) || typeof item.required !== "boolean") return []
    return [{ id: item.id, phase: item.phase, capability: item.capability, required: item.required }]
  })
}

function migrateArtifacts(value: unknown): WorkArtifact[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return []
    if (!isWorkArtifactKind(item.kind) || !isWorkVerificationStatus(item.status)) return []
    const verifiedAt = finiteNumber(item.verifiedAt)
    if (verifiedAt === undefined) return []
    return [
      {
        id: item.id,
        name: item.name,
        kind: item.kind,
        path: typeof item.path === "string" ? item.path : undefined,
        changedFiles: stringArray(item.changedFiles),
        status: item.status,
        checks: migrateVerificationChecks(item.checks),
        verifiedAt,
      },
    ]
  })
}

function migrateVerificationChecks(value: unknown): WorkVerificationCheck[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item) || !isWorkVerificationCheckID(item.id) || !isWorkVerificationStatus(item.status)) return []
    return [
      { id: item.id, status: item.status, evidence: typeof item.evidence === "string" ? item.evidence : undefined },
    ]
  })
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function isContextSourceKind(value: unknown): value is ContextSourceKind {
  return contextSourceKinds.has(value)
}

function isContextSourceProvenance(value: unknown): value is ContextSourceProvenance {
  return contextSourceProvenances.has(value)
}

function isWorkSkillPhase(value: unknown): value is WorkSkillPhase {
  return workSkillPhases.has(value)
}

function isWorkArtifactKind(value: unknown): value is WorkArtifactKind {
  return workArtifactKinds.has(value)
}

function isWorkVerificationStatus(value: unknown): value is WorkVerificationStatus {
  return workVerificationStatuses.has(value)
}

function isWorkVerificationCheckID(value: unknown): value is WorkVerificationCheckID {
  return workVerificationCheckIDs.has(value)
}

const workTaskStatuses = new Set<unknown>(["draft", "running", "waiting", "paused", "ready", "failed", "completed"])
const workActivityKinds = new Set<unknown>([
  "created",
  "started",
  "resumed",
  "waiting",
  "paused",
  "ready",
  "failed",
  "checkpoint",
  "verified",
])
const contextSourceKinds = new Set<unknown>(["workspace", "file", "image", "agent", "memory"])
const contextSourceProvenances = new Set<unknown>([
  "workspace",
  "attachment",
  "context",
  "mention",
  "memory-user",
  "memory-project",
])
const workSkillPhases = new Set<unknown>(["inspect", "create", "verify"])
const workArtifactKinds = new Set<unknown>([
  "document",
  "presentation",
  "spreadsheet",
  "research",
  "software",
  "package",
  "file",
])
const workVerificationStatuses = new Set<unknown>(["passed", "warning", "failed"])
const workVerificationCheckIDs = new Set<unknown>([
  "exists",
  "nonempty",
  "format",
  "structure",
  "editable",
  "render",
  "citations",
  "formulas",
  "changes",
  "tests",
  "build",
  "smoke",
])
