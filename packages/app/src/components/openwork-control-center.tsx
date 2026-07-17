import type { OpenWorkMcpServer, OpenWorkSkill, OpenWorkSkillZipPreview, OpenWorkUsage } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { createMemo, createSignal, For, onMount, Show } from "solid-js"

type Tab = "skills" | "mcp" | "usage"

export function OpenWorkLaunchpad(props: {
  disabled: boolean
  onTask: (prompt: string) => void
  onManage: () => void
}) {
  const language = useLanguage()
  const platform = usePlatform()
  const tasks = createMemo(() => [
    {
      id: "document",
      icon: "edit",
      title: language.t("openwork.task.document.title"),
      description: language.t("openwork.task.document.description"),
      prompt: language.t("openwork.task.document.prompt"),
    },
    {
      id: "research",
      icon: "magnifying-glass",
      title: language.t("openwork.task.research.title"),
      description: language.t("openwork.task.research.description"),
      prompt: language.t("openwork.task.research.prompt"),
    },
    {
      id: "data",
      icon: "status",
      title: language.t("openwork.task.data.title"),
      description: language.t("openwork.task.data.description"),
      prompt: language.t("openwork.task.data.prompt"),
    },
    {
      id: "presentation",
      icon: "grid-plus",
      title: language.t("openwork.task.presentation.title"),
      description: language.t("openwork.task.presentation.description"),
      prompt: language.t("openwork.task.presentation.prompt"),
    },
    {
      id: "code",
      icon: "branch",
      title: language.t("openwork.task.code.title"),
      description: language.t("openwork.task.code.description"),
      prompt: language.t("openwork.task.code.prompt"),
    },
  ])

  return (
    <section class="mb-7 flex min-w-0 flex-col gap-3" aria-label={language.t("openwork.home.title")}>
      <div class="flex min-w-0 items-end justify-between gap-4">
        <div class="min-w-0">
          <h1 class="m-0 text-[22px] leading-7 tracking-[-0.35px] text-v2-text-text-base [font-weight:600]">
            {language.t("openwork.home.title")}
          </h1>
          <p class="m-0 mt-1 text-[13px] leading-5 text-v2-text-text-muted">
            {language.t("openwork.home.description")}
          </p>
        </div>
        <Show when={platform.openwork}>
          <ButtonV2 variant="outline" icon="settings-gear" class="shrink-0" onClick={props.onManage}>
            {language.t("openwork.manage")}
          </ButtonV2>
        </Show>
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <For each={tasks()}>
          {(task) => (
            <button
              type="button"
              disabled={props.disabled}
              class="group flex min-h-[92px] min-w-0 cursor-pointer flex-col items-start gap-2 rounded-[8px] border border-v2-border-border-muted bg-v2-background-bg-layer-01 px-3 py-3 text-left transition-colors hover:bg-v2-background-bg-layer-02 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => props.onTask(task.prompt)}
            >
              <span class="flex items-center gap-2 text-[13px] text-v2-text-text-base [font-weight:560]">
                <Icon name={task.icon} class="text-v2-icon-icon-muted group-hover:text-v2-icon-icon-base" />
                {task.title}
              </span>
              <span class="text-[12px] leading-4 text-v2-text-text-muted">{task.description}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={props.disabled}>
        <p class="m-0 text-[12px] text-v2-text-text-muted">{language.t("openwork.home.projectRequired")}</p>
      </Show>
    </section>
  )
}

export function DialogOpenWorkControlCenter() {
  const platform = usePlatform()
  const language = useLanguage()
  const api = platform.openwork
  const [tab, setTab] = createSignal<Tab>("skills")
  const [skills, setSkills] = createSignal<OpenWorkSkill[]>([])
  const [servers, setServers] = createSignal<OpenWorkMcpServer[]>([])
  const [usage, setUsage] = createSignal<OpenWorkUsage>()
  const [skillPending, setSkillPending] = createSignal<{ data: ArrayBuffer; preview: OpenWorkSkillZipPreview }>()
  const [mcpInput, setMcpInput] = createSignal("")
  const [mcpPreview, setMcpPreview] = createSignal("")
  const [status, setStatus] = createSignal("")
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  async function refresh() {
    if (!api) return
    const [skillList, serverList, currentUsage] = await Promise.all([
      api.skills.list(),
      api.mcp.list(),
      api.usage.get(),
    ])
    setSkills(skillList)
    setServers(serverList)
    setUsage(currentUsage)
  }

  async function act(operation: () => Promise<void>, success?: string) {
    setBusy(true)
    setError("")
    setStatus("")
    try {
      await operation()
      if (success) setStatus(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  onMount(() => void act(refresh))

  function chooseSkillZip() {
    if (!api || !platform.openAttachmentPickerDialog) return
    void act(() =>
      platform.openAttachmentPickerDialog!(
        { title: language.t("openwork.skills.choose"), extensions: ["zip"] },
        async (file) => {
          const data = await file.arrayBuffer()
          setSkillPending({ data, preview: await api.skills.previewZip(data) })
        },
      ),
    )
  }

  function confirmSkillInstall() {
    if (!api) return
    const pending = skillPending()
    if (!pending) return
    void act(async () => {
      await api.skills.installZip(pending.data)
      setSkillPending(undefined)
      setSkills(await api.skills.list())
    }, language.t("openwork.skills.install.success"))
  }

  function mutateSkill(operation: () => Promise<OpenWorkSkill[]>, success: string) {
    void act(async () => {
      setSkills(await operation())
    }, success)
  }

  function previewMcp() {
    if (!api) return
    void act(async () => {
      const preview = await api.mcp.previewImport(mcpInput())
      setMcpPreview(
        `${preview.format}: ${preview.servers.map((server) => server.name).join(", ")}${
          preview.warnings.length ? ` · ${preview.warnings.length} secret field(s)` : ""
        }`,
      )
    })
  }

  function applyMcp() {
    if (!api) return
    void act(async () => {
      const result = await api.mcp.applyImport(mcpInput())
      setServers(result.servers)
      setMcpInput("")
      setMcpPreview("")
      setStatus(
        result.restartRequired ? language.t("openwork.mcp.restartRequired") : language.t("openwork.mcp.import.success"),
      )
    })
  }

  function mutateMcp(operation: () => Promise<{ servers: OpenWorkMcpServer[]; restartRequired: boolean }>) {
    void act(async () => {
      const result = await operation()
      setServers(result.servers)
      setStatus(result.restartRequired ? language.t("openwork.mcp.restartRequired") : language.t("openwork.mcp.saved"))
    })
  }

  return (
    <Dialog size="x-large" variant="settings" class="!h-[min(760px,calc(100vh-16px))]">
      <DialogHeader>
        <DialogTitle>{language.t("openwork.control.title")}</DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
        <div class="flex shrink-0 gap-2" role="tablist">
          <For each={["skills", "mcp", "usage"] as const}>
            {(item) => (
              <ButtonV2
                variant={tab() === item ? "contrast" : "neutral"}
                onClick={() => {
                  setTab(item)
                  setError("")
                  setStatus("")
                }}
              >
                {language.t(`openwork.tab.${item}`)}
              </ButtonV2>
            )}
          </For>
        </div>

        <Show when={error()}>
          <div class="shrink-0 rounded-[6px] bg-v2-state-bg-danger px-3 py-2 text-[12px] text-v2-state-fg-danger">
            {error()}
          </div>
        </Show>
        <Show when={status()}>
          <div class="shrink-0 rounded-[6px] bg-v2-background-bg-layer-02 px-3 py-2 text-[12px] text-v2-text-text-base">
            {status()}
          </div>
        </Show>

        <Show when={tab() === "skills"}>
          <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <div class="flex items-center justify-between gap-3">
              <p class="m-0 text-[12px] leading-5 text-v2-text-text-muted">
                {language.t("openwork.skills.description")}
              </p>
              <ButtonV2 icon="plus" variant="contrast" disabled={busy() || !api} onClick={chooseSkillZip}>
                {language.t("openwork.skills.choose")}
              </ButtonV2>
            </div>
            <Show when={skillPending()}>
              {(pending) => (
                <div class="flex items-center gap-3 rounded-[8px] border border-v2-border-border-focus bg-v2-background-bg-layer-01 px-3 py-3">
                  <Icon name="archive" class="shrink-0 text-v2-icon-icon-muted" />
                  <div class="min-w-0 flex-1">
                    <div class="text-[13px] text-v2-text-text-base [font-weight:560]">{pending().preview.name}</div>
                    <p class="m-0 mt-1 text-[12px] text-v2-text-text-muted">
                      {pending().preview.fileCount} {language.t("openwork.skills.preview.files")} ·{" "}
                      {Math.ceil(pending().preview.uncompressedBytes / 1024)} KB
                      {pending().preview.replacesExisting ? ` · ${language.t("openwork.skills.preview.replace")}` : ""}
                    </p>
                  </div>
                  <ButtonV2 disabled={busy()} onClick={() => setSkillPending(undefined)}>
                    {language.t("common.cancel")}
                  </ButtonV2>
                  <ButtonV2 variant="contrast" disabled={busy()} onClick={confirmSkillInstall}>
                    {language.t("openwork.skills.install")}
                  </ButtonV2>
                </div>
              )}
            </Show>
            <Show when={skills().length > 0} fallback={<EmptyState text={language.t("openwork.skills.empty")} />}>
              <For each={skills()}>
                {(skill) => (
                  <div class="flex items-center gap-3 rounded-[8px] border border-v2-border-border-muted px-3 py-3">
                    <Icon name={skill.enabled ? "check" : "archive"} class="shrink-0 text-v2-icon-icon-muted" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 text-[13px] text-v2-text-text-base [font-weight:560]">
                        <span class="truncate">{skill.name}</span>
                        <span class="rounded bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-[10px] text-v2-text-text-muted">
                          {skill.source}
                        </span>
                        <Show when={!skill.installed}>
                          <span class="rounded bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-[10px] text-v2-text-text-muted">
                            {language.t("openwork.skills.backupOnly")}
                          </span>
                        </Show>
                      </div>
                      <p class="m-0 mt-1 line-clamp-2 text-[12px] leading-4 text-v2-text-text-muted">
                        {skill.description || skill.id}
                      </p>
                    </div>
                    <Show when={skill.managed}>
                      <div class="flex shrink-0 flex-wrap justify-end gap-1">
                        <Show
                          when={skill.installed}
                          fallback={
                            <ButtonV2
                              size="small"
                              disabled={busy()}
                              onClick={() =>
                                mutateSkill(() => api!.skills.rollback(skill.id), language.t("openwork.skills.saved"))
                              }
                            >
                              {language.t("openwork.skills.rollback")}
                            </ButtonV2>
                          }
                        >
                          <ButtonV2
                            size="small"
                            disabled={busy()}
                            onClick={() =>
                              mutateSkill(
                                () => api!.skills.setEnabled(skill.id, !skill.enabled),
                                language.t("openwork.skills.saved"),
                              )
                            }
                          >
                            {skill.enabled
                              ? language.t("openwork.skills.disable")
                              : language.t("openwork.skills.enable")}
                          </ButtonV2>
                          <ButtonV2 size="small" disabled={busy()} onClick={() => void api!.skills.exportZip(skill.id)}>
                            {language.t("openwork.skills.export")}
                          </ButtonV2>
                          <Show when={skill.hasBackup}>
                            <ButtonV2
                              size="small"
                              disabled={busy()}
                              onClick={() =>
                                mutateSkill(() => api!.skills.rollback(skill.id), language.t("openwork.skills.saved"))
                              }
                            >
                              {language.t("openwork.skills.rollback")}
                            </ButtonV2>
                          </Show>
                          <ButtonV2
                            size="small"
                            variant="danger"
                            disabled={busy()}
                            onClick={() =>
                              mutateSkill(
                                () => api!.skills.uninstall(skill.id),
                                language.t("openwork.skills.uninstalled"),
                              )
                            }
                          >
                            {language.t("openwork.skills.uninstall")}
                          </ButtonV2>
                        </Show>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>

        <Show when={tab() === "mcp"}>
          <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <p class="m-0 text-[12px] leading-5 text-v2-text-text-muted">{language.t("openwork.mcp.description")}</p>
            <TextareaV2
              class="!w-full [&_[data-slot=textarea-v2-textarea]]:min-h-28 [&_[data-slot=textarea-v2-textarea]]:font-mono"
              rows={6}
              spellcheck={false}
              value={mcpInput()}
              placeholder={language.t("openwork.mcp.placeholder")}
              onInput={(event) => setMcpInput(event.currentTarget.value)}
            />
            <div class="flex items-center gap-2">
              <ButtonV2 disabled={busy() || !mcpInput().trim()} onClick={previewMcp}>
                {language.t("openwork.mcp.preview")}
              </ButtonV2>
              <ButtonV2 variant="contrast" disabled={busy() || !mcpInput().trim()} onClick={applyMcp}>
                {language.t("openwork.mcp.import")}
              </ButtonV2>
              <ButtonV2 class="ml-auto" disabled={busy()} onClick={() => mutateMcp(() => api!.mcp.restoreLatest())}>
                {language.t("openwork.mcp.restore")}
              </ButtonV2>
            </div>
            <Show when={mcpPreview()}>
              <p class="m-0 text-[12px] text-v2-text-text-base">{mcpPreview()}</p>
            </Show>
            <Show when={servers().length > 0} fallback={<EmptyState text={language.t("openwork.mcp.empty")} />}>
              <For each={servers()}>
                {(server) => (
                  <div class="flex items-center gap-3 rounded-[8px] border border-v2-border-border-muted px-3 py-3">
                    <Icon name={server.enabled ? "status-active" : "status"} class="shrink-0 text-v2-icon-icon-muted" />
                    <div class="min-w-0 flex-1">
                      <div class="text-[13px] text-v2-text-text-base [font-weight:560]">{server.name}</div>
                      <p class="m-0 mt-1 truncate text-[12px] text-v2-text-text-muted">
                        {server.type} · {server.summary}
                        {server.secretFields.length
                          ? ` · ${server.secretFields.length} ${language.t("openwork.mcp.secrets")}`
                          : ""}
                      </p>
                    </div>
                    <ButtonV2
                      size="small"
                      disabled={busy()}
                      onClick={() => mutateMcp(() => api!.mcp.setEnabled(server.name, !server.enabled))}
                    >
                      {server.enabled ? language.t("openwork.skills.disable") : language.t("openwork.skills.enable")}
                    </ButtonV2>
                    <ButtonV2
                      size="small"
                      variant="danger"
                      disabled={busy()}
                      onClick={() => mutateMcp(() => api!.mcp.remove(server.name))}
                    >
                      {language.t("common.delete")}
                    </ButtonV2>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>

        <Show when={tab() === "usage"}>
          <UsagePanel usage={usage()} refresh={() => void act(refresh)} busy={busy()} />
        </Show>
      </DialogBody>
    </Dialog>
  )
}

function EmptyState(props: { text: string }) {
  return (
    <div class="rounded-[8px] border border-dashed border-v2-border-border-muted px-4 py-8 text-center text-[12px] text-v2-text-text-muted">
      {props.text}
    </div>
  )
}

function UsagePanel(props: { usage?: OpenWorkUsage; refresh: () => void; busy: boolean }) {
  const language = useLanguage()
  const platform = usePlatform()
  return (
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-[15px] text-v2-text-text-base [font-weight:600]">{language.t("openwork.usage.title")}</h2>
          <p class="m-0 mt-1 text-[12px] leading-5 text-v2-text-text-muted">
            {props.usage?.notice ?? language.t("common.loading")}
          </p>
        </div>
        <ButtonV2 disabled={props.busy} onClick={props.refresh}>
          {language.t("openwork.refresh")}
        </ButtonV2>
      </div>
      <Show when={props.usage}>
        {(usage) => (
          <>
            <div class="rounded-[8px] bg-v2-background-bg-layer-01 px-3 py-2 text-[12px] text-v2-text-text-muted">
              {language.t("openwork.usage.source")}: {usage().source} · {usage().sessionCount}{" "}
              {language.t("openwork.usage.sessions")}
            </div>
            <For each={usage().periods}>
              {(period) => {
                const percent = () => Math.max(0, Math.min(100, (period.used / period.limit) * 100))
                return (
                  <div class="flex flex-col gap-2 rounded-[8px] border border-v2-border-border-muted px-3 py-3">
                    <div class="flex items-center justify-between text-[13px]">
                      <span class="text-v2-text-text-base [font-weight:560]">
                        {language.t(`openwork.usage.period.${period.id}`)}
                      </span>
                      <span class="text-v2-text-text-muted">
                        ${period.used.toFixed(2)} / ${period.limit.toFixed(2)}
                      </span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-v2-background-bg-layer-02">
                      <div class="h-full rounded-full bg-v2-icon-icon-base" style={{ width: `${percent()}%` }} />
                    </div>
                  </div>
                )
              }}
            </For>
            <ButtonV2 variant="outline" onClick={() => platform.openLink(usage().documentationUrl)}>
              {language.t("openwork.usage.docs")}
            </ButtonV2>
          </>
        )}
      </Show>
    </div>
  )
}
