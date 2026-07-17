import { dialog } from "electron"
import type { OpenCodeSourcePaths, ConfigCompatibilityMode } from "./config-compatibility"
import {
  applyConfigCompatibilityMode,
  configCompatibilityModeFromEnv,
  importOpenCodeConfiguration,
  isConfigCompatibilityMode,
} from "./config-compatibility"
import { getLogger } from "./logging"
import { getStore } from "./store"
import { CONFIG_COMPATIBILITY_MODE_KEY } from "./store-keys"

const choices: ConfigCompatibilityMode[] = ["independent", "read", "import", "share"]

export async function configureConfigCompatibility(input: {
  source: OpenCodeSourcePaths
  userDataPath: string
  skipPrompt?: boolean
}) {
  const logger = getLogger()
  const store = getStore()
  const override = configCompatibilityModeFromEnv(process.env)
  const stored = store.get(CONFIG_COMPATIBILITY_MODE_KEY)
  const previous = isConfigCompatibilityMode(stored) ? stored : undefined
  let selected = override ?? previous
  let firstSelection = false

  if (!selected) {
    firstSelection = true
    selected = input.skipPrompt ? "independent" : await promptForCompatibilityMode()
  }

  try {
    if (selected === "import" && !previous) {
      const result = importOpenCodeConfiguration(input)
      logger.log("imported existing OpenCode configuration", {
        backupPath: result.backupPath,
        scopes: result.installed,
      })
    }
    const applied = applyConfigCompatibilityMode({
      mode: selected,
      source: input.source,
      userDataPath: input.userDataPath,
    })
    if (!override && (firstSelection || !previous)) store.set(CONFIG_COMPATIBILITY_MODE_KEY, selected)
    logger.log("configuration compatibility mode applied", {
      selected,
      effectiveMode: applied.effectiveMode,
    })
    return selected
  } catch (error) {
    applyConfigCompatibilityMode({ mode: "independent", source: input.source, userDataPath: input.userDataPath })
    logger.error("failed to configure OpenCode compatibility; using independent mode", error)
    dialog.showErrorBox(
      "OpenWork configuration import failed",
      "OpenWork kept your OpenCode files unchanged and started in independent mode. See the OpenWork logs for details.\n\nOpenWork 未修改原有 OpenCode 文件，并已改用完全独立模式启动。",
    )
    if (!override) store.set(CONFIG_COMPATIBILITY_MODE_KEY, "independent")
    return "independent" as const
  }
}

async function promptForCompatibilityMode() {
  const result = await dialog.showMessageBox({
    type: "question",
    title: "OpenWork configuration compatibility",
    message:
      "Choose how OpenWork should use existing OpenCode configuration\n选择 OpenWork 使用现有 OpenCode 配置的方式",
    detail:
      "Independent（推荐）使用单独配置；Read 只读现有配置；Import 先备份再复制；Share 明确共享同一配置并允许双方修改。\n\nIndependent (recommended) keeps separate files. Read loads existing settings without changing them. Import backs up and copies them. Share lets both apps modify the same engine configuration.",
    buttons: ["Independent / 完全独立", "Read only / 只读", "Import / 备份后导入", "Share / 共享"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  return choices[result.response] ?? "independent"
}
