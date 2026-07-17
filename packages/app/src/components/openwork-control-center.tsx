import type { OpenWorkMcpServer, OpenWorkSkill, OpenWorkSkillZipPreview, OpenWorkUsage } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { createWorkSpec, type WorkAutonomy, type WorkKind, type WorkSpec } from "@/openwork/work-spec"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { createEffect, createMemo, For, onMount, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"

export function OpenWorkLaunchpad(props: { disabled: boolean; onTask: (workSpec: WorkSpec) => void }) {
  const language = useLanguage()
  const [state, setState] = createStore({
    prompt: "",
    kind: undefined as WorkKind | undefined,
    autonomy: "collaborate" as WorkAutonomy,
  })
  const tasks = createMemo(() => [
    {
      kind: "document" as const,
      icon: "edit" as const,
      title: language.t("openwork.task.document.title"),
      prompt: language.t("openwork.task.document.prompt"),
    },
    {
      kind: "research" as const,
      icon: "magnifying-glass" as const,
      title: language.t("openwork.task.research.title"),
      prompt: language.t("openwork.task.research.prompt"),
    },
    {
      kind: "data" as const,
      icon: "status" as const,
      title: language.t("openwork.task.data.title"),
      prompt: language.t("openwork.task.data.prompt"),
    },
    {
      kind: "presentation" as const,
      icon: "grid-plus" as const,
      title: language.t("openwork.task.presentation.title"),
      prompt: language.t("openwork.task.presentation.prompt"),
    },
    {
      kind: "software" as const,
      icon: "branch" as const,
      title: language.t("openwork.task.code.title"),
      prompt: language.t("openwork.task.code.prompt"),
    },
  ])
  const modes = createMemo(() => [
    {
      id: "plan" as const,
      label: language.t("openwork.autonomy.plan"),
      description: language.t("openwork.autonomy.plan.description"),
    },
    {
      id: "collaborate" as const,
      label: language.t("openwork.autonomy.collaborate"),
      description: language.t("openwork.autonomy.collaborate.description"),
    },
    {
      id: "agent" as const,
      label: language.t("openwork.autonomy.agent"),
      description: language.t("openwork.autonomy.agent.description"),
    },
  ])
  const workSpec = createMemo(() =>
    createWorkSpec({ prompt: state.prompt, kind: state.kind, autonomy: state.autonomy }),
  )

  function start() {
    if (props.disabled || !state.prompt.trim()) return
    props.onTask(workSpec())
  }

  return (
    <section
      class="mb-8 flex min-w-0 flex-col items-center pt-8 lg:pt-12"
      aria-label={language.t("openwork.home.title")}
    >
      <div class="w-full max-w-[720px]">
        <div class="mb-6 text-center">
          <h1 class="m-0 text-[28px] leading-9 tracking-[-0.6px] text-v2-text-text-base [font-weight:620]">
            {language.t("openwork.home.title")}
          </h1>
          <p class="m-0 mt-2 text-[13px] leading-5 text-v2-text-text-muted">
            {language.t("openwork.home.description")}
          </p>
        </div>

        <div class="rounded-[14px] border border-v2-border-border-muted bg-v2-background-bg-layer-01 p-2 shadow-[var(--v2-elevation-raised)] focus-within:border-v2-border-border-focus">
          <TextareaV2
            class="!w-full [&_[data-slot=textarea-v2-textarea]]:min-h-28 [&_[data-slot=textarea-v2-textarea]]:resize-none [&_[data-slot=textarea-v2-textarea]]:border-0 [&_[data-slot=textarea-v2-textarea]]:bg-transparent [&_[data-slot=textarea-v2-textarea]]:text-[15px] [&_[data-slot=textarea-v2-textarea]]:leading-6 [&_[data-slot=textarea-v2-textarea]]:shadow-none"
            rows={4}
            value={state.prompt}
            placeholder={language.t("openwork.composer.placeholder")}
            onInput={(event) => {
              setState("prompt", event.currentTarget.value)
              setState("kind", undefined)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return
              event.preventDefault()
              start()
            }}
          />
          <div class="flex flex-wrap items-center gap-2 border-t border-v2-border-border-muted px-1 pt-2">
            <div class="flex min-w-0 flex-1 items-center gap-1" aria-label={language.t("openwork.autonomy.label")}>
              <For each={modes()}>
                {(mode) => (
                  <button
                    type="button"
                    title={mode.description}
                    data-selected={state.autonomy === mode.id ? "" : undefined}
                    class="h-7 rounded-[6px] border-0 bg-transparent px-2 text-[11px] text-v2-text-text-muted transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-text-text-base data-[selected]:bg-v2-background-bg-layer-03 data-[selected]:text-v2-text-text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus"
                    onClick={() => setState("autonomy", mode.id)}
                  >
                    {mode.label}
                  </button>
                )}
              </For>
            </div>
            <ButtonV2
              variant="contrast"
              icon="arrow-up"
              disabled={props.disabled || !state.prompt.trim()}
              onClick={start}
            >
              {language.t("openwork.composer.start")}
            </ButtonV2>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap justify-center gap-1.5">
          <For each={tasks()}>
            {(task) => (
              <button
                type="button"
                disabled={props.disabled}
                class="inline-flex h-8 items-center gap-1.5 rounded-full border border-v2-border-border-muted bg-v2-background-bg-base px-3 text-[11px] text-v2-text-text-muted transition-colors hover:bg-v2-background-bg-layer-01 hover:text-v2-text-text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus disabled:opacity-50"
                onClick={() => {
                  setState("prompt", task.prompt)
                  setState("kind", task.kind)
                }}
              >
                <Icon name={task.icon} size="small" />
                {task.title}
              </button>
            )}
          </For>
        </div>
        <Show when={props.disabled}>
          <p class="m-0 mt-3 text-center text-[12px] text-v2-text-text-muted">
            {language.t("openwork.home.projectRequired")}
          </p>
        </Show>
      </div>
    </section>
  )
}

export function SettingsOpenWorkSkills() {
  const platform = usePlatform()
  const language = useLanguage()
  const api = platform.openwork
  const [state, setState] = createStore<{
    items: OpenWorkSkill[]
    selectedID: string
    pending?: { data: ArrayBuffer; preview: OpenWorkSkillZipPreview }
    busy: boolean
    status: string
    error: string
  }>({ items: [], selectedID: "", busy: false, status: "", error: "" })
  const selected = createMemo(() => state.items.find((skill) => skill.id === state.selectedID) ?? state.items[0])

  async function run(operation: () => Promise<void>, success?: string) {
    setState({ busy: true, status: "", error: "" })
    try {
      await operation()
      if (success) setState("status", success)
    } catch (cause) {
      setState("error", errorMessage(cause))
    } finally {
      setState("busy", false)
    }
  }

  async function refresh() {
    if (!api) return
    setState("items", await api.skills.list())
  }

  onMount(() => void run(refresh))
  createEffect(() => {
    if (state.items.some((skill) => skill.id === state.selectedID)) return
    setState("selectedID", state.items[0]?.id ?? "")
  })

  function chooseZip() {
    if (!api || !platform.openAttachmentPickerDialog) return
    void run(() =>
      platform.openAttachmentPickerDialog!(
        { title: language.t("openwork.skills.choose"), extensions: ["zip"] },
        async (file) => {
          const data = await file.arrayBuffer()
          setState("pending", { data, preview: await api.skills.previewZip(data) })
        },
      ),
    )
  }

  function install() {
    const pending = state.pending
    if (!api || !pending) return
    void run(async () => {
      const result = await api.skills.installZip(pending.data)
      setState({ pending: undefined, selectedID: result.skill.id })
      await refresh()
    }, language.t("openwork.skills.install.success"))
  }

  function mutate(operation: () => Promise<OpenWorkSkill[]>, success: string) {
    void run(async () => setState("items", await operation()), success)
  }

  if (!api) return <OpenWorkUnavailable />
  return (
    <OpenWorkSettingsPage
      title={language.t("openwork.settings.skills.title")}
      description={language.t("openwork.skills.description")}
      action={
        <ButtonV2 icon="plus" variant="contrast" disabled={state.busy} onClick={chooseZip}>
          {language.t("openwork.skills.choose")}
        </ButtonV2>
      }
      status={state.status}
      error={state.error}
    >
      <Show when={state.pending}>
        {(pending) => (
          <div class="mb-3 flex items-center gap-3 rounded-[8px] border border-v2-border-border-focus bg-v2-background-bg-layer-01 px-3 py-3">
            <Icon name="archive" class="shrink-0 text-v2-icon-icon-muted" />
            <div class="min-w-0 flex-1">
              <div class="text-[13px] text-v2-text-text-base [font-weight:560]">{pending().preview.name}</div>
              <p class="m-0 mt-1 text-[11px] text-v2-text-text-muted">
                {pending().preview.fileCount} {language.t("openwork.skills.preview.files")} ·{" "}
                {Math.ceil(pending().preview.uncompressedBytes / 1024)} KB
              </p>
            </div>
            <ButtonV2 size="small" disabled={state.busy} onClick={() => setState("pending", undefined)}>
              {language.t("common.cancel")}
            </ButtonV2>
            <ButtonV2 size="small" variant="contrast" disabled={state.busy} onClick={install}>
              {language.t("openwork.skills.install")}
            </ButtonV2>
          </div>
        )}
      </Show>
      <div class="flex min-h-0 flex-1 overflow-hidden rounded-[9px] border border-v2-border-border-muted bg-v2-background-bg-base">
        <div class="w-[230px] shrink-0 overflow-y-auto border-r border-v2-border-border-muted py-1.5">
          <Show when={state.items.length} fallback={<EmptyState text={language.t("openwork.skills.empty")} />}>
            <For each={state.items}>
              {(skill) => (
                <button
                  type="button"
                  data-selected={selected()?.id === skill.id ? "" : undefined}
                  class="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-2 text-left hover:bg-v2-overlay-simple-overlay-hover data-[selected]:bg-v2-background-bg-layer-02 focus-visible:outline-none"
                  onClick={() => setState("selectedID", skill.id)}
                >
                  <span
                    class={`size-2 shrink-0 rounded-full ${skill.enabled ? "bg-v2-state-fg-success" : "bg-v2-icon-icon-disabled"}`}
                  />
                  <span class="min-w-0 flex-1 truncate text-[12px] text-v2-text-text-base">{skill.name}</span>
                </button>
              )}
            </For>
          </Show>
        </div>
        <div class="min-w-0 flex-1 overflow-y-auto p-5">
          <Show when={selected()} fallback={<EmptyState text={language.t("openwork.skills.empty")} />}>
            {(skill) => (
              <div class="flex min-h-full flex-col">
                <div class="flex items-start gap-3">
                  <div class="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-v2-background-bg-layer-02">
                    <Icon name="archive" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="m-0 text-[15px] text-v2-text-text-base [font-weight:600]">{skill().name}</h3>
                    <p class="m-0 mt-1 text-[12px] leading-5 text-v2-text-text-muted">
                      {skill().description || skill().id}
                    </p>
                  </div>
                </div>
                <dl class="mt-6 grid grid-cols-[110px_1fr] gap-y-3 text-[12px]">
                  <dt class="text-v2-text-text-muted">{language.t("openwork.settings.status")}</dt>
                  <dd class="m-0 text-v2-text-text-base">
                    {skill().enabled ? language.t("openwork.skills.enabled") : language.t("openwork.skills.disabled")}
                  </dd>
                  <dt class="text-v2-text-text-muted">{language.t("openwork.settings.source")}</dt>
                  <dd class="m-0 text-v2-text-text-base">{skill().source}</dd>
                  <dt class="text-v2-text-text-muted">ID</dt>
                  <dd class="m-0 break-all font-mono text-v2-text-text-base">{skill().id}</dd>
                </dl>
                <Show when={skill().managed}>
                  <div class="mt-auto flex flex-wrap gap-2 border-t border-v2-border-border-muted pt-4">
                    <Show
                      when={skill().installed}
                      fallback={
                        <ButtonV2
                          disabled={state.busy}
                          onClick={() =>
                            mutate(() => api.skills.rollback(skill().id), language.t("openwork.skills.saved"))
                          }
                        >
                          {language.t("openwork.skills.rollback")}
                        </ButtonV2>
                      }
                    >
                      <ButtonV2
                        variant="contrast"
                        disabled={state.busy}
                        onClick={() =>
                          mutate(
                            () => api.skills.setEnabled(skill().id, !skill().enabled),
                            language.t("openwork.skills.saved"),
                          )
                        }
                      >
                        {skill().enabled ? language.t("openwork.skills.disable") : language.t("openwork.skills.enable")}
                      </ButtonV2>
                      <ButtonV2 disabled={state.busy} onClick={() => void api.skills.exportZip(skill().id)}>
                        {language.t("openwork.skills.export")}
                      </ButtonV2>
                      <Show when={skill().hasBackup}>
                        <ButtonV2
                          disabled={state.busy}
                          onClick={() =>
                            mutate(() => api.skills.rollback(skill().id), language.t("openwork.skills.saved"))
                          }
                        >
                          {language.t("openwork.skills.rollback")}
                        </ButtonV2>
                      </Show>
                      <ButtonV2
                        class="ml-auto"
                        variant="danger"
                        disabled={state.busy}
                        onClick={() =>
                          mutate(() => api.skills.uninstall(skill().id), language.t("openwork.skills.uninstalled"))
                        }
                      >
                        {language.t("openwork.skills.uninstall")}
                      </ButtonV2>
                    </Show>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </div>
    </OpenWorkSettingsPage>
  )
}

export function SettingsOpenWorkMcp() {
  const platform = usePlatform()
  const language = useLanguage()
  const api = platform.openwork
  const [state, setState] = createStore({
    items: [] as OpenWorkMcpServer[],
    selectedName: "",
    importing: false,
    input: "",
    preview: "",
    busy: false,
    status: "",
    error: "",
  })
  const selected = createMemo(() => state.items.find((server) => server.name === state.selectedName) ?? state.items[0])

  async function run(operation: () => Promise<void>, success?: string) {
    setState({ busy: true, status: "", error: "" })
    try {
      await operation()
      if (success) setState("status", success)
    } catch (cause) {
      setState("error", errorMessage(cause))
    } finally {
      setState("busy", false)
    }
  }

  async function refresh() {
    if (!api) return
    setState("items", await api.mcp.list())
  }

  onMount(() => void run(refresh))
  createEffect(() => {
    if (state.items.some((server) => server.name === state.selectedName)) return
    setState("selectedName", state.items[0]?.name ?? "")
  })

  function preview() {
    if (!api) return
    void run(async () => {
      const result = await api.mcp.previewImport(state.input)
      setState(
        "preview",
        `${result.format} · ${result.servers.map((server) => server.name).join(", ")}${result.warnings.length ? ` · ${result.warnings.length} ${language.t("openwork.mcp.secrets")}` : ""}`,
      )
    })
  }

  function apply() {
    if (!api) return
    void run(async () => {
      const result = await api.mcp.applyImport(state.input)
      setState({ items: result.servers, input: "", preview: "", importing: false })
      setState(
        "status",
        result.restartRequired ? language.t("openwork.mcp.restartRequired") : language.t("openwork.mcp.import.success"),
      )
    })
  }

  function mutate(operation: () => Promise<{ servers: OpenWorkMcpServer[]; restartRequired: boolean }>) {
    if (!api) return
    void run(async () => {
      const result = await operation()
      setState("items", result.servers)
      setState(
        "status",
        result.restartRequired ? language.t("openwork.mcp.restartRequired") : language.t("openwork.mcp.saved"),
      )
    })
  }

  if (!api) return <OpenWorkUnavailable />
  return (
    <OpenWorkSettingsPage
      title={language.t("openwork.settings.mcp.title")}
      description={language.t("openwork.mcp.description")}
      action={
        <ButtonV2 icon="plus" variant="contrast" disabled={state.busy} onClick={() => setState("importing", true)}>
          {language.t("openwork.mcp.import")}
        </ButtonV2>
      }
      status={state.status}
      error={state.error}
    >
      <Show
        when={state.importing}
        fallback={
          <div class="flex min-h-0 flex-1 overflow-hidden rounded-[9px] border border-v2-border-border-muted bg-v2-background-bg-base">
            <div class="w-[230px] shrink-0 overflow-y-auto border-r border-v2-border-border-muted py-1.5">
              <Show when={state.items.length} fallback={<EmptyState text={language.t("openwork.mcp.empty")} />}>
                <For each={state.items}>
                  {(server) => (
                    <button
                      type="button"
                      data-selected={selected()?.name === server.name ? "" : undefined}
                      class="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-2 text-left hover:bg-v2-overlay-simple-overlay-hover data-[selected]:bg-v2-background-bg-layer-02 focus-visible:outline-none"
                      onClick={() => setState("selectedName", server.name)}
                    >
                      <span
                        class={`size-2 shrink-0 rounded-full ${server.enabled ? "bg-v2-state-fg-success" : "bg-v2-icon-icon-disabled"}`}
                      />
                      <span class="min-w-0 flex-1 truncate text-[12px] text-v2-text-text-base">{server.name}</span>
                    </button>
                  )}
                </For>
              </Show>
            </div>
            <div class="min-w-0 flex-1 overflow-y-auto p-5">
              <Show when={selected()} fallback={<EmptyState text={language.t("openwork.mcp.empty")} />}>
                {(server) => (
                  <div class="flex min-h-full flex-col">
                    <div class="flex items-start gap-3">
                      <div class="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-v2-background-bg-layer-02">
                        <Icon name="server" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <h3 class="m-0 text-[15px] text-v2-text-text-base [font-weight:600]">{server().name}</h3>
                        <p class="m-0 mt-1 text-[12px] leading-5 text-v2-text-text-muted">{server().summary}</p>
                      </div>
                    </div>
                    <dl class="mt-6 grid grid-cols-[110px_1fr] gap-y-3 text-[12px]">
                      <dt class="text-v2-text-text-muted">{language.t("openwork.settings.status")}</dt>
                      <dd class="m-0 text-v2-text-text-base">
                        {server().enabled
                          ? language.t("openwork.skills.enabled")
                          : language.t("openwork.skills.disabled")}
                      </dd>
                      <dt class="text-v2-text-text-muted">{language.t("openwork.settings.type")}</dt>
                      <dd class="m-0 text-v2-text-text-base">{server().type}</dd>
                      <dt class="text-v2-text-text-muted">{language.t("openwork.mcp.secrets")}</dt>
                      <dd class="m-0 text-v2-text-text-base">{server().secretFields.length}</dd>
                    </dl>
                    <div class="mt-auto flex gap-2 border-t border-v2-border-border-muted pt-4">
                      <ButtonV2
                        variant="contrast"
                        disabled={state.busy}
                        onClick={() => mutate(() => api.mcp.setEnabled(server().name, !server().enabled))}
                      >
                        {server().enabled
                          ? language.t("openwork.skills.disable")
                          : language.t("openwork.skills.enable")}
                      </ButtonV2>
                      <ButtonV2
                        class="ml-auto"
                        variant="danger"
                        disabled={state.busy}
                        onClick={() => mutate(() => api.mcp.remove(server().name))}
                      >
                        {language.t("common.delete")}
                      </ButtonV2>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          </div>
        }
      >
        <div class="min-h-0 flex-1 overflow-y-auto rounded-[9px] border border-v2-border-border-muted bg-v2-background-bg-base p-5">
          <div class="mx-auto max-w-[620px]">
            <div class="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 class="m-0 text-[15px] text-v2-text-text-base [font-weight:600]">
                  {language.t("openwork.settings.mcp.importTitle")}
                </h3>
                <p class="m-0 mt-1 text-[12px] leading-5 text-v2-text-text-muted">
                  {language.t("openwork.settings.mcp.importDescription")}
                </p>
              </div>
              <ButtonV2 size="small" onClick={() => setState("importing", false)}>
                {language.t("common.cancel")}
              </ButtonV2>
            </div>
            <TextareaV2
              class="!w-full [&_[data-slot=textarea-v2-textarea]]:min-h-52 [&_[data-slot=textarea-v2-textarea]]:font-mono"
              rows={10}
              spellcheck={false}
              value={state.input}
              placeholder={language.t("openwork.mcp.placeholder")}
              onInput={(event) => setState("input", event.currentTarget.value)}
            />
            <Show when={state.preview}>
              <p class="m-0 mt-3 rounded-[6px] bg-v2-background-bg-layer-02 px-3 py-2 text-[12px] text-v2-text-text-base">
                {state.preview}
              </p>
            </Show>
            <div class="mt-4 flex gap-2">
              <ButtonV2 disabled={state.busy || !state.input.trim()} onClick={preview}>
                {language.t("openwork.mcp.preview")}
              </ButtonV2>
              <ButtonV2 variant="contrast" disabled={state.busy || !state.input.trim()} onClick={apply}>
                {language.t("openwork.mcp.import")}
              </ButtonV2>
              <ButtonV2 class="ml-auto" disabled={state.busy} onClick={() => mutate(() => api.mcp.restoreLatest())}>
                {language.t("openwork.mcp.restore")}
              </ButtonV2>
            </div>
          </div>
        </div>
      </Show>
    </OpenWorkSettingsPage>
  )
}

export function SettingsOpenWorkUsage() {
  const platform = usePlatform()
  const language = useLanguage()
  const api = platform.openwork
  const [state, setState] = createStore<{ usage?: OpenWorkUsage; busy: boolean; error: string }>({
    busy: false,
    error: "",
  })

  async function refresh() {
    if (!api) return
    setState({ busy: true, error: "" })
    try {
      setState("usage", await api.usage.get())
    } catch (cause) {
      setState("error", errorMessage(cause))
    } finally {
      setState("busy", false)
    }
  }

  onMount(() => void refresh())
  if (!api) return <OpenWorkUnavailable />
  return (
    <OpenWorkSettingsPage
      title={language.t("openwork.settings.usage.title")}
      description={language.t("openwork.settings.usage.description")}
      action={
        <ButtonV2 disabled={state.busy} onClick={() => void refresh()}>
          {language.t("openwork.refresh")}
        </ButtonV2>
      }
      error={state.error}
    >
      <div class="min-h-0 flex-1 overflow-y-auto rounded-[9px] border border-v2-border-border-muted bg-v2-background-bg-base p-5">
        <Show when={state.usage} fallback={<EmptyState text={language.t("common.loading")} />}>
          {(usage) => (
            <div class="mx-auto max-w-[620px]">
              <div class="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div class="inline-flex rounded-full bg-v2-background-bg-layer-02 px-2.5 py-1 text-[11px] text-v2-text-text-base">
                    {usage().source}
                  </div>
                  <p class="m-0 mt-3 text-[12px] leading-5 text-v2-text-text-muted">{usage().notice}</p>
                </div>
                <span class="text-[11px] text-v2-text-text-muted">{new Date(usage().asOf).toLocaleString()}</span>
              </div>
              <div class="divide-y divide-v2-border-border-muted border-y border-v2-border-border-muted">
                <For each={usage().periods}>
                  {(period) => {
                    const percent = () => Math.max(0, Math.min(100, (period.used / period.limit) * 100))
                    return (
                      <div class="py-4">
                        <div class="mb-2 flex items-center justify-between text-[12px]">
                          <span class="text-v2-text-text-base [font-weight:560]">
                            {language.t(`openwork.usage.period.${period.id}`)}
                          </span>
                          <span class="text-v2-text-text-muted">
                            ${period.used.toFixed(2)} / ${period.limit.toFixed(2)}
                          </span>
                        </div>
                        <div class="h-1.5 overflow-hidden rounded-full bg-v2-background-bg-layer-02">
                          <div class="h-full rounded-full bg-v2-icon-icon-base" style={{ width: `${percent()}%` }} />
                        </div>
                      </div>
                    )
                  }}
                </For>
              </div>
              <div class="mt-4 flex items-center justify-between text-[11px] text-v2-text-text-muted">
                <span>
                  {usage().sessionCount} {language.t("openwork.usage.sessions")}
                </span>
                <ButtonV2 variant="outline" onClick={() => platform.openLink(usage().documentationUrl)}>
                  {language.t("openwork.usage.docs")}
                </ButtonV2>
              </div>
            </div>
          )}
        </Show>
      </div>
    </OpenWorkSettingsPage>
  )
}

function OpenWorkSettingsPage(props: {
  title: string
  description: string
  action?: JSX.Element
  status?: string
  error?: string
  children: JSX.Element
}) {
  return (
    <div class="flex h-full min-h-0 flex-col px-6 py-5">
      <div class="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="m-0 text-[18px] tracking-[-0.2px] text-v2-text-text-base [font-weight:620]">{props.title}</h2>
          <p class="m-0 mt-1 max-w-[640px] text-[12px] leading-5 text-v2-text-text-muted">{props.description}</p>
        </div>
        {props.action}
      </div>
      <Show when={props.error}>
        <div
          role="alert"
          class="mb-3 shrink-0 rounded-[6px] bg-v2-state-bg-danger px-3 py-2 text-[12px] text-v2-state-fg-danger"
        >
          {props.error}
        </div>
      </Show>
      <Show when={props.status}>
        <div
          role="status"
          class="mb-3 shrink-0 rounded-[6px] bg-v2-background-bg-layer-02 px-3 py-2 text-[12px] text-v2-text-text-base"
        >
          {props.status}
        </div>
      </Show>
      {props.children}
    </div>
  )
}

function OpenWorkUnavailable() {
  const language = useLanguage()
  return (
    <div class="p-6">
      <EmptyState text={language.t("openwork.settings.desktopOnly")} />
    </div>
  )
}

function EmptyState(props: { text: string }) {
  return <div class="px-4 py-8 text-center text-[12px] text-v2-text-text-muted">{props.text}</div>
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}
