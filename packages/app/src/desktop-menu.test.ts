import { describe, expect, test } from "bun:test"
import { DESKTOP_MENU } from "./desktop-menu"

describe("desktop menu", () => {
  test("exports logs through the desktop command registry", () => {
    const items = DESKTOP_MENU.flatMap((menu) => menu.items ?? []).filter(
      (item) => item.type === "item" && item.label === "Export Logs...",
    )

    expect(items).toHaveLength(2)
    expect(items.every((item) => item.type === "item" && item.command === "logs.export" && !item.action)).toBe(true)
  })

  test("uses OpenWork product labels and support links", () => {
    const appMenu = DESKTOP_MENU.find((menu) => menu.id === "app")
    const items = DESKTOP_MENU.flatMap((menu) => menu.items ?? []).filter((item) => item.type === "item")
    const links = items.flatMap((item) => (item.type === "item" && item.href ? [item.href] : []))

    expect(appMenu?.label).toBe("OpenWork")
    expect(items.some((item) => item.type === "item" && item.label === "Open Workspace...")).toBe(true)
    expect(links.some((href) => href.includes("holobunganan-sketch/openwork"))).toBe(true)
    expect(links.some((href) => href.includes("anomalyco/opencode"))).toBe(false)
  })
})
