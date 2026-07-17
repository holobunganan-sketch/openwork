import { describe, expect, test } from "bun:test"
import { migrateTabs } from "./tabs-migration"

describe("OpenWork draft tab migration", () => {
  test("adds the fallback server and upgrades an old embedded WorkSpec", () => {
    const migrated = migrateTabs(
      [
        {
          type: "draft",
          draftID: "draft-1",
          directory: "C:\\Work\\OpenWork",
          workSpec: {
            version: 1,
            goal: "Make an editable PPTX in at most 5 slides",
            kind: "presentation",
            autonomy: "collaborate",
          },
        },
      ],
      "local",
    )

    expect(migrated).toEqual([
      expect.objectContaining({
        type: "draft",
        server: "local",
        workSpec: expect.objectContaining({
          requestedFormats: ["pptx"],
          constraints: expect.arrayContaining(["Maximum 5 slides", "Deliverable remains editable"]),
        }),
      }),
    ])
  })
})
