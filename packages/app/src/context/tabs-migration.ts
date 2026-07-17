import { migrateWorkSpec } from "@/openwork/work-spec"

export function migrateTabs(value: unknown, fallback: string) {
  if (!Array.isArray(value)) return value
  return value.map((tab) => {
    if (!tab || typeof tab !== "object" || Array.isArray(tab)) return tab
    const next: Record<string, unknown> = { ...tab }
    if (!("server" in tab)) next.server = fallback
    if (tab.type === "draft" && "workSpec" in tab) {
      const spec = migrateWorkSpec(tab.workSpec)
      if (spec) next.workSpec = spec
      else delete next.workSpec
    }
    return next
  })
}
