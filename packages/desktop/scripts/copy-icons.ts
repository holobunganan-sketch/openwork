import { cp, rm } from "node:fs/promises"

const src = "resources/openwork-icons"
const dest = "resources/icons"

await rm(dest, { recursive: true, force: true })
await cp(src, dest, { recursive: true })
console.log(`Copied OpenWork icons from ${src} to ${dest}`)
