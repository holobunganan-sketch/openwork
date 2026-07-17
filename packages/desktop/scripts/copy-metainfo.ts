import { resolveChannel } from "./utils"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId =
  channel === "prod" ? "io.github.holobunganansketch.openwork" : `io.github.holobunganansketch.openwork.${channel}`
const productName = channel === "prod" ? "OpenWork" : `OpenWork ${channel.charAt(0).toUpperCase() + channel.slice(1)}`
const summary = `Desktop agent workspace for general and development tasks${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="io.github.holobunganansketch">
    <name>OpenWork contributors</name>
  </developer>

  <description>
    <p>
      OpenWork is an unofficial desktop agent workspace based on OpenCode. It supports research,
      writing, documents, data work, and software development with user-selected AI providers.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">https://github.com/holobunganan-sketch/openwork/issues</url>
  <url type="homepage">https://github.com/holobunganan-sketch/openwork</url>
  <url type="vcs-browser">https://github.com/holobunganan-sketch/openwork</url>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)
console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
