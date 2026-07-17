import { expect, test, type Page, type TestInfo } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/OpenWork/HarnessQuality"

async function openHarness(page: Page, options?: { onPrompt?: (body: unknown) => void }) {
  const sessions: ({ id: string } & Record<string, unknown>)[] = []
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: "project_harness_quality",
      worktree: directory,
      vcs: "git",
      name: "harness-quality",
      time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode-go",
          name: "OpenCode Go",
          models: {
            "gpt-5": {
              id: "gpt-5",
              name: "GPT-5",
              release_date: "2026-01-01",
              limit: { context: 200_000 },
            },
          },
        },
      ],
      connected: ["opencode-go"],
      default: { providerID: "opencode-go", modelID: "gpt-5" },
    },
    sessions,
    createSession: () => {
      const session = {
        id: "session_openwork_harness",
        slug: "openwork-harness",
        projectID: "project_harness_quality",
        directory,
        title: "OpenWork harness task",
        version: "dev",
        time: { created: Date.now(), updated: Date.now() },
      }
      sessions.push(session)
      return session
    },
    onPrompt: ({ body }) => options?.onPrompt?.(body),
    pageMessages: () => ({ items: [] }),
  })
  await page.addInitScript((workspace) => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem(
      "opencode.global.dat:server",
      JSON.stringify({
        projects: { local: [{ worktree: workspace, expanded: true }] },
        lastProject: { local: workspace },
      }),
    )
    localStorage.setItem(
      "opencode.global.dat:openwork.memory",
      JSON.stringify({
        entries: [
          {
            version: 1,
            id: "memory-quality",
            scope: "project",
            project: workspace,
            content: "Keep handoffs concise and include verification evidence.",
            enabled: true,
            source: "user",
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000,
          },
        ],
      }),
    )
  }, directory)
  await page.goto("/")
  await expectAppVisible(page.locator('[data-component="openwork-launchpad"]'))
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test("exposes a coherent, keyboard-readable task harness", async ({ page }, testInfo) => {
  await openHarness(page)
  const launchpad = page.locator('[data-component="openwork-launchpad"]')
  const composer = launchpad.getByRole("textbox", { name: /Describe what you want to accomplish/i })
  const modes = launchpad.getByRole("group", { name: "Execution mode" })
  const presets = launchpad.getByRole("group", { name: "Task presets" })

  await expect(composer).toBeVisible()
  await expect(modes.getByRole("button", { name: "Collaborate" })).toHaveAttribute("aria-pressed", "true")
  await modes.getByRole("button", { name: "Agent" }).click()
  await expect(modes.getByRole("button", { name: "Agent" })).toHaveAttribute("aria-pressed", "true")

  const controls = launchpad.getByRole("button", { name: "Controls" })
  await expect(controls).toHaveAttribute("aria-expanded", "false")
  await controls.click()
  await expect(controls).toHaveAttribute("aria-expanded", "true")
  const workspacePermission = launchpad.getByRole("button", { name: /Workspace edits:/ })
  await expect(workspacePermission).toHaveAttribute("aria-pressed", "true")

  for (const button of await launchpad.getByRole("button").all()) {
    if (!(await button.isVisible())) continue
    expect((await button.getAttribute("aria-label"))?.trim() || (await button.innerText()).trim()).not.toBe("")
  }

  const launchpadBox = await launchpad.boundingBox()
  const composerBox = await composer.boundingBox()
  const presetsBox = await presets.boundingBox()
  if (!launchpadBox || !composerBox || !presetsBox) throw new Error("OpenWork launchpad bounds are unavailable")
  expect(composerBox.x).toBeGreaterThanOrEqual(launchpadBox.x)
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(launchpadBox.x + launchpadBox.width + 1)
  expect(presetsBox.y).toBeGreaterThan(composerBox.y + composerBox.height)
  await expectNoHorizontalOverflow(page)
  await attachScreenshot(page, testInfo, "openwork-task-harness")
})

test("keeps the task composer stable at a narrow viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openHarness(page)
  const launchpad = page.locator('[data-component="openwork-launchpad"]')
  const composer = launchpad.getByRole("textbox", { name: /Describe what you want to accomplish/i })
  const launchpadBox = await launchpad.boundingBox()
  const composerBox = await composer.boundingBox()
  if (!launchpadBox || !composerBox) throw new Error("Narrow launchpad bounds are unavailable")
  expect(launchpadBox.x).toBeGreaterThanOrEqual(0)
  expect(launchpadBox.x + launchpadBox.width).toBeLessThanOrEqual(390)
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(390)
  await expectNoHorizontalOverflow(page)
  await attachScreenshot(page, testInfo, "openwork-task-harness-narrow")
})

test("starts the selected workspace and model in one task-first flow", async ({ page }, testInfo) => {
  const prompts: unknown[] = []
  await openHarness(page, { onPrompt: (body) => prompts.push(body) })
  const launchpad = page.locator('[data-component="openwork-launchpad"]')
  const workspace = launchpad.locator('[data-action="openwork-workspace"]')
  const model = launchpad.locator('[data-action="openwork-model"]')

  await expect(workspace).toContainText("harness-quality")
  await expect(model).toContainText("GPT-5")
  await launchpad.getByRole("textbox", { name: /Describe what you want to accomplish/i }).fill("Inspect this project")
  const start = launchpad.getByRole("button", { name: "Start task" })
  await expect(start).toBeEnabled()
  await start.click()

  await expect(page).toHaveURL(/\/session\/session_openwork_harness/)
  const workbench = page.locator('[data-component="openwork-task-workbench"]')
  await expectAppVisible(workbench)
  await expect(workbench).toContainText("Inspect this project")
  await expect(workbench).toContainText("GPT-5")
  await expect.poll(() => prompts.length).toBe(1)
  expect(JSON.stringify(prompts[0])).toContain("C:/OpenWork/HarnessQuality")
  expect(JSON.stringify(prompts[0])).toContain("GPT-5")
  await expect(page.locator('[data-component="openwork-task-starting"]')).toHaveCount(0)
  await attachScreenshot(page, testInfo, "openwork-task-running")
})

test("keeps memory visible, scoped, optional, and deliberately removable", async ({ page }, testInfo) => {
  await openHarness(page)
  await page.getByRole("button", { name: "Settings" }).last().click()
  await page.getByRole("tab", { name: "Memory" }).click()

  await expect(page.getByRole("heading", { name: "Memory", exact: true })).toBeVisible()
  const list = page.getByRole("navigation", { name: "Saved memory" })
  const entry = list.getByRole("button").first()
  await expect(entry).toHaveAttribute("aria-current", "true")
  await expect(page.getByRole("group", { name: "Scope" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "What OpenWork should remember" })).toHaveValue(
    "Keep handoffs concise and include verification evidence.",
  )

  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByRole("button", { name: "Delete permanently" })).toBeVisible()
  await page.getByRole("button", { name: "Delete permanently" }).click()
  await expect(page.getByText(/No saved memory/).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await attachScreenshot(page, testInfo, "openwork-memory-controls")
})
