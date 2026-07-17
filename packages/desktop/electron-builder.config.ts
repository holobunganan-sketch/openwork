import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return
  if (process.env.OPENWORK_WINDOWS_SIGNING !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const APP_IDS = {
  dev: "io.github.holobunganansketch.openwork.dev",
  beta: "io.github.holobunganansketch.openwork.beta",
  prod: "io.github.holobunganansketch.openwork",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "OpenWork-${version}-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id.
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.productivity",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  protocols: {
    name: "OpenWork",
    schemes: ["openwork"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    executableName: "OpenWork",
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis", "portable"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createStartMenuShortcut: true,
    createDesktopShortcut: true,
    shortcutName: "OpenWork",
    uninstallDisplayName: "OpenWork",
    artifactName: "OpenWork-Setup-${version}-windows-${arch}.${ext}",
    installerIcon: `resources/icons/icon.ico`,
    uninstallerIcon: `resources/icons/icon.ico`,
  },
  portable: {
    artifactName: "OpenWork-Portable-${version}-windows-${arch}.${ext}",
  },
  linux: {
    icon: `resources/icons`,
    category: "Utility",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "OpenWork Dev",
        protocols: { name: "OpenWork Dev", schemes: ["openwork"] },
        rpm: { packageName: "openwork-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "OpenWork Beta",
        protocols: { name: "OpenWork Beta", schemes: ["openwork"] },
        publish: { provider: "github", owner: "holobunganan-sketch", repo: "openwork", channel: "latest" },
        rpm: { packageName: "openwork-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "OpenWork",
        protocols: { name: "OpenWork", schemes: ["openwork"] },
        publish: { provider: "github", owner: "holobunganan-sketch", repo: "openwork", channel: "latest" },
        rpm: { packageName: "openwork" },
      }
    }
  }

  throw new Error(`Unsupported OpenWork channel: ${channel}`)
}

export default getConfig()
