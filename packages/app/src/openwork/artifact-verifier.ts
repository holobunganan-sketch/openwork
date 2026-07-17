import type { WorkKind } from "./work-spec"

export type WorkArtifactKind =
  | "document"
  | "presentation"
  | "spreadsheet"
  | "research"
  | "software"
  | "package"
  | "file"
export type WorkVerificationStatus = "passed" | "warning" | "failed"
export type WorkVerificationCheckID =
  | "exists"
  | "nonempty"
  | "format"
  | "structure"
  | "editable"
  | "render"
  | "citations"
  | "formulas"
  | "changes"
  | "tests"
  | "build"
  | "smoke"

export type WorkVerificationCheck = {
  id: WorkVerificationCheckID
  status: WorkVerificationStatus
  evidence?: string
}

export type WorkArtifact = {
  id: string
  name: string
  kind: WorkArtifactKind
  path?: string
  changedFiles: string[]
  status: WorkVerificationStatus
  checks: WorkVerificationCheck[]
  verifiedAt: number
}

export type WorkArtifactContent = {
  type: "text" | "binary"
  content: string
  encoding?: "base64"
  mimeType?: string
}

export type WorkArtifactCandidate = {
  id: string
  name: string
  kind: WorkArtifactKind
  path?: string
  changedFiles: string[]
}

export type WorkArtifactEvidence = {
  commands: string[]
  tools: string[]
}

type DiffInput = {
  file?: string
  status?: "added" | "deleted" | "modified"
}

type PartInput = {
  type: string
  files?: string[]
  tool?: string
  state?: {
    status?: string
    title?: string
    input?: Record<string, unknown>
    attachments?: { filename?: string; url?: string }[]
  }
}

const packageExtensions = new Set(["exe", "msi", "msix", "appx", "dmg", "deb", "rpm", "zip"])
const documentExtensions = new Set(["docx", "doc", "odt", "rtf", "pdf", "md", "txt"])
const presentationExtensions = new Set(["pptx", "ppt", "odp", "pdf"])
const spreadsheetExtensions = new Set(["xlsx", "xls", "ods", "csv", "tsv", "parquet", "json"])
const researchExtensions = new Set(["md", "docx", "doc", "odt", "pdf", "html", "htm"])

const extension = (path: string) =>
  path
    .split(/[?#]/, 1)[0]
    ?.match(/\.([^.\\/]+)$/)?.[1]
    ?.toLowerCase() ?? ""
const filename = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
const artifactID = (kind: WorkArtifactKind, value: string) => `artifact:${kind}:${value}`

export function collectWorkArtifactEvidence(parts: PartInput[]): WorkArtifactEvidence {
  const commands: string[] = []
  const tools: string[] = []
  for (const part of parts) {
    if (part.type !== "tool" || part.state?.status !== "completed" || !part.tool) continue
    tools.push(part.tool)
    const command = part.state.input?.command
    if (typeof command === "string" && command.trim()) commands.push(command.trim())
    if (Array.isArray(command)) {
      const value = command
        .filter((item): item is string => typeof item === "string")
        .join(" ")
        .trim()
      if (value) commands.push(value)
    }
  }
  return { commands: [...new Set(commands)], tools: [...new Set(tools)] }
}

export function discoverWorkArtifactCandidates(input: {
  workKind: WorkKind
  workspace: string
  diffs: DiffInput[]
  parts: PartInput[]
}): WorkArtifactCandidate[] {
  const paths = new Set<string>()
  for (const diff of input.diffs) {
    if (!diff.file || diff.status === "deleted") continue
    paths.add(diff.file)
  }
  for (const part of input.parts) {
    if (part.type === "patch") for (const path of part.files ?? []) if (path) paths.add(path)
    if (part.type !== "tool" || part.state?.status !== "completed") continue
    for (const attachment of part.state.attachments ?? []) {
      const path = attachment.filename
      if (path && !path.startsWith("data:")) paths.add(path)
    }
  }

  const files = [...paths]
  if (files.length === 0) return []

  const packages = files
    .filter((path) => packageExtensions.has(extension(path)))
    .map((path) => fileCandidate(path, "package"))

  if (input.workKind === "software") {
    const changedFiles = files.filter((path) => !packageExtensions.has(extension(path)))
    const software = changedFiles.length
      ? [
          {
            id: artifactID("software", input.workspace),
            name: filename(input.workspace) || input.workspace,
            kind: "software" as const,
            changedFiles,
          },
        ]
      : []
    return [...software, ...packages]
  }

  const candidates = files.map((path) => fileCandidate(path, artifactKind(path, input.workKind)))
  const relevant = candidates.filter((item) => isRelevant(item.kind, input.workKind))
  return relevant.length ? relevant : candidates
}

export function verifyWorkArtifacts(input: {
  candidates: WorkArtifactCandidate[]
  contents: Record<string, WorkArtifactContent | undefined>
  evidence: WorkArtifactEvidence
  at: number
}): WorkArtifact[] {
  return input.candidates.map((candidate) => {
    const checks = verifyCandidate(candidate, input.contents[candidate.path ?? ""], input.evidence)
    return {
      ...candidate,
      checks,
      status: checkStatus(checks),
      verifiedAt: input.at,
    }
  })
}

function fileCandidate(path: string, kind: WorkArtifactKind): WorkArtifactCandidate {
  return { id: artifactID(kind, path), name: filename(path), kind, path, changedFiles: [path] }
}

function artifactKind(path: string, workKind: WorkKind): WorkArtifactKind {
  const ext = extension(path)
  if (packageExtensions.has(ext)) return "package"
  if (workKind === "presentation" && presentationExtensions.has(ext)) return "presentation"
  if (workKind === "data" && spreadsheetExtensions.has(ext)) return "spreadsheet"
  if (workKind === "research" && researchExtensions.has(ext)) return "research"
  if (workKind === "document" && documentExtensions.has(ext)) return "document"
  if (["pptx", "ppt", "odp"].includes(ext)) return "presentation"
  if (spreadsheetExtensions.has(ext)) return "spreadsheet"
  if (documentExtensions.has(ext)) return "document"
  return "file"
}

function isRelevant(kind: WorkArtifactKind, workKind: WorkKind) {
  if (kind === "package") return true
  if (workKind === "document") return kind === "document"
  if (workKind === "presentation") return kind === "presentation"
  if (workKind === "data") return kind === "spreadsheet"
  if (workKind === "research") return kind === "research"
  return true
}

function verifyCandidate(
  candidate: WorkArtifactCandidate,
  content: WorkArtifactContent | undefined,
  evidence: WorkArtifactEvidence,
): WorkVerificationCheck[] {
  if (candidate.kind === "software") return verifySoftware(candidate, evidence)

  const checks = commonChecks(candidate, content)
  if (!content) return checks
  if (candidate.kind === "document") checks.push(...verifyDocument(candidate, content, evidence))
  if (candidate.kind === "presentation") checks.push(...verifyPresentation(candidate, evidence))
  if (candidate.kind === "spreadsheet") checks.push(...verifySpreadsheet(candidate, content, evidence))
  if (candidate.kind === "research") checks.push(...verifyResearch(content, evidence))
  if (candidate.kind === "package") checks.push(verificationEvidence("smoke", evidence, smokePattern))
  return checks
}

function commonChecks(candidate: WorkArtifactCandidate, content: WorkArtifactContent | undefined) {
  if (!content) {
    return [{ id: "exists", status: "failed", evidence: "File could not be read" }] satisfies WorkVerificationCheck[]
  }
  const nonempty = content.content.length > 0
  return [
    { id: "exists", status: "passed", evidence: candidate.path },
    {
      id: "nonempty",
      status: nonempty ? "passed" : "failed",
      evidence: nonempty ? `${content.content.length} encoded characters` : "File is empty",
    },
    formatCheck(candidate.path ?? "", content),
  ] satisfies WorkVerificationCheck[]
}

function formatCheck(path: string, content: WorkArtifactContent): WorkVerificationCheck {
  const ext = extension(path)
  const value = content.content.trimStart()
  const valid = (() => {
    if (["docx", "pptx", "xlsx", "zip", "odt", "odp", "ods"].includes(ext)) return value.startsWith("UEs")
    if (ext === "pdf") return value.startsWith("%PDF") || value.startsWith("JVBERi0")
    if (["exe", "msix", "appx"].includes(ext)) return value.startsWith("TV")
    if (ext === "msi") return value.startsWith("0M8R4KGxGu")
    return value.length > 0
  })()
  return {
    id: "format",
    status: valid ? "passed" : "failed",
    evidence: valid ? `${ext || content.type} structure recognized` : `${ext || "file"} signature is invalid`,
  }
}

function verifyDocument(
  candidate: WorkArtifactCandidate,
  content: WorkArtifactContent,
  evidence: WorkArtifactEvidence,
) {
  const ext = extension(candidate.path ?? "")
  if (["md", "txt", "rtf"].includes(ext)) {
    const structured = content.content.trim().length >= 80
    return [
      {
        id: "structure" as const,
        status: structured ? ("passed" as const) : ("warning" as const),
        evidence: structured ? "Readable text structure detected" : "Document is unusually short",
      },
    ]
  }
  if (ext === "pdf") return [{ id: "render" as const, status: "passed" as const, evidence: "Rendered PDF output" }]
  return [verificationEvidence("render", evidence, renderPattern)]
}

function verifyPresentation(candidate: WorkArtifactCandidate, evidence: WorkArtifactEvidence) {
  const ext = extension(candidate.path ?? "")
  return [
    {
      id: "editable" as const,
      status: ["pptx", "ppt", "odp"].includes(ext) ? ("passed" as const) : ("warning" as const),
      evidence: ["pptx", "ppt", "odp"].includes(ext) ? "Editable presentation format" : "No editable deck detected",
    },
    ext === "pdf"
      ? { id: "render" as const, status: "passed" as const, evidence: "Rendered PDF output" }
      : verificationEvidence("render", evidence, renderPattern),
  ]
}

function verifySpreadsheet(
  candidate: WorkArtifactCandidate,
  content: WorkArtifactContent,
  evidence: WorkArtifactEvidence,
) {
  const ext = extension(candidate.path ?? "")
  if (["csv", "tsv", "json"].includes(ext)) {
    const rows = content.content.trim().split(/\r?\n/).filter(Boolean)
    const separator = ext === "tsv" ? "\t" : ","
    const structured = ext === "json" ? jsonValid(content.content) : rows.length > 1 && rows[0]!.includes(separator)
    return [
      {
        id: "structure" as const,
        status: structured ? ("passed" as const) : ("warning" as const),
        evidence: structured ? `${rows.length} data rows inspected` : "Tabular structure needs review",
      },
    ]
  }
  return [verificationEvidence("formulas", evidence, spreadsheetPattern)]
}

function verifyResearch(content: WorkArtifactContent, evidence: WorkArtifactEvidence) {
  const cited = /(https?:\/\/|\[[^\]]+\]\([^)]+\)|\bdoi:|\breferences\b|参考文献|資料來源|来源)/i.test(content.content)
  const researched = evidence.tools.some((tool) => /web(search|fetch)|research/i.test(tool))
  return [
    {
      id: "citations" as const,
      status: cited ? ("passed" as const) : ("warning" as const),
      evidence: cited
        ? "Traceable source markers detected"
        : researched
          ? "Research tools were used; citations still need artifact review"
          : "No traceable source markers detected",
    },
  ]
}

function verifySoftware(candidate: WorkArtifactCandidate, evidence: WorkArtifactEvidence) {
  return [
    {
      id: "changes" as const,
      status: candidate.changedFiles.length ? ("passed" as const) : ("failed" as const),
      evidence: `${candidate.changedFiles.length} changed file(s)`,
    },
    verificationEvidence("tests", evidence, testPattern),
    verificationEvidence("build", evidence, buildPattern),
  ]
}

function verificationEvidence(
  id: WorkVerificationCheckID,
  evidence: WorkArtifactEvidence,
  pattern: RegExp,
): WorkVerificationCheck {
  const command = evidence.commands.find((item) => pattern.test(item))
  return command
    ? { id, status: "passed", evidence: command }
    : { id, status: "warning", evidence: "No successful verification command was observed" }
}

function checkStatus(checks: WorkVerificationCheck[]): WorkVerificationStatus {
  if (checks.some((check) => check.status === "failed")) return "failed"
  if (checks.some((check) => check.status === "warning")) return "warning"
  return "passed"
}

function jsonValid(value: string) {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

const testPattern = /(^|\s)(bun|npm|pnpm|yarn|cargo|go|pytest|vitest|jest)?\s*(run\s+)?test([:\s]|$)/i
const buildPattern = /(^|\s)(build|typecheck|tsc|lint|check)([:\s]|$)/i
const renderPattern = /(render|soffice|libreoffice|pandoc|slides_test|screenshot|overflow)/i
const spreadsheetPattern =
  /(openpyxl|formula|spreadsheet|xlsx|libreoffice).*(check|valid|inspect|recalc)|check.*(formula|xlsx)/i
const smokePattern = /(smoke|package:win|electron-builder|install.*launch|launch.*uninstall)/i
