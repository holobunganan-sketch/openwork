import { describe, expect, test } from "bun:test"
import { defaultWorkPermissions, workPermissionAllows, workPermissionCategory } from "./work-permissions"

describe("OpenWork scoped permissions", () => {
  test("keeps destructive commands behind approval in every mode", () => {
    const request = { permission: "bash", patterns: ["git reset --hard HEAD~1"] }
    expect(workPermissionCategory(request)).toBe("destructive")
    expect(workPermissionAllows(defaultWorkPermissions("agent"), request)).toBe(false)
  })

  test("allows safe workspace work according to autonomy", () => {
    const edit = { permission: "edit", patterns: ["src/report.md"] }
    expect(workPermissionAllows(defaultWorkPermissions("plan"), edit)).toBe(false)
    expect(workPermissionAllows(defaultWorkPermissions("collaborate"), edit)).toBe(true)
  })

  test("separates network and external actions", () => {
    const agent = defaultWorkPermissions("agent")
    expect(workPermissionAllows(agent, { permission: "websearch" })).toBe(true)
    expect(workPermissionAllows(agent, { permission: "mcp_github_create_issue" })).toBe(false)
  })

  test("classifies shell network access separately from external side effects", () => {
    expect(workPermissionCategory({ permission: "bash", patterns: ["git fetch origin"] })).toBe("network")
    expect(workPermissionCategory({ permission: "bash", patterns: ["git push origin main"] })).toBe("external")
    expect(workPermissionCategory({ permission: "bash", patterns: ["npm publish"] })).toBe("external")
  })
})
