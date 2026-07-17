import { describe, expect, test } from "bun:test"
import { addWorkCheckpoint, createWorkTask, setWorkTaskContext, transitionWorkTask, workTaskKey } from "./task-runtime"
import { createContextGraph } from "./context-graph"
import { createWorkSpec } from "./work-spec"

const spec = createWorkSpec({ prompt: "Create a report", autonomy: "collaborate" })

describe("OpenWork task runtime", () => {
  test("creates a durable task identity and initial journal entry", () => {
    const task = createWorkTask({
      scope: "local",
      sessionID: "session-1",
      directory: "/workspace",
      spec,
      at: 10,
      activityID: "activity-1",
    })

    expect(workTaskKey(task.scope, task.sessionID)).toBe("local\nsession-1")
    expect(task.status).toBe("draft")
    expect(task.activities).toEqual([{ id: "activity-1", at: 10, kind: "created" }])
  })

  test("records task transitions without duplicating the same state", () => {
    const created = createWorkTask({
      scope: "local",
      sessionID: "session-1",
      directory: "/workspace",
      spec,
      at: 10,
      activityID: "activity-1",
    })
    const running = transitionWorkTask(created, "running", { at: 20, activityID: "activity-2" })
    const duplicate = transitionWorkTask(running, "running", { at: 30, activityID: "activity-3" })
    const resumed = transitionWorkTask(
      transitionWorkTask(running, "paused", { at: 40, activityID: "activity-4" }),
      "running",
      {
        at: 50,
        activityID: "activity-5",
        resumed: true,
      },
    )

    expect(duplicate).toBe(running)
    expect(resumed.activities.at(-1)?.kind).toBe("resumed")
  })

  test("stores restorable checkpoints with journal evidence", () => {
    const created = createWorkTask({
      scope: "local",
      sessionID: "session-1",
      directory: "/workspace",
      spec,
      at: 10,
      activityID: "activity-1",
    })
    const next = addWorkCheckpoint(created, {
      at: 20,
      checkpointID: "checkpoint-1",
      activityID: "activity-2",
      label: "Before revisions",
      messageID: "message-1",
    })

    expect(next.checkpoints).toEqual([
      { id: "checkpoint-1", at: 20, label: "Before revisions", messageID: "message-1" },
    ])
    expect(next.activities.at(-1)).toMatchObject({ kind: "checkpoint", detail: "Before revisions" })
  })

  test("persists and merges task context without duplicating sources", () => {
    const created = createWorkTask({
      scope: "local",
      sessionID: "session-1",
      directory: "/workspace",
      spec,
      at: 10,
      activityID: "activity-1",
    })
    const first = createContextGraph({
      workspace: "/workspace",
      workSpec: spec,
      sources: [{ kind: "file", label: "brief.md", path: "/workspace/brief.md", provenance: "attachment" }],
    })
    const second = createContextGraph({
      workspace: "/workspace",
      workSpec: spec,
      sources: [
        { kind: "file", label: "brief.md", path: "/workspace/brief.md", provenance: "context" },
        { kind: "file", label: "data.csv", path: "/workspace/data.csv", provenance: "context" },
      ],
    })

    const next = setWorkTaskContext(setWorkTaskContext(created, first, 20), second, 30)

    expect(next.updatedAt).toBe(30)
    expect(next.context?.sources.map((source) => source.path)).toEqual([
      "/workspace",
      "/workspace/brief.md",
      "/workspace/data.csv",
    ])
  })
})
