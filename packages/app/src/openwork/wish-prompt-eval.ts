import { createWorkSpec, type WorkKind, type WorkOutputFormat } from "./work-spec"

export type WishPromptEvalCase = {
  id: string
  prompt: string
  expectedKind: WorkKind
  expectedFormats?: WorkOutputFormat[]
  constraintIncludes?: string[]
}

export type WishPromptEvalResult = {
  id: string
  passed: boolean
  failures: string[]
}

export const wishPromptEvalCases: WishPromptEvalCase[] = [
  {
    id: "zh-messy-notes-for-boss",
    prompt: "把这些乱七八糟的会议记录整理成明早给老板看的 Word 文档，正式一点",
    expectedKind: "document",
    expectedFormats: ["docx"],
    constraintIncludes: ["executive stakeholders", "formal", "明早"],
  },
  {
    id: "zh-roadshow-deck",
    prompt: "给路演做一套不超过 8 页、别太技术的可编辑 PPTX",
    expectedKind: "presentation",
    expectedFormats: ["pptx"],
    constraintIncludes: ["Maximum 8 页", "non-technical", "editable"],
  },
  {
    id: "en-revenue-workbook",
    prompt: "Revenue fell and I need to know why. Analyze the data and give me an editable XLSX workbook.",
    expectedKind: "data",
    expectedFormats: ["xlsx"],
    constraintIncludes: ["editable"],
  },
  {
    id: "en-finish-project",
    prompt: "Help me finish this project so we can release it; fix whatever ordinary build problems remain.",
    expectedKind: "software",
  },
  {
    id: "zh-check-a-claim",
    prompt: "这个说法到底靠不靠谱？查证一下，给我有据可查的答案。",
    expectedKind: "research",
    constraintIncludes: ["traceable sources"],
  },
  {
    id: "en-client-proposal",
    prompt: "Turn these meeting notes into a concise proposal PDF for the client by tomorrow.",
    expectedKind: "document",
    expectedFormats: ["pdf"],
    constraintIncludes: ["clients", "concise", "tomorrow"],
  },
  {
    id: "zh-table-csv-json",
    prompt: "分析这份表为什么营收掉了，给我 CSV 和 JSON，结果要能继续编辑。",
    expectedKind: "data",
    expectedFormats: ["csv", "json"],
    constraintIncludes: ["editable"],
  },
  {
    id: "windows-installer",
    prompt:
      "Finish the release as a Windows 11 x64 installer. Preserve existing user data and let it coexist with the old installation.",
    expectedKind: "software",
    expectedFormats: ["windows-installer"],
    constraintIncludes: ["Windows 11 x64", "Preserve existing user data", "Coexist"],
  },
  {
    id: "en-defensible-research",
    prompt: "Research this market and give me a sourced answer I can defend, using credible sources.",
    expectedKind: "research",
    constraintIncludes: ["traceable sources"],
  },
  {
    id: "zh-bilingual-documents",
    prompt: "把材料整理成中英双语的 DOCX 和 PDF，专业一点。",
    expectedKind: "document",
    expectedFormats: ["docx", "pdf"],
    constraintIncludes: ["Chinese and English", "professional"],
  },
  {
    id: "en-board-deck",
    prompt: "Make this board-ready by Monday in at most 10 slides, with an editable slide deck.",
    expectedKind: "presentation",
    constraintIncludes: ["Maximum 10 slides", "board members", "Monday", "editable"],
  },
  {
    id: "zh-general-wish",
    prompt: "把这件事妥善处理完，缺的细节你先按可逆的合理假设继续。",
    expectedKind: "general",
  },
  {
    id: "zht-board-report",
    prompt: "把這些會議記錄整理成給董事會看的正式 PDF 報告，週五前交。",
    expectedKind: "document",
    expectedFormats: ["pdf"],
    constraintIncludes: ["board members", "formal", "週五前"],
  },
]

export function evaluateWishPrompt(input: WishPromptEvalCase): WishPromptEvalResult {
  const spec = createWorkSpec({ prompt: input.prompt })
  const failures: string[] = []
  if (spec.kind !== input.expectedKind) failures.push(`kind: expected ${input.expectedKind}, received ${spec.kind}`)
  for (const format of input.expectedFormats ?? []) {
    if (!spec.requestedFormats.includes(format)) failures.push(`missing format: ${format}`)
  }
  for (const expected of input.constraintIncludes ?? []) {
    if (!spec.constraints.some((constraint) => constraint.toLowerCase().includes(expected.toLowerCase()))) {
      failures.push(`missing constraint: ${expected}`)
    }
  }
  for (const phase of ["inspect", "create", "verify"] as const) {
    if (!spec.skillRoute.some((step) => step.phase === phase && step.required)) failures.push(`missing route: ${phase}`)
  }
  if (!spec.acceptanceCriteria.length) failures.push("missing acceptance criteria")
  return { id: input.id, passed: failures.length === 0, failures }
}

export function runWishPromptEvals(cases: WishPromptEvalCase[] = wishPromptEvalCases) {
  const results = cases.map(evaluateWishPrompt)
  const passed = results.filter((result) => result.passed).length
  return { passed, total: results.length, score: results.length ? passed / results.length : 1, results }
}
