import type { OpenWorkMcpServer, OpenWorkSkill, OpenWorkSkillZipPreview, OpenWorkUsage } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useOpenWorkMemory } from "@/context/openwork-memory"
import { useModels } from "@/context/models"
import { useProviders } from "@/hooks/use-providers"
import type { ModelKey, ModelSelection } from "@/context/local"
import {
  createWorkSpec,
  type WorkAutonomy,
  type WorkKind,
  type WorkModel,
  type WorkSpec,
} from "@/openwork/work-spec"
import { defaultWorkPermissions, type WorkPermissions } from "@/openwork/work-permissions"
import { MEMORY_CONTENT_LIMIT, type OpenWorkMemoryEntry, type OpenWorkMemoryScope } from "@/openwork/memory"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { ModelSelectorPopoverV2 } from "@/components/dialog-select-model"
import { useSettingsDialog } from "@/components/settings-dialog"
import { createEffect, createMemo, For, onMount, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"

export type OpenWorkWorkspaceOption = { directory: string; label: string }

export function OpenWorkLaunchpad(props: {
  disabled: boolean
  workspace?: OpenWorkWorkspaceOption
  workspaces: OpenWorkWorkspaceOption[]
  onWorkspaceSelect: (directory: string) => void
  onWorkspaceBrowse: () => void
  onTask: (workSpec: WorkSpec) => void
}) {
  const language = useLanguage()
  const models = useModels()
  const providers = useProviders()
  const openModels = useSettingsDialog("models")
  const [state, setState] = createStore<{
    prompt: string
    kind?: WorkKind
    autonomy: WorkAutonomy
    permissions: WorkPermissions
    controls: boolean
    model?: ModelKey
    variant?: string
  }>({
    prompt: "",
    autonomy: "collaborate",
    permissions: defaultWorkPermissions("collaborate"),
    controls: false,
  })
  const availableModels = createMemo(() =>
    models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })),
  )
  const currentModel = () => {
    const selected = state.model
    if (!selected) return undefined
    return models.find(selected)
  }
  const recentModels = createMemo(() =>
    models
      .recent.list()
      .map(models.find)
      .filter((model): model is NonNullable<ReturnType<typeof models.find>> => !!model),
  )
  const defaultModel = createMemo(() => {
    const defaults = providers.default()
    for (const provider of providers.connected()) {
      const modelID = defaults[provider.id] ?? Object.values(provider.models)[0]?.id
      if (!modelID) continue
      const model = models.find({ providerID: provider.id, modelID })
      if (model) return model
    }
  })
  const modelSelection = {
    ready: models.ready,
    current: currentModel,
    recent: recentModels,
    list: models.list,
    cycle(direction: 1 | -1) {
      const items = recentModels()
      const current = currentModel()
      if (!current || items.length === 0) return
      const index = items.findIndex((item) => item.provider.id === current.provider.id && item.id === current.id)
      const next = items[(Math.max(index, 0) + direction + items.length) % items.length]
      if (next) this.set({ providerID: next.provider.id, modelID: next.id })
    },
    set(item: ModelKey | undefined, options?: { recent?: boolean }) {
      setState({ model: item ? { providerID: item.providerID, modelID: item.modelID } : undefined, variant: undefined })
      if (!item) return
      models.setVisibility(item, true)
      if (options?.recent) models.recent.push(item)
    },
    visible: models.visible,
    setVisibility: models.setVisibility,
    variant: {
      configured: () => undefined,
      selected: () => state.variant,
      current() {
        const selected = state.variant
        if (selected && this.list().includes(selected)) return selected
        const model = currentModel()
        if (!model) return undefined
        const saved = models.variant.get({ providerID: model.provider.id, modelID: model.id })
        if (saved && this.list().includes(saved)) return saved
      },
      list() {
        return Object.keys(currentModel()?.variants ?? {})
      },
      set(value: string | undefined) {
        setState("variant", value)
        const model = currentModel()
        if (model) models.variant.set({ providerID: model.provider.id, modelID: model.id }, value)
      },
      cycle() {
        const items = this.list()
        if (items.length === 0) return
        const current = this.current()
        const index = current ? items.indexOf(current) : -1
        this.set(items[(index + 1) % items.length])
      },
    },
  } satisfies ModelSelection

  createEffect(() => {
    const current = currentModel()
    if (current) return
    const next = recentModels()[0] ?? defaultModel() ?? availableModels()[0] ?? models.list()[0]
    modelSelection.set(next ? { providerID: next.provider.id, modelID: next.id } : undefined)
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
  const permissionControls = createMemo(() => [
    {
      id: "workspace" as const,
      label: language.t("openwork.permission.workspace"),
      description: language.t("openwork.permission.workspace.description"),
    },
    {
      id: "commands" as const,
      label: language.t("openwork.permission.commands"),
      description: language.t("openwork.permission.commands.description"),
    },
    {
      id: "network" as const,
      label: language.t("openwork.permission.network"),
      description: language.t("openwork.permission.network.description"),
    },
    {
      id: "external" as const,
      label: language.t("openwork.permission.external"),
      description: language.t("openwork.permission.external.description"),
    },
  ])
  const workSpec = createMemo(() =>
    createWorkSpec({
      prompt: state.prompt,
      kind: state.kind,
      autonomy: state.autonomy,
      permissions: state.permissions,
      workspace: props.workspace?.directory,
      model: selectedWorkModel(),
    }),
  )

  function selectedWorkModel(): WorkModel | undefined {
    const model = currentModel()
    if (!model) return undefined
    const variant = modelSelection.variant.current()
    return {
      providerID: model.provider.id,
      modelID: model.id,
      name: model.name,
      ...(variant ? { variant } : {}),
    }
  }

  function start() {
    if (props.disabled || !state.prompt.trim() || !props.workspace || !currentModel()) return
    props.onTask(workSpec())
  }

  return (
    <section
      data-component="openwork-launchpad"
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
            aria-label={language.t("openwork.composer.placeholder")}
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
          <div
            class="flex min-w-0 flex-wrap items-center gap-1 border-t border-v2-border-border-muted px-1 py-1.5"
            role="group"
            aria-label={language.t("openwork.target.label")}
          >
            <MenuV2 placement="bottom-start" gutter={4}>
              <MenuV2.Trigger
                as={ButtonV2}
                variant="ghost-muted"
                size="normal"
                class="min-w-0 max-w-[260px] justify-start ![font-weight:440]"
                data-action="openwork-workspace"
                aria-label={language.t("openwork.workspace.choose")}
              >
                <Icon name="folder" size="small" class="shrink-0" />
                <span class="min-w-0 truncate">
                  {props.workspace?.label ?? language.t("openwork.workspace.choose")}
                </span>
                <Icon name="chevron-down" size="small" class="-ml-0.5 -mr-1 shrink-0" />
              </MenuV2.Trigger>
              <MenuV2.Portal>
                <MenuV2.Content class="min-w-[240px]">
                  <MenuV2.Group>
                    <MenuV2.GroupLabel>{language.t("openwork.workspace.label")}</MenuV2.GroupLabel>
                    <For each={props.workspaces}>
                      {(workspace) => (
                        <MenuV2.Item
                          data-selected-workspace={props.workspace?.directory === workspace.directory ? "" : undefined}
                          onSelect={() => props.onWorkspaceSelect(workspace.directory)}
                        >
                          <Icon name="folder" size="small" />
                          <span class="min-w-0 flex-1 truncate" title={workspace.directory}>
                            {workspace.label}
                          </span>
                          <Show when={props.workspace?.directory === workspace.directory}>
                            <Icon name="check" size="small" />
                          </Show>
                        </MenuV2.Item>
                      )}
                    </For>
                  </MenuV2.Group>
                  <MenuV2.Separator />
                  <MenuV2.Item onSelect={props.onWorkspaceBrowse}>
                    <Icon name="folder-add-left" size="small" />
                    {language.t("openwork.workspace.browse")}
                  </MenuV2.Item>
                </MenuV2.Content>
              </MenuV2.Portal>
            </MenuV2>

            <ModelSelectorPopoverV2
              model={modelSelection}
              onManage={openModels}
              triggerAs={ButtonV2}
              triggerProps={{
                variant: "ghost-muted",
                size: "normal",
                class: "min-w-0 max-w-[260px] justify-start ![font-weight:440]",
                "data-action": "openwork-model",
                "aria-label": language.t("openwork.model.choose"),
              }}
            >
              <Show
                when={currentModel()}
                fallback={<span class="truncate">{language.t("openwork.model.choose")}</span>}
              >
                {(model) => (
                  <>
                    <ProviderIcon id={model().provider.id} class="size-4 shrink-0 opacity-60" />
                    <span class="min-w-0 truncate">{model().name}</span>
                  </>
                )}
              </Show>
              <Icon name="chevron-down" size="small" class="-ml-0.5 -mr-1 shrink-0" />
            </ModelSelectorPopoverV2>

            <Show when={modelSelection.variant.list().length > 0}>
              <MenuV2 placement="bottom-start" gutter={4}>
                <MenuV2.Trigger
                  as={ButtonV2}
                  variant="ghost-muted"
                  size="normal"
                  class="max-w-[150px] justify-start ![font-weight:440]"
                  data-action="openwork-model-variant"
                >
                  <span class="truncate">{modelSelection.variant.current() ?? language.t("common.default")}</span>
                  <Icon name="chevron-down" size="small" class="-ml-0.5 -mr-1 shrink-0" />
                </MenuV2.Trigger>
                <MenuV2.Portal>
                  <MenuV2.Content>
                    <MenuV2.RadioGroup
                      value={modelSelection.variant.current() ?? "default"}
                      onChange={(value) => modelSelection.variant.set(value === "default" ? undefined : value)}
                    >
                      <MenuV2.RadioItem value="default">{language.t("common.default")}</MenuV2.RadioItem>
                      <For each={modelSelection.variant.list()}>
                        {(variant) => <MenuV2.RadioItem value={variant}>{variant}</MenuV2.RadioItem>}
                      </For>
                    </MenuV2.RadioGroup>
                  </MenuV2.Content>
                </MenuV2.Portal>
              </MenuV2>
            </Show>
          </div>
          <div class="flex flex-wrap items-center gap-2 border-t border-v2-border-border-muted px-1 pt-2">
            <div
              class="flex min-w-0 flex-1 items-center gap-1"
              role="group"
              aria-label={language.t("openwork.autonomy.label")}
            >
              <For each={modes()}>
                {(mode) => (
                  <button
                    type="button"
                    title={mode.description}
                    aria-pressed={state.autonomy === mode.id}
                    data-selected={state.autonomy === mode.id ? "" : undefined}
                    class="h-7 rounded-[6px] border-0 bg-transparent px-2 text-[11px] text-v2-text-text-muted transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-text-text-base data-[selected]:bg-v2-background-bg-layer-03 data-[selected]:text-v2-text-text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus"
                    onClick={() =>
                      setState({
                        autonomy: mode.id,
                        permissions: defaultWorkPermissions(mode.id),
                      })
                    }
                  >
                    {mode.label}
                  </button>
                )}
              </For>
            </div>
            <ButtonV2
              size="small"
              variant="ghost-muted"
              icon="sliders"
              aria-expanded={state.controls}
              aria-controls="openwork-permission-controls"
              onClick={() => setState("controls", (value) => !value)}
            >
              {language.t("openwork.permission.controls")}
            </ButtonV2>
            <ButtonV2
              variant="contrast"
              icon="arrow-up"
              disabled={props.disabled || !state.prompt.trim() || !props.workspace || !currentModel()}
              onClick={start}
            >
              {language.t("openwork.composer.start")}
            </ButtonV2>
          </div>
          <Show when={state.controls}>
            <div id="openwork-permission-controls" class="mt-2 border-t border-v2-border-border-muted px-2 pb-1 pt-3">
              <div class="mb-2 flex items-start justify-between gap-4">
                <div>
                  <div class="text-[11px] text-v2-text-text-base [font-weight:600]">
                    {language.t("openwork.permission.title")}
                  </div>
                  <p class="m-0 mt-0.5 text-[10px] leading-4 text-v2-text-text-muted">
                    {language.t("openwork.permission.description")}
                  </p>
                </div>
                <span class="shrink-0 rounded-full bg-v2-background-bg-layer-03 px-2 py-1 text-[10px] text-v2-text-text-muted">
                  {language.t("openwork.permission.destructive")}: {language.t("openwork.permission.alwaysAsk")}
                </span>
              </div>
              <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <For each={permissionControls()}>
                  {(control) => (
                    <div class="flex min-w-0 items-center gap-2 rounded-[7px] bg-v2-background-bg-base px-2.5 py-2">
                      <div class="min-w-0 flex-1">
                        <div class="text-[11px] text-v2-text-text-base [font-weight:560]">{control.label}</div>
                        <div class="truncate text-[10px] text-v2-text-text-muted" title={control.description}>
                          {control.description}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-allowed={state.permissions[control.id] === "allow" ? "" : undefined}
                        aria-pressed={state.permissions[control.id] === "allow"}
                        aria-label={`${control.label}: ${language.t(
                          state.permissions[control.id] === "allow"
                            ? "openwork.permission.allow"
                            : "openwork.permission.ask",
                        )}`}
                        class="h-6 shrink-0 rounded-full border border-v2-border-border-muted bg-transparent px-2 text-[10px] text-v2-text-text-muted data-[allowed]:border-v2-border-border-strong data-[allowed]:bg-v2-background-bg-layer-03 data-[allowed]:text-v2-text-text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus"
                        onClick={() =>
                          setState(
                            "permissions",
                            control.id,
                            state.permissions[control.id] === "allow" ? "ask" : "allow",
                          )
                        }
                      >
                        {language.t(
                          state.permissions[control.id] === "allow"
                            ? "openwork.permission.allow"
                            : "openwork.permission.ask",
                        )}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>

        <div
          class="mt-3 flex flex-wrap justify-center gap-1.5"
          role="group"
          aria-label={language.t("openwork.presets.label")}
        >
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
        <Show when={props.disabled || !props.workspace || !currentModel()}>
          <p class="m-0 mt-3 text-center text-[12px] text-v2-text-text-muted">
            {language.t(
              props.disabled
                ? "openwork.home.projectRequired"
                : !props.workspace
                  ? "openwork.workspace.required"
                  : "openwork.model.required",
            )}
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
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[9px] border border-v2-border-border-muted bg-v2-background-bg-base sm:flex-row">
        <nav
          class="max-h-40 w-full shrink-0 overflow-y-auto border-b border-v2-border-border-muted py-1.5 sm:max-h-none sm:w-[230px] sm:border-b-0 sm:border-r"
          aria-label={language.t("openwork.skills.listLabel")}
        >
          <Show when={state.items.length} fallback={<EmptyState text={language.t("openwork.skills.empty")} />}>
            <For each={state.items}>
              {(skill) => (
                <button
                  type="button"
                  data-selected={selected()?.id === skill.id ? "" : undefined}
                  aria-current={selected()?.id === skill.id ? "true" : undefined}
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
        </nav>
        <div class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
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

export function SettingsOpenWorkMemory() {
  const language = useLanguage()
  const memory = useOpenWorkMemory()
  const [state, setState] = createStore<{
    mode: "edit" | "create"
    selectedID: string
    scope: OpenWorkMemoryScope
    project: string
    content: string
    status: string
    error: string
    confirmDelete: boolean
  }>({
    mode: "edit",
    selectedID: "",
    scope: "user",
    project: "",
    content: "",
    status: "",
    error: "",
    confirmDelete: false,
  })
  const entries = createMemo(() => memory.entries.slice().sort((a, b) => b.updatedAt - a.updatedAt))
  const selected = createMemo(() => memory.get(state.selectedID))

  function select(entry: OpenWorkMemoryEntry) {
    setState({
      mode: "edit",
      selectedID: entry.id,
      scope: entry.scope,
      project: entry.project ?? "",
      content: entry.content,
      status: "",
      error: "",
      confirmDelete: false,
    })
  }

  createEffect(() => {
    if (state.mode === "create" || selected()) return
    const first = entries()[0]
    if (first) select(first)
  })

  function createNew() {
    setState({
      mode: "create",
      selectedID: "",
      scope: "user",
      project: "",
      content: "",
      status: "",
      error: "",
      confirmDelete: false,
    })
  }

  function save() {
    setState({ status: "", error: "", confirmDelete: false })
    if (!state.content.trim()) {
      setState("error", language.t("openwork.memory.contentRequired"))
      return
    }
    if (state.scope === "project" && !state.project.trim()) {
      setState("error", language.t("openwork.memory.projectRequired"))
      return
    }

    try {
      if (state.mode === "create") {
        select(
          memory.create({
            scope: state.scope,
            project: state.scope === "project" ? state.project : undefined,
            content: state.content,
          }),
        )
      } else {
        memory.update(state.selectedID, {
          scope: state.scope,
          project: state.scope === "project" ? state.project : undefined,
          content: state.content,
        })
      }
      setState("status", language.t("openwork.memory.saved"))
    } catch (cause) {
      setState("error", errorMessage(cause))
    }
  }

  function toggle() {
    const entry = selected()
    if (!entry) return
    memory.update(entry.id, { enabled: !entry.enabled })
    setState({ status: language.t("openwork.memory.saved"), error: "", confirmDelete: false })
  }

  function remove() {
    if (!state.confirmDelete) {
      setState("confirmDelete", true)
      return
    }
    if (!memory.remove(state.selectedID)) return
    setState({
      mode: "edit",
      selectedID: "",
      status: language.t("openwork.memory.deleted"),
      error: "",
      confirmDelete: false,
    })
  }

  function exportMemory() {
    const url = URL.createObjectURL(new Blob([memory.exportJSON()], { type: "application/json" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `openwork-memory-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    queueMicrotask(() => URL.revokeObjectURL(url))
    setState({ status: language.t("openwork.memory.exported"), error: "" })
  }

  return (
    <OpenWorkSettingsPage
      title={language.t("openwork.settings.memory.title")}
      description={language.t("openwork.settings.memory.description")}
      action={
        <div class="flex gap-2">
          <ButtonV2 disabled={!entries().length} onClick={exportMemory}>
            {language.t("openwork.memory.export")}
          </ButtonV2>
          <ButtonV2 icon="plus" variant="contrast" onClick={createNew}>
            {language.t("openwork.memory.new")}
          </ButtonV2>
        </div>
      }
      status={state.status}
      error={state.error}
    >
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[9px] border border-v2-border-border-muted bg-v2-background-bg-base sm:flex-row">
        <nav
          class="max-h-40 w-full shrink-0 overflow-y-auto border-b border-v2-border-border-muted py-1.5 sm:max-h-none sm:w-[230px] sm:border-b-0 sm:border-r"
          aria-label={language.t("openwork.memory.listLabel")}
        >
          <Show when={entries().length} fallback={<EmptyState text={language.t("openwork.memory.empty")} />}>
            <For each={entries()}>
              {(entry) => (
                <button
                  type="button"
                  data-selected={state.mode === "edit" && selected()?.id === entry.id ? "" : undefined}
                  aria-current={state.mode === "edit" && selected()?.id === entry.id ? "true" : undefined}
                  class="flex w-full items-start gap-2 border-0 bg-transparent px-3 py-2 text-left hover:bg-v2-overlay-simple-overlay-hover data-[selected]:bg-v2-background-bg-layer-02 focus-visible:outline-none"
                  onClick={() => select(entry)}
                >
                  <span
                    class={`mt-1 size-2 shrink-0 rounded-full ${entry.enabled ? "bg-v2-state-fg-success" : "bg-v2-icon-icon-disabled"}`}
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[12px] text-v2-text-text-base">{entry.content}</span>
                    <span class="mt-0.5 block truncate text-[10px] text-v2-text-text-muted">
                      {language.t(`openwork.memory.scope.${entry.scope}`)}
                      {entry.project ? ` · ${entry.project}` : ""}
                    </span>
                  </span>
                </button>
              )}
            </For>
          </Show>
        </nav>
        <div class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <Show
            when={state.mode === "create" || selected()}
            fallback={<EmptyState text={language.t("openwork.memory.empty")} />}
          >
            <div class="flex min-h-full flex-col">
              <div class="flex items-start gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-v2-background-bg-layer-02">
                  <Icon name="edit" />
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="m-0 text-[15px] text-v2-text-text-base [font-weight:600]">
                    {language.t(state.mode === "create" ? "openwork.memory.new" : "openwork.memory.edit")}
                  </h3>
                  <p
                    id="openwork-memory-editor-description"
                    class="m-0 mt-1 text-[12px] leading-5 text-v2-text-text-muted"
                  >
                    {language.t("openwork.memory.editorDescription")}
                  </p>
                </div>
              </div>

              <div class="mt-6 space-y-5">
                <div>
                  <div class="mb-2 text-[11px] text-v2-text-text-muted [font-weight:600]">
                    {language.t("openwork.memory.scope")}
                  </div>
                  <div class="flex gap-2" role="group" aria-label={language.t("openwork.memory.scope")}>
                    <For each={["user", "project"] as const}>
                      {(scope) => (
                        <button
                          type="button"
                          aria-pressed={state.scope === scope}
                          data-selected={state.scope === scope ? "" : undefined}
                          class="h-8 rounded-[6px] border border-v2-border-border-muted bg-transparent px-3 text-[11px] text-v2-text-text-muted data-[selected]:border-v2-border-border-strong data-[selected]:bg-v2-background-bg-layer-02 data-[selected]:text-v2-text-text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus"
                          onClick={() => setState({ scope, confirmDelete: false })}
                        >
                          {language.t(`openwork.memory.scope.${scope}`)}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <Show when={state.scope === "project"}>
                  <label class="block">
                    <span class="mb-2 block text-[11px] text-v2-text-text-muted [font-weight:600]">
                      {language.t("openwork.memory.project")}
                    </span>
                    <TextInputV2
                      type="text"
                      appearance="base"
                      value={state.project}
                      placeholder={language.t("openwork.memory.projectPlaceholder")}
                      spellcheck={false}
                      autocorrect="off"
                      autocomplete="off"
                      autocapitalize="off"
                      aria-label={language.t("openwork.memory.project")}
                      onInput={(event) => setState({ project: event.currentTarget.value, confirmDelete: false })}
                    />
                  </label>
                </Show>

                <label class="block">
                  <span class="mb-2 flex items-center justify-between text-[11px] text-v2-text-text-muted [font-weight:600]">
                    <span>{language.t("openwork.memory.content")}</span>
                    <span class="font-normal">
                      {state.content.length} / {MEMORY_CONTENT_LIMIT}
                    </span>
                  </span>
                  <TextareaV2
                    class="!w-full [&_[data-slot=textarea-v2-textarea]]:min-h-40"
                    rows={7}
                    maxLength={MEMORY_CONTENT_LIMIT}
                    value={state.content}
                    placeholder={language.t("openwork.memory.contentPlaceholder")}
                    aria-label={language.t("openwork.memory.content")}
                    aria-describedby="openwork-memory-editor-description"
                    onInput={(event) => setState({ content: event.currentTarget.value, confirmDelete: false })}
                  />
                </label>
              </div>

              <div class="mt-auto flex flex-wrap gap-2 border-t border-v2-border-border-muted pt-4">
                <ButtonV2 variant="contrast" disabled={!state.content.trim()} onClick={save}>
                  {language.t("openwork.memory.save")}
                </ButtonV2>
                <Show when={state.mode === "edit" && selected()}>
                  <ButtonV2 onClick={toggle}>
                    {language.t(selected()?.enabled ? "openwork.memory.disable" : "openwork.memory.enable")}
                  </ButtonV2>
                  <ButtonV2 class="ml-auto" variant="danger" onClick={remove}>
                    {language.t(state.confirmDelete ? "openwork.memory.deleteConfirm" : "openwork.memory.delete")}
                  </ButtonV2>
                </Show>
              </div>
            </div>
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
