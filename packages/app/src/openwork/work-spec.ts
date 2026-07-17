export type WorkKind = "general" | "document" | "research" | "data" | "presentation" | "software"

export type WorkAutonomy = "plan" | "collaborate" | "agent"

export type WorkSpec = {
  version: 1
  goal: string
  kind: WorkKind
  autonomy: WorkAutonomy
  deliverables: string[]
  acceptanceCriteria: string[]
}

const kindRules: { kind: Exclude<WorkKind, "general">; patterns: RegExp[] }[] = [
  {
    kind: "presentation",
    patterns: [/\bpptx?\b/i, /powerpoint/i, /slide deck/i, /presentation/i, /幻灯片/, /演示文稿/, /汇报PPT/i],
  },
  {
    kind: "data",
    patterns: [/\bxlsx?\b/i, /spreadsheet/i, /dataset/i, /data analysis/i, /数据分析/, /数据集/, /表格/],
  },
  {
    kind: "research",
    patterns: [/research/i, /literature/i, /evidence/i, /citation/i, /文献/, /检索/, /证据/, /研究主题/],
  },
  {
    kind: "document",
    patterns: [/\bdocx?\b/i, /document/i, /manuscript/i, /report/i, /文档/, /手稿/, /报告/, /论文/],
  },
  {
    kind: "software",
    patterns: [/\bcode\b/i, /software/i, /repository/i, /debug/i, /代码/, /软件/, /仓库/, /修复.*错误/],
  },
]

const defaults: Record<WorkKind, { deliverables: string[]; acceptanceCriteria: string[] }> = {
  general: {
    deliverables: ["A complete result in the format implied by the request"],
    acceptanceCriteria: [
      "The result directly satisfies the stated goal",
      "Material assumptions are stated",
      "The result is checked before delivery",
    ],
  },
  document: {
    deliverables: ["An editable document in the requested format"],
    acceptanceCriteria: [
      "Content is complete and coherent",
      "Formatting is consistent",
      "Sources and references remain traceable",
      "The final file opens successfully",
    ],
  },
  research: {
    deliverables: ["A source-backed research brief or requested research artifact"],
    acceptanceCriteria: [
      "Claims are supported by relevant sources",
      "Uncertainty and evidence limits are clear",
      "Citations link to the claims they support",
      "The requested scope is covered",
    ],
  },
  data: {
    deliverables: ["A validated analysis and the requested data artifact"],
    acceptanceCriteria: [
      "Inputs and assumptions are checked",
      "Calculations and references are valid",
      "Findings answer the decision question",
      "The final artifact opens and updates correctly",
    ],
  },
  presentation: {
    deliverables: ["An editable presentation file"],
    acceptanceCriteria: [
      "The narrative has a clear progression",
      "Slides are readable and visually balanced",
      "No text or objects overflow or overlap",
      "The presentation renders and opens successfully",
    ],
  },
  software: {
    deliverables: ["A working implementation in the selected workspace"],
    acceptanceCriteria: [
      "The requested behavior is implemented",
      "Relevant tests and type checks pass",
      "Changes stay within the authorized scope",
      "The handoff identifies validation evidence",
    ],
  },
}

export function createWorkSpec(input: { prompt: string; kind?: WorkKind; autonomy?: WorkAutonomy }): WorkSpec {
  const goal = input.prompt.trim()
  const kind =
    input.kind ?? kindRules.find((rule) => rule.patterns.some((pattern) => pattern.test(goal)))?.kind ?? "general"
  return {
    version: 1,
    goal,
    kind,
    autonomy: input.autonomy ?? "collaborate",
    deliverables: defaults[kind].deliverables,
    acceptanceCriteria: defaults[kind].acceptanceCriteria,
  }
}

export function formatWorkSpecContext(spec: WorkSpec) {
  const autonomy = {
    plan: "Inspect and plan only. Do not write files, run mutating commands, or perform external actions.",
    collaborate:
      "Proceed through safe, reversible work in the selected workspace. Ask only when a missing choice would materially change the result or when an external or destructive action needs approval.",
    agent:
      "Complete the task end to end inside the selected workspace. Make reasonable reversible assumptions, verify the result, and request approval for external, sensitive, or destructive actions.",
  }[spec.autonomy]
  return [
    '<openwork_task_contract version="1">',
    `Goal: ${spec.goal}`,
    `Work type: ${spec.kind}`,
    `Execution mode: ${spec.autonomy}. ${autonomy}`,
    `Expected deliverables: ${spec.deliverables.join("; ")}`,
    `Acceptance criteria: ${spec.acceptanceCriteria.join("; ")}`,
    "First inspect the available workspace and attachments. Preserve user-authored work, keep material assumptions explicit, continue until the acceptance criteria are verified, and report concrete evidence in the handoff.",
    "</openwork_task_contract>",
  ].join("\n")
}
