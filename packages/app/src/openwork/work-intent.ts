export type WorkKind = "general" | "document" | "research" | "data" | "presentation" | "software"

export type WorkOutputFormat =
  | "docx"
  | "pdf"
  | "markdown"
  | "pptx"
  | "xlsx"
  | "csv"
  | "json"
  | "html"
  | "zip"
  | "windows-installer"

export type WorkIntent = {
  kind: WorkKind
  confidence: "low" | "medium" | "high"
  evidence: string[]
  requestedFormats: WorkOutputFormat[]
  constraints: string[]
}

type KindSignal = { label: string; pattern: RegExp; weight: number }

const kindRules: { kind: Exclude<WorkKind, "general">; signals: KindSignal[] }[] = [
  {
    kind: "presentation",
    signals: [
      { label: "PowerPoint format", pattern: /\b(pptx?|powerpoint)\b|演示文稿|簡報|汇报PPT/i, weight: 6 },
      { label: "slides or deck", pattern: /\b(slides?|slide deck|pitch deck)\b|幻灯片|投影片|路演/i, weight: 5 },
      { label: "presentation request", pattern: /\bpresentation\b|做.*汇报|製作.*簡報/i, weight: 4 },
      { label: "board-ready narrative", pattern: /board[- ]ready|investor[- ]ready|拿去路演/i, weight: 3 },
    ],
  },
  {
    kind: "data",
    signals: [
      { label: "workbook format", pattern: /\b(xlsx?|excel|spreadsheet|csv)\b|工作簿|试算表|試算表/i, weight: 6 },
      { label: "dataset", pattern: /\b(dataset|data set)\b|数据集|資料集/i, weight: 5 },
      {
        label: "analysis request",
        pattern: /data analysis|analy[sz]e.*(?:data|revenue|sales)|数据分析|分析.*(?:数据|营收|收入)/i,
        weight: 4,
      },
      { label: "table diagnosis", pattern: /这份表|這份表|表格.*(?:问题|問題)|revenue fell|sales fell/i, weight: 4 },
    ],
  },
  {
    kind: "research",
    signals: [
      { label: "research request", pattern: /\bresearch\b|研究主题|研究主題|调研|調研/i, weight: 5 },
      { label: "literature or citations", pattern: /literature|citations?|references?|文献|文獻|引用/i, weight: 5 },
      {
        label: "evidence check",
        pattern: /\bevidence\b|fact[- ]?check|verify.*claim|靠不靠谱|靠不靠譜|查证|查證|可信度/i,
        weight: 5,
      },
      {
        label: "sourced answer",
        pattern: /source[- ]backed|sourced answer|credible sources|有据可查|有據可查/i,
        weight: 4,
      },
    ],
  },
  {
    kind: "document",
    signals: [
      { label: "document format", pattern: /\b(docx?|word document)\b|Word 文档|Word 文件/i, weight: 6 },
      {
        label: "document request",
        pattern: /\b(document|manuscript|memo|brief|proposal)\b|文档|文件|手稿|方案/i,
        weight: 4,
      },
      { label: "report request", pattern: /\breport\b|报告|報告/i, weight: 4 },
      {
        label: "notes synthesis",
        pattern: /meeting notes|turn these notes|会议记录|會議記錄|整理.*(?:材料|笔记|筆記)/i,
        weight: 4,
      },
      {
        label: "writing request",
        pattern: /\b(write|rewrite|revise|summari[sz]e)\b|撰写|撰寫|改写|改寫|总结|總結/i,
        weight: 3,
      },
    ],
  },
  {
    kind: "software",
    signals: [
      {
        label: "code or repository",
        pattern: /\b(code|software|repository|repo)\b|代码|程式碼|软件|軟體|仓库|儲存庫/i,
        weight: 5,
      },
      {
        label: "debugging",
        pattern: /\b(debug|bug|failing tests?|typecheck)\b|修复.*错误|修復.*錯誤|排查.*问题/i,
        weight: 5,
      },
      {
        label: "release engineering",
        pattern: /\b(release|deploy|installer|package|msi|nsis)\b|发版|發版|安装包|安裝套件/i,
        weight: 5,
      },
      {
        label: "project completion",
        pattern: /finish this project|ship this project|项目.*(?:收尾|完成)|專案.*(?:收尾|完成)/i,
        weight: 4,
      },
      { label: "platform target", pattern: /windows 11|windows x64|macos|linux/i, weight: 2 },
    ],
  },
]

const formatRules: { format: WorkOutputFormat; pattern: RegExp }[] = [
  {
    format: "windows-installer",
    pattern: /windows[^\n,.!?]*(?:installer|package)|(?:installer|安装包|安裝套件)[^\n,.!?]*windows|\b(msi|nsis)\b/i,
  },
  { format: "pptx", pattern: /\b(pptx?|powerpoint)\b|演示文稿|幻灯片|投影片|簡報/i },
  { format: "docx", pattern: /\b(docx?|word document)\b|Word 文档|Word 文件/i },
  { format: "xlsx", pattern: /\b(xlsx?|excel workbook)\b|Excel 工作簿/i },
  { format: "pdf", pattern: /\bpdf\b/i },
  { format: "markdown", pattern: /\b(markdown|md file)\b/i },
  { format: "csv", pattern: /\bcsv\b/i },
  { format: "json", pattern: /\bjson\b/i },
  { format: "html", pattern: /\bhtml\b/i },
  { format: "zip", pattern: /\bzip\b/i },
]

const audienceRules = [
  { pattern: /\b(board|board members?)\b|董事会|董事會/i, value: "board members" },
  { pattern: /\b(executives?|leadership)\b|老板|老闆|高管|管理层|管理層/i, value: "executive stakeholders" },
  { pattern: /\b(clients?|customers?)\b|客户|客戶/i, value: "clients" },
  { pattern: /\b(investors?)\b|投资人|投資人/i, value: "investors" },
]

const toneRules = [
  { pattern: /non[- ]technical|plain language|别太技术|別太技術|通俗/i, value: "non-technical plain language" },
  { pattern: /\bconcise\b|简洁|簡潔|精炼|精煉/i, value: "concise" },
  { pattern: /\bformal\b|正式/i, value: "formal" },
  { pattern: /\bfriendly\b|友好|親切/i, value: "friendly" },
  { pattern: /\bprofessional\b|专业|專業/i, value: "professional" },
]

export function compileWorkIntent(prompt: string): WorkIntent {
  const goal = prompt.trim()
  const ranked = kindRules
    .map((rule, priority) => {
      const matches = rule.signals.filter((signal) => signal.pattern.test(goal))
      return {
        kind: rule.kind,
        priority,
        score: matches.reduce((total, signal) => total + signal.weight, 0),
        evidence: matches.map((signal) => signal.label),
      }
    })
    .sort((a, b) => b.score - a.score || a.priority - b.priority)
  const best = ranked[0]
  const second = ranked[1]
  const kind = best && best.score > 0 ? best.kind : "general"
  const confidence =
    !best || best.score === 0 ? "low" : best.score >= 5 && best.score - (second?.score ?? 0) >= 2 ? "high" : "medium"

  return {
    kind,
    confidence,
    evidence: best?.evidence ?? [],
    requestedFormats: requestedFormats(goal),
    constraints: requestConstraints(goal),
  }
}

export function workOutputFormatLabel(format: WorkOutputFormat) {
  return {
    docx: "editable DOCX document",
    pdf: "PDF document",
    markdown: "Markdown document",
    pptx: "editable PPTX presentation",
    xlsx: "editable XLSX workbook",
    csv: "CSV dataset",
    json: "JSON file",
    html: "HTML document",
    zip: "ZIP archive",
    "windows-installer": "Windows x64 installer",
  }[format]
}

function requestedFormats(prompt: string) {
  return formatRules
    .flatMap((rule) => {
      const match = prompt.match(rule.pattern)
      return match ? [{ format: rule.format, index: match.index ?? 0 }] : []
    })
    .sort((a, b) => a.index - b.index)
    .map((match) => match.format)
}

function requestConstraints(prompt: string) {
  const constraints: string[] = []
  const add = (value: string | undefined) => {
    if (value && !constraints.includes(value)) constraints.push(value)
  }

  const englishLimit = prompt.match(
    /(?:no more than|under|at most|maximum(?: of)?|max(?:imum)?(?: of)?)\s+(\d+)\s+(slides?|pages?|words?)/i,
  )
  if (englishLimit) add(`Maximum ${englishLimit[1]} ${englishLimit[2]?.toLowerCase()}`)
  const chineseLimit = prompt.match(/(?:不超过|不超過|最多|控制在)\s*(\d+)\s*(页|頁|张|張|字|个?幻灯片|個?投影片)/i)
  if (chineseLimit) add(`Maximum ${chineseLimit[1]} ${chineseLimit[2]}`)

  audienceRules.forEach((rule) => {
    if (rule.pattern.test(prompt)) add(`Audience: ${rule.value}`)
  })
  toneRules.forEach((rule) => {
    if (rule.pattern.test(prompt)) add(`Tone: ${rule.value}`)
  })

  if (/中英双语|中英雙語|双语|雙語|chinese and english|english and chinese|\bbilingual\b/i.test(prompt)) {
    add("Language: Chinese and English")
  } else if (/用中文|中文版本|in chinese/i.test(prompt)) {
    add("Language: Chinese")
  } else if (/用英文|英文版本|in english/i.test(prompt)) {
    add("Language: English")
  }

  const platform = prompt.match(/windows\s*11\s*x64|windows\s*x64|macos|linux/i)
  if (platform) add(`Target platform: ${platform[0]}`)
  if (/editable|can edit|可编辑|可編輯|能(?:继续|繼續)?(?:编辑|編輯)|能改(?:的|動)?(?:结果|結果)?/i.test(prompt)) {
    add("Deliverable remains editable")
  }
  if (
    /citations?|references?|traceable sources|credible sources|有据可查|有據可查|引用|参考文献|參考文獻/i.test(prompt)
  ) {
    add("Claims use traceable sources")
  }
  if (
    /don't break existing user data|do not break existing user data|preserve existing user data|保留现有用户数据|保留現有使用者資料/i.test(
      prompt,
    )
  ) {
    add("Preserve existing user data")
  }
  if (/coexist|co-exist|共存/i.test(prompt)) add("Coexist with the existing installation")

  const deadline = prompt.match(
    /\b(?:by|before|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow(?: morning| afternoon| evening)?)\b|明早|明天(?:上午|下午)?|周[一二三四五六日天]前|週[一二三四五六日天]前/i,
  )
  if (deadline) add(`Timing: ${deadline[0]}`)

  return constraints
}
