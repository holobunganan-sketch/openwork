import { createSimpleContext } from "@opencode-ai/ui/context"
import { createStore, produce, reconcile } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"
import { uuid } from "@/utils/uuid"
import {
  createOpenWorkMemoryEntry,
  exportOpenWorkMemory,
  memoryForTask,
  migrateOpenWorkMemoryStore,
  MEMORY_ENTRY_LIMIT,
  type OpenWorkMemoryEntry,
  type OpenWorkMemoryScope,
} from "@/openwork/memory"

export const { use: useOpenWorkMemory, provider: OpenWorkMemoryProvider } = createSimpleContext({
  name: "OpenWorkMemory",
  gate: false,
  init: () => {
    const [store, setStore, , ready] = persisted(
      {
        ...Persist.global("openwork.memory", ["openwork.memory.v1"]),
        migrate: migrateOpenWorkMemoryStore,
      },
      createStore<{ entries: OpenWorkMemoryEntry[] }>({ entries: [] }),
    )

    const get = (id: string) => store.entries.find((entry) => entry.id === id)
    const replace = (entry: OpenWorkMemoryEntry) => {
      const index = store.entries.findIndex((item) => item.id === entry.id)
      if (index === -1) {
        setStore("entries", store.entries.length, entry)
        return
      }
      setStore("entries", index, reconcile(entry))
    }
    const prune = () => {
      if (store.entries.length <= MEMORY_ENTRY_LIMIT) return
      const keep = new Set(
        store.entries
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MEMORY_ENTRY_LIMIT)
          .map((entry) => entry.id),
      )
      setStore(
        "entries",
        produce((entries) => {
          for (let index = entries.length - 1; index >= 0; index--) {
            if (!keep.has(entries[index].id)) entries.splice(index, 1)
          }
        }),
      )
    }

    return {
      ready,
      entries: store.entries,
      get,
      forTask(project: string) {
        return memoryForTask(store.entries, project)
      },
      create(input: { scope: OpenWorkMemoryScope; project?: string; content: string }) {
        const entry = createOpenWorkMemoryEntry({ ...input, id: uuid(), at: Date.now() })
        replace(entry)
        prune()
        return entry
      },
      update(id: string, patch: Partial<Pick<OpenWorkMemoryEntry, "scope" | "project" | "content" | "enabled">>) {
        const current = get(id)
        if (!current) return
        const at = Date.now()
        const next = createOpenWorkMemoryEntry({
          id,
          scope: patch.scope ?? current.scope,
          project: patch.project ?? current.project,
          content: patch.content ?? current.content,
          source: current.source,
          at,
        })
        const entry = {
          ...next,
          enabled: patch.enabled ?? current.enabled,
          createdAt: current.createdAt,
          updatedAt: at,
        }
        replace(entry)
      },
      remove(id: string) {
        const index = store.entries.findIndex((entry) => entry.id === id)
        if (index === -1) return false
        setStore(
          "entries",
          produce((entries) => void entries.splice(index, 1)),
        )
        return true
      },
      exportJSON() {
        return exportOpenWorkMemory(store.entries)
      },
    }
  },
})
