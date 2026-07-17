import type { OpenWorkUsage, OpenWorkUsagePeriod } from "@opencode-ai/app"
import type { ServerReadyData } from "../preload/types"

const DOCUMENTATION_URL = "https://opencode.ai/docs/go/"
const GO_PERIODS = [
  { id: "five-hour", duration: 5 * 60 * 60 * 1000, limit: 12 },
  { id: "weekly", duration: 7 * 24 * 60 * 60 * 1000, limit: 30 },
  { id: "monthly", duration: 30 * 24 * 60 * 60 * 1000, limit: 60 },
] as const satisfies ReadonlyArray<{
  id: OpenWorkUsagePeriod["id"]
  duration: number
  limit: number
}>

type SessionUsage = {
  cost: number
  updatedAt: number
}

export function createOpenWorkUsageService(input: {
  getServer: () => Promise<ServerReadyData>
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  now?: () => number
}) {
  const env = input.env ?? process.env
  const fetcher = input.fetch ?? fetch
  const now = input.now ?? Date.now

  async function get(): Promise<OpenWorkUsage> {
    const officialEndpoint = env.OPENWORK_GO_USAGE_ENDPOINT
    if (officialEndpoint) {
      try {
        return await getOfficialUsage(officialEndpoint)
      } catch {
        // The opt-in adapter is deliberately fail-soft; the local estimate below
        // remains available when the provider changes or is temporarily offline.
      }
    }
    try {
      const sessions = await getLocalSessions()
      return estimateLocalUsage(sessions, now())
    } catch {
      return {
        source: "unavailable",
        asOf: now(),
        periods: emptyPeriods(now()),
        sessionCount: 0,
        notice:
          "OpenCode does not publish a stable Go usage API. The local session estimate is temporarily unavailable.",
        documentationUrl: DOCUMENTATION_URL,
      }
    }
  }

  async function getOfficialUsage(endpoint: string): Promise<OpenWorkUsage> {
    const url = new URL(endpoint)
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
      throw new Error("OpenWork Go usage adapter requires HTTPS")
    }
    const token = env.OPENWORK_GO_USAGE_TOKEN
    const response = await fetcher(url, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Go usage adapter returned ${response.status}`)
    const body: unknown = await response.json()
    const periods = parseOfficialPeriods(body, now())
    return {
      source: "official",
      asOf: now(),
      periods,
      sessionCount: 0,
      notice: "Usage reported by the explicitly configured OpenWork Go provider adapter.",
      documentationUrl: DOCUMENTATION_URL,
    }
  }

  async function getLocalSessions() {
    const server = await input.getServer()
    const authorization = server.password
      ? `Basic ${Buffer.from(`${server.username ?? "opencode"}:${server.password}`).toString("base64")}`
      : undefined
    const sessions: SessionUsage[] = []
    let cursor: string | undefined
    for (let page = 0; page < 10; page += 1) {
      const url = new URL("/experimental/session", server.url)
      url.searchParams.set("roots", "true")
      url.searchParams.set("limit", "100")
      if (cursor) url.searchParams.set("cursor", cursor)
      const response = await fetcher(url, {
        headers: authorization ? { authorization } : undefined,
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`Local OpenCode usage request returned ${response.status}`)
      const body: unknown = await response.json()
      if (!Array.isArray(body)) throw new Error("Local OpenCode usage response is invalid")
      for (const item of body) {
        if (!isRecord(item) || !isRecord(item.time)) continue
        const cost = Number(item.cost)
        const updatedAt = Number(item.time.updated)
        if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(updatedAt)) continue
        sessions.push({ cost, updatedAt })
      }
      const next = response.headers.get("x-next-cursor") ?? undefined
      if (!next || next === cursor) break
      cursor = next
    }
    return sessions
  }

  return { get }
}

export function estimateLocalUsage(sessions: SessionUsage[], now: number): OpenWorkUsage {
  const periods = GO_PERIODS.map((definition) => {
    const startsAt = now - definition.duration
    const used = sessions
      .filter((session) => session.updatedAt >= startsAt && session.updatedAt <= now)
      .reduce((total, session) => total + session.cost, 0)
    return { id: definition.id, used: roundCurrency(used), limit: definition.limit, startsAt }
  })
  return {
    source: "local-estimate",
    asOf: now,
    periods,
    sessionCount: sessions.length,
    notice:
      "Local estimate from OpenCode session costs. It can differ from Go billing and is not an official remaining-balance value.",
    documentationUrl: DOCUMENTATION_URL,
  }
}

function emptyPeriods(now: number): OpenWorkUsagePeriod[] {
  return GO_PERIODS.map((definition) => ({
    id: definition.id,
    used: 0,
    limit: definition.limit,
    startsAt: now - definition.duration,
  }))
}

function parseOfficialPeriods(value: unknown, now: number): OpenWorkUsagePeriod[] {
  if (!isRecord(value)) throw new Error("Go usage adapter response must be an object")
  const source = isRecord(value.periods) ? value.periods : value
  const aliases: Record<OpenWorkUsagePeriod["id"], string[]> = {
    "five-hour": ["five-hour", "fiveHour", "five_hour"],
    weekly: ["weekly", "week"],
    monthly: ["monthly", "month"],
  }
  return GO_PERIODS.map((fallback) => {
    const id = fallback.id
    const item = aliases[id].map((key) => source[key]).find(isRecord)
    if (!item) throw new Error(`Go usage adapter is missing ${id}`)
    const used = Number(item.used)
    const limit = Number(item.limit ?? fallback.limit)
    const resetsAt = item.resetsAt === undefined ? undefined : Number(item.resetsAt)
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(limit) || limit <= 0) {
      throw new Error(`Go usage adapter has invalid ${id} values`)
    }
    return {
      id,
      used: roundCurrency(used),
      limit: roundCurrency(limit),
      startsAt: now - fallback.duration,
      ...(Number.isFinite(resetsAt) ? { resetsAt } : {}),
    }
  })
}

function roundCurrency(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
