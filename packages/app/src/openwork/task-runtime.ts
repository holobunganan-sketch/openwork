import type { WorkSpec } from "./work-spec"
import { mergeContextGraphs, type ContextGraph } from "./context-graph"

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
  status: WorkTaskStatus
  createdAt: number
  updatedAt: number
  activities: WorkActivity[]
  checkpoints: WorkCheckpoint[]
}

export function setWorkTaskContext(task: WorkTask, context: ContextGraph, at: number): WorkTask {
  return {
    ...task,
    context: mergeContextGraphs(task.context, context),
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
