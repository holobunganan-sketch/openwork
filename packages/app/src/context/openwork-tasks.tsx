import { createSimpleContext } from "@opencode-ai/ui/context"
import { createStore, produce, reconcile } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"
import { uuid } from "@/utils/uuid"
import {
  addWorkCheckpoint,
  createWorkTask,
  migrateOpenWorkTaskStore,
  setWorkTaskArtifacts,
  setWorkTaskContext,
  transitionWorkTask,
  workTaskKey,
  type WorkTask,
  type WorkTaskStatus,
} from "@/openwork/task-runtime"
import type { ContextGraph } from "@/openwork/context-graph"
import type { WorkArtifact } from "@/openwork/artifact-verifier"
import type { WorkSpec } from "@/openwork/work-spec"

const TASK_LIMIT = 200

export const { use: useOpenWorkTasks, provider: OpenWorkTasksProvider } = createSimpleContext({
  name: "OpenWorkTasks",
  gate: false,
  init: () => {
    const [store, setStore, , ready] = persisted(
      {
        ...Persist.global("openwork.tasks", ["openwork.tasks.v1"]),
        migrate: migrateOpenWorkTaskStore,
      },
      createStore<{ items: Record<string, WorkTask> }>({ items: {} }),
    )

    const get = (scope: string, sessionID: string) => store.items[workTaskKey(scope, sessionID)]
    const replace = (task: WorkTask) => setStore("items", workTaskKey(task.scope, task.sessionID), reconcile(task))

    const prune = () => {
      const entries = Object.entries(store.items)
      if (entries.length <= TASK_LIMIT) return
      const keep = new Set(
        entries
          .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
          .slice(0, TASK_LIMIT)
          .map(([key]) => key),
      )
      setStore(
        "items",
        produce((items) => {
          for (const key of Object.keys(items)) if (!keep.has(key)) delete items[key]
        }),
      )
    }

    return {
      ready,
      items: store.items,
      get,
      create(input: { scope: string; sessionID: string; directory: string; spec: WorkSpec }) {
        const current = get(input.scope, input.sessionID)
        if (current) return current
        const task = createWorkTask({ ...input, at: Date.now(), activityID: uuid() })
        replace(task)
        prune()
        return task
      },
      transition(
        scope: string,
        sessionID: string,
        status: WorkTaskStatus,
        options?: { detail?: string; resumed?: boolean },
      ) {
        const current = get(scope, sessionID)
        if (!current) return
        const next = transitionWorkTask(current, status, {
          at: Date.now(),
          activityID: uuid(),
          ...options,
        })
        if (next !== current) replace(next)
        return next
      },
      checkpoint(scope: string, sessionID: string, input: { label: string; messageID?: string }) {
        const current = get(scope, sessionID)
        if (!current) return
        const next = addWorkCheckpoint(current, {
          ...input,
          at: Date.now(),
          checkpointID: uuid(),
          activityID: uuid(),
        })
        replace(next)
        return next
      },
      setContext(scope: string, sessionID: string, context: ContextGraph) {
        const current = get(scope, sessionID)
        if (!current) return
        const next = setWorkTaskContext(current, context, Date.now())
        replace(next)
        return next
      },
      setArtifacts(scope: string, sessionID: string, artifacts: WorkArtifact[], at = Date.now()) {
        const current = get(scope, sessionID)
        if (!current) return
        const next = setWorkTaskArtifacts(current, artifacts, at)
        replace(next)
        return next
      },
      remove(scope: string, sessionID: string) {
        const key = workTaskKey(scope, sessionID)
        if (!store.items[key]) return
        setStore(
          "items",
          produce((items) => {
            delete items[key]
          }),
        )
      },
    }
  },
})
