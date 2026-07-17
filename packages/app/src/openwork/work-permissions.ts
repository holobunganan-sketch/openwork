export type WorkPermissionDecision = "allow" | "ask"

export type WorkPermissions = {
  read: WorkPermissionDecision
  workspace: WorkPermissionDecision
  commands: WorkPermissionDecision
  network: WorkPermissionDecision
  external: WorkPermissionDecision
  destructive: "ask"
}

export type WorkPermissionRequest = {
  permission: string
  patterns?: string[]
}

const destructive = [
  /(^|\s)(rm|rmdir|del|erase|format|mkfs|diskpart)(\s|$)/i,
  /(^|\s)(shred|wipefs|remove-item)(\s|$)/i,
  /(^|\s)dd\s+.*\bof=/i,
  /git\s+(reset\s+--hard|clean\s+-[a-z]*f|push\s+--force|branch\s+-D)/i,
  /(^|\s)(drop|truncate)\s+(table|database)/i,
  /terraform\s+destroy/i,
  /kubectl\s+delete/i,
  /(^|\s)(shutdown|reboot|poweroff)(\s|$)/i,
]

const external = [
  /git\s+push(\s|$)/i,
  /(^|\s)(gh|glab)\s+(api|pr|issue|release|repo)(\s|$)/i,
  /(^|\s)(npm|pnpm|yarn|bun|cargo)\s+publish(\s|$)/i,
  /(^|\s)(kubectl\s+(apply|create|patch|replace)|terraform\s+apply)(\s|$)/i,
]

const network = [
  /(^|\s)(curl|wget)(\s|$)/i,
  /git\s+(clone|fetch|pull)(\s|$)/i,
  /(^|\s)(npm|pnpm|yarn|bun)\s+(add|install|update)(\s|$)/i,
]

export function defaultWorkPermissions(autonomy: "plan" | "collaborate" | "agent"): WorkPermissions {
  if (autonomy === "plan") {
    return { read: "allow", workspace: "ask", commands: "ask", network: "ask", external: "ask", destructive: "ask" }
  }
  if (autonomy === "agent") {
    return {
      read: "allow",
      workspace: "allow",
      commands: "allow",
      network: "allow",
      external: "ask",
      destructive: "ask",
    }
  }
  return {
    read: "allow",
    workspace: "allow",
    commands: "ask",
    network: "ask",
    external: "ask",
    destructive: "ask",
  }
}

export function workPermissionCategory(request: WorkPermissionRequest): keyof WorkPermissions {
  const permission = request.permission
  if (permission === "bash" && request.patterns?.some((pattern) => destructive.some((rule) => rule.test(pattern)))) {
    return "destructive"
  }
  if (permission === "bash" && request.patterns?.some((pattern) => external.some((rule) => rule.test(pattern)))) {
    return "external"
  }
  if (permission === "bash" && request.patterns?.some((pattern) => network.some((rule) => rule.test(pattern)))) {
    return "network"
  }
  if (["read", "glob", "grep", "lsp", "skill", "todowrite"].includes(permission)) return "read"
  if (permission === "edit") return "workspace"
  if (permission === "bash") return "commands"
  if (["webfetch", "websearch"].includes(permission)) return "network"
  if (permission === "external_directory") return "external"
  if (permission === "workflow_tool_approval" || permission.startsWith("mcp_")) return "external"
  if (permission === "doom_loop") return "destructive"
  return "external"
}

export function workPermissionAllows(profile: WorkPermissions, request: WorkPermissionRequest) {
  return profile[workPermissionCategory(request)] === "allow"
}
