import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parse, type ParseError } from "jsonc-parser"

type LockTuple = [string, string?, Record<string, unknown>?, string?]

const root = resolve(import.meta.dir, "../../..")
const desktop: unknown = JSON.parse(await readFile(resolve(root, "packages/desktop/package.json"), "utf8"))
const lockErrors: ParseError[] = []
const lock: unknown = parse(await readFile(resolve(root, "bun.lock"), "utf8"), lockErrors, {
  allowTrailingComma: true,
  disallowComments: false,
})
if (!isRecord(desktop) || typeof desktop.version !== "string") throw new Error("Desktop package manifest is invalid")
if (lockErrors.length > 0 || !isRecord(lock) || !isRecord(lock.packages)) throw new Error("Bun lockfile is invalid")

const components = Object.entries(lock.packages)
  .flatMap(([key, value]) => {
    if (!Array.isArray(value) || typeof value[0] !== "string") return []
    const tuple = value as LockTuple
    const parsed = packageIdentity(tuple[0], key)
    const integrity = [...tuple].reverse().find((item) => typeof item === "string" && item.startsWith("sha512-"))
    return [
      {
        type: "library",
        name: parsed.name,
        version: parsed.version,
        "bom-ref": `pkg:npm/${encodeURIComponent(parsed.name)}@${encodeURIComponent(parsed.version)}`,
        purl: `pkg:npm/${encodeURIComponent(parsed.name)}@${encodeURIComponent(parsed.version)}`,
        ...(integrity
          ? {
              hashes: [
                {
                  alg: "SHA-512",
                  content: Buffer.from(integrity.slice("sha512-".length), "base64").toString("hex"),
                },
              ],
            }
          : {}),
      },
    ]
  })
  .filter((item, index, all) => all.findIndex((candidate) => candidate["bom-ref"] === item["bom-ref"]) === index)
  .sort((a, b) => a["bom-ref"].localeCompare(b["bom-ref"]))

const commit = process.env.GITHUB_SHA ?? process.env.OPENWORK_COMMIT ?? "unknown"
const timestamp = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString()
const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {
    timestamp,
    component: {
      type: "application",
      name: "OpenWork",
      version: desktop.version,
      "bom-ref": `pkg:github/holobunganan-sketch/openwork@${commit}`,
      purl: `pkg:github/holobunganan-sketch/openwork@${commit}`,
    },
    properties: [
      { name: "openwork:git-sha", value: commit },
      { name: "openwork:lockfile", value: "bun.lock" },
    ],
  },
  components,
}

const output = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(root, `packages/desktop/dist/OpenWork-${desktop.version}-windows-x64.cdx.json`)
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(bom, null, 2)}\n`, "utf8")
console.log(`Wrote ${components.length} locked components to ${output}`)

function packageIdentity(specifier: string, fallback: string) {
  const separator = specifier.lastIndexOf("@")
  if (separator > 0) return { name: specifier.slice(0, separator), version: specifier.slice(separator + 1) }
  return { name: fallback, version: "unknown" }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
