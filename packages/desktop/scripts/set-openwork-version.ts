import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const version = process.argv[2]
if (!version || !/^0\.1\.0(?:-rc\.[1-9][0-9]*)?$/.test(version)) {
  throw new Error("OpenWork release version must be 0.1.0 or 0.1.0-rc.N")
}

const path = resolve(import.meta.dir, "..", "package.json")
const manifest: unknown = JSON.parse(await readFile(path, "utf8"))
if (!isRecord(manifest)) throw new Error("Desktop package manifest is invalid")
manifest.version = version
await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
console.log(`OpenWork desktop version set to ${version}`)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
