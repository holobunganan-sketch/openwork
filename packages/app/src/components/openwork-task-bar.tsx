import { useOpenWorkTasks } from "@/context/openwork-tasks"
import { useLanguage } from "@/context/language"
import type { WorkActivityKind, WorkTaskStatus } from "@/openwork/task-runtime"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { createMemo, createSignal, For, Show } from "solid-js"

export function OpenWorkTaskBar(props: {
  scope: string
  sessionID: string
  working: boolean
  blocked: boolean
  checkpointMessageID?: string
  onPause: () => Promise<unknown> | void
  onContinue: () => void
  onRetry: () => void
  onRestore: (messageID: string) => Promise<unknown> | void
}) {
  const language = useLanguage()
  const tasks = useOpenWorkTasks()
  const [expanded, setExpanded] = createSignal(false)
  const task = createMemo(() => tasks.get(props.scope, props.sessionID))
  const status = createMemo(() => {
    const current = task()
    if (!current) return
    if (props.blocked) return "waiting" as const
    if (props.working) return "running" as const
    return current.status
  })
  const recent = createMemo(() => task()?.activities.slice(-6).reverse() ?? [])
  const checkpointLabel = createMemo(() =>
    language.t("openwork.task.checkpoint.number", { count: (task()?.checkpoints.length ?? 0) + 1 }),
  )

  function pause() {
    tasks.transition(props.scope, props.sessionID, "paused")
    void props.onPause()
  }

  function continueTask() {
    tasks.transition(props.scope, props.sessionID, "ready")
    props.onContinue()
  }

  function retryTask() {
    tasks.transition(props.scope, props.sessionID, "ready")
    props.onRetry()
  }

  function checkpoint() {
    tasks.checkpoint(props.scope, props.sessionID, {
      label: checkpointLabel(),
      messageID: props.checkpointMessageID,
    })
  }

  return (
    <Show when={task()} keyed>
      {(current) => (
        <div class="shrink-0 border-b border-v2-border-border-muted bg-v2-background-bg-layer-01">
          <div class="flex min-h-10 items-center gap-2 px-3 py-1.5">
            <span class={`size-2 shrink-0 rounded-full ${statusColor(status() ?? "draft")}`} aria-hidden="true" />
            <span class="shrink-0 text-[11px] text-v2-text-text-base [font-weight:600]">
              {statusLabel(status() ?? "draft", language.t)}
            </span>
            <span class="min-w-0 flex-1 truncate text-[12px] text-v2-text-text-muted" title={current.spec.goal}>
              {current.spec.goal}
            </span>
            <span class="hidden shrink-0 rounded-full bg-v2-background-bg-layer-03 px-2 py-0.5 text-[10px] text-v2-text-text-muted sm:inline">
              {language.t(`openwork.autonomy.${current.spec.autonomy}`)}
            </span>
            <Show
              when={props.working}
              fallback={
                <ButtonV2
                  size="small"
                  variant="ghost-muted"
                  onClick={current.status === "failed" ? retryTask : continueTask}
                >
                  {language.t(current.status === "failed" ? "openwork.task.retry" : "openwork.task.continue")}
                </ButtonV2>
              }
            >
              <ButtonV2 size="small" variant="ghost-muted" onClick={pause}>
                {language.t("openwork.task.pause")}
              </ButtonV2>
            </Show>
            <ButtonV2 size="small" variant="ghost-muted" onClick={() => setExpanded((value) => !value)}>
              {language.t("openwork.task.activity")}
              <Icon name="chevron-down" size="small" class={expanded() ? "rotate-180" : ""} />
            </ButtonV2>
          </div>

          <Show when={expanded()}>
            <div class="grid max-h-[280px] grid-cols-1 gap-4 overflow-y-auto border-t border-v2-border-border-muted px-4 py-3 md:grid-cols-2">
              <section aria-label={language.t("openwork.task.contract")}>
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h3 class="m-0 text-[11px] uppercase tracking-[0.08em] text-v2-text-text-muted [font-weight:600]">
                    {language.t("openwork.task.acceptance")}
                  </h3>
                  <ButtonV2 size="small" variant="outline" disabled={!props.checkpointMessageID} onClick={checkpoint}>
                    {language.t("openwork.task.checkpoint")}
                  </ButtonV2>
                </div>
                <ul class="m-0 space-y-1.5 p-0">
                  <For each={current.spec.acceptanceCriteria}>
                    {(criterion) => (
                      <li class="flex items-start gap-2 text-[11px] leading-4 text-v2-text-text-base">
                        <span class="mt-1 size-1.5 shrink-0 rounded-full border border-v2-border-border-strong" />
                        <span>{criterion}</span>
                      </li>
                    )}
                  </For>
                </ul>
                <Show when={current.checkpoints.length}>
                  <div class="mt-3 space-y-1">
                    <For each={current.checkpoints.slice().reverse()}>
                      {(item) => (
                        <div class="flex items-center justify-between gap-2 rounded-[6px] bg-v2-background-bg-layer-02 px-2 py-1.5">
                          <span class="min-w-0 truncate text-[11px] text-v2-text-text-muted">{item.label}</span>
                          <Show when={item.messageID}>
                            {(messageID) => (
                              <ButtonV2
                                size="small"
                                variant="ghost-muted"
                                onClick={() => void props.onRestore(messageID())}
                              >
                                {language.t("openwork.task.restore")}
                              </ButtonV2>
                            )}
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </section>

              <section aria-label={language.t("openwork.task.activity")}>
                <h3 class="m-0 mb-2 text-[11px] uppercase tracking-[0.08em] text-v2-text-text-muted [font-weight:600]">
                  {language.t("openwork.task.activity")}
                </h3>
                <div class="space-y-1.5">
                  <For each={recent()}>
                    {(item) => (
                      <div class="flex items-start gap-2 text-[11px] leading-4">
                        <span class="w-12 shrink-0 tabular-nums text-v2-text-text-muted">
                          {new Intl.DateTimeFormat(language.intl(), {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(item.at)}
                        </span>
                        <span class="text-v2-text-text-base">{activityLabel(item.kind, language.t)}</span>
                        <Show when={item.detail}>
                          <span class="min-w-0 truncate text-v2-text-text-muted">{item.detail}</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </div>
          </Show>
        </div>
      )}
    </Show>
  )
}

type Translate = ReturnType<typeof useLanguage>["t"]

function statusLabel(status: WorkTaskStatus, t: Translate) {
  const keys = {
    draft: "openwork.task.status.draft",
    running: "openwork.task.status.running",
    waiting: "openwork.task.status.waiting",
    paused: "openwork.task.status.paused",
    ready: "openwork.task.status.ready",
    failed: "openwork.task.status.failed",
    completed: "openwork.task.status.completed",
  } as const
  return t(keys[status])
}

function activityLabel(kind: WorkActivityKind, t: Translate) {
  const keys = {
    created: "openwork.task.activity.created",
    started: "openwork.task.activity.started",
    resumed: "openwork.task.activity.resumed",
    waiting: "openwork.task.activity.waiting",
    paused: "openwork.task.activity.paused",
    ready: "openwork.task.activity.ready",
    failed: "openwork.task.activity.failed",
    checkpoint: "openwork.task.activity.checkpoint",
    verified: "openwork.task.activity.verified",
  } as const
  return t(keys[kind])
}

function statusColor(status: WorkTaskStatus) {
  if (status === "running") return "bg-v2-state-fg-info"
  if (status === "waiting") return "bg-v2-state-fg-warning"
  if (status === "failed") return "bg-v2-state-fg-danger"
  if (status === "completed") return "bg-v2-state-fg-success"
  if (status === "paused") return "bg-v2-icon-icon-muted"
  return "bg-v2-icon-icon-base"
}
