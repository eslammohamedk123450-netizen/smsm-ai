import { streamChatPlatform } from "../../lib/network/sse-client";
import type { ChatRequestBody, StreamCallbacks } from "../../lib/network/sse-transport";

type StreamSnapshot = {
  conversationId: string;
  active: boolean;
  text: string;
  taskLabel: string | null;
  error: string | null;
};

type Listener = (snapshot: StreamSnapshot) => void;

type StreamJob = {
  snapshot: StreamSnapshot;
  controller: AbortController;
  listeners: Set<Listener>;
  promise: Promise<void>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const jobs = new Map<string, StreamJob>();

function notify(job: StreamJob): void {
  for (const listener of job.listeners) listener({ ...job.snapshot });
}

function finish(job: StreamJob, error: string | null): void {
  job.snapshot.active = false;
  job.snapshot.error = error;
  notify(job);
  job.cleanupTimer = setTimeout(() => {
    if (jobs.get(job.snapshot.conversationId) === job) jobs.delete(job.snapshot.conversationId);
  }, 60_000);
}

export const chatStreamManager = {
  subscribe(conversationId: string, listener: Listener): () => void {
    const job = jobs.get(conversationId);
    if (!job) return () => undefined;
    job.listeners.add(listener);
    listener({ ...job.snapshot });
    return () => job.listeners.delete(listener);
  },

  start(
    body: ChatRequestBody,
    callbacks: StreamCallbacks,
    externalSignal?: AbortSignal,
  ): Promise<void> {
    const existing = jobs.get(body.conversation_id);
    if (existing?.snapshot.active) return existing.promise;
    if (existing?.cleanupTimer) clearTimeout(existing.cleanupTimer);

    const controller = new AbortController();
    const job: StreamJob = {
      snapshot: { conversationId: body.conversation_id, active: true, text: "", taskLabel: null, error: null },
      controller,
      listeners: new Set(),
      promise: Promise.resolve(),
    };
    jobs.set(body.conversation_id, job);

    const abortFromCaller = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });

    job.promise = streamChatPlatform(body, controller.signal, {
      onChunk(text) {
        job.snapshot.text += text;
        callbacks.onChunk(text);
        notify(job);
      },
      onTaskUpdate(task) {
        job.snapshot.taskLabel = task.status === "running"
          ? `جاري ${task.task}…`
          : task.status === "completed"
            ? `تم ${task.task}`
            : task.status === "failed"
              ? `تعذر ${task.task}`
              : job.snapshot.taskLabel;
        callbacks.onTaskUpdate?.(task);
        notify(job);
      },
      onDone() {
        callbacks.onDone();
      },
    }).then(
      () => {
        finish(job, null);
      },
      (cause) => {
        const message = cause instanceof Error ? cause.message : "تعذر إكمال تدفق الرد.";
        finish(job, message);
        throw cause;
      },
    ).finally(() => {
      externalSignal?.removeEventListener("abort", abortFromCaller);
    });

    return job.promise;
  },

  cancel(conversationId: string): void {
    jobs.get(conversationId)?.controller.abort();
  },

  getSnapshot(conversationId: string): StreamSnapshot | null {
    const job = jobs.get(conversationId);
    return job ? { ...job.snapshot } : null;
  },
};
