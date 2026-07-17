import { describe, expect, test } from "bun:test"
import { routeWorkSkills } from "./work-skill-router"

describe("OpenWork skill routing", () => {
  test("composes inspect, create, and verify phases for every work type", () => {
    for (const kind of ["general", "document", "research", "data", "presentation", "software"] as const) {
      const route = routeWorkSkills(kind)
      expect(route.map((step) => step.phase)).toEqual(["inspect", "create", "verify"])
      expect(route.every((step) => step.required)).toBe(true)
    }
  })

  test("routes software verification to tests and builds", () => {
    expect(routeWorkSkills("software").at(-1)?.capability).toContain("tests and build")
  })
})
