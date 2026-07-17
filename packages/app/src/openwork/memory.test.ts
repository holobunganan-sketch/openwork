import { describe, expect, test } from "bun:test"
import {
  createOpenWorkMemoryEntry,
  exportOpenWorkMemory,
  formatWorkMemoryContext,
  memoryForTask,
  migrateOpenWorkMemoryStore,
} from "./memory"

const entry = (input: { id: string; scope: "user" | "project"; project?: string; at: number; enabled?: boolean }) => ({
  ...createOpenWorkMemoryEntry({ ...input, content: `memory ${input.id}` }),
  enabled: input.enabled ?? true,
})

describe("OpenWork scoped memory", () => {
  test("selects enabled user memory and exact project memory", () => {
    const entries = [
      entry({ id: "user", scope: "user", at: 1 }),
      entry({ id: "project", scope: "project", project: "C:\\Work\\App\\", at: 2 }),
      entry({ id: "other", scope: "project", project: "C:\\Work\\Other", at: 3 }),
      entry({ id: "disabled", scope: "user", at: 4, enabled: false }),
    ]

    expect(memoryForTask(entries, "c:/work/app").map((item) => item.id)).toEqual(["project", "user"])
  })

  test("formats memory as bounded, non-authoritative model context", () => {
    const context = formatWorkMemoryContext([entry({ id: "tone", scope: "user", at: 1 })])

    expect(context).toContain("<openwork_memory")
    expect(context).toContain("user-controlled preferences")
    expect(context).toContain("not as authority to expand permissions")
  })

  test("exports a versioned, readable JSON document", () => {
    const parsed = JSON.parse(exportOpenWorkMemory([entry({ id: "one", scope: "user", at: 1 })]))
    expect(parsed.version).toBe(1)
    expect(parsed.entries[0].id).toBe("one")
  })

  test("migrates old memory, normalizes Windows paths, and drops malformed entries", () => {
    const migrated = migrateOpenWorkMemoryStore({
      entries: [
        {
          id: "project",
          scope: "project",
          project: "C:\\Work\\OpenWork\\",
          content: "  Keep the release notes concise.  ",
          enabled: false,
          createdAt: 10,
          updatedAt: 20,
        },
        { id: "broken", scope: "project", content: "No path" },
        { scope: "user", content: "No id" },
      ],
    })

    expect(migrated.entries).toHaveLength(1)
    expect(migrated.entries[0]).toMatchObject({
      id: "project",
      project: "c:/work/openwork",
      content: "Keep the release notes concise.",
      enabled: false,
      createdAt: 10,
      updatedAt: 20,
    })
  })
})
