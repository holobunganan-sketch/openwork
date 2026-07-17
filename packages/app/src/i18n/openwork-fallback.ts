import { dict as en } from "./en"

type OpenWorkKey = Extract<keyof typeof en, `openwork.${string}` | "settings.section.openwork">

// OpenWork ships complete English copy plus first-class Simplified and Traditional
// Chinese translations. Other locales fall back only for this new product surface
// until their translations land, while retaining all existing localized strings.
export const openworkFallback = Object.fromEntries(
  Object.entries(en).filter(([key]) => key.startsWith("openwork.") || key === "settings.section.openwork"),
) as Pick<typeof en, OpenWorkKey>
