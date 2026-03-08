export type QueuedStatusUpdate = {
  type: "status_update";
  bookingId: string;
  toStatus: string;
  idempotencyKey: string;
  queuedAt: string;
};

const QUEUE_KEY = "driver_offline_queue_v1";

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readOfflineQueue(): QueuedStatusUpdate[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QueuedStatusUpdate => {
      if (!item || typeof item !== "object") return false;
      const v = item as Record<string, unknown>;
      return (
        v.type === "status_update" &&
        typeof v.bookingId === "string" &&
        typeof v.toStatus === "string" &&
        typeof v.idempotencyKey === "string" &&
        typeof v.queuedAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue: QueuedStatusUpdate[]) {
  if (!hasStorage()) return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueStatusUpdate(item: Omit<QueuedStatusUpdate, "type" | "queuedAt">) {
  const queue = readOfflineQueue();
  queue.push({ ...item, type: "status_update", queuedAt: new Date().toISOString() });
  writeOfflineQueue(queue);
}

export function queueLength() {
  return readOfflineQueue().length;
}

export async function flushStatusQueue(
  send: (item: QueuedStatusUpdate) => Promise<{ ok: boolean; retryable: boolean; error?: string }>
) {
  const queue = readOfflineQueue();
  if (queue.length === 0) return { sent: 0, failed: 0, lastError: "" };

  const remaining: QueuedStatusUpdate[] = [];
  let sent = 0;
  let failed = 0;
  let lastError = "";

  for (const item of queue) {
    const result = await send(item);
    if (result.ok) {
      sent += 1;
      continue;
    }
    failed += 1;
    lastError = result.error || lastError;
    if (result.retryable) {
      remaining.push(item);
    }
  }

  writeOfflineQueue(remaining);
  return { sent, failed, lastError };
}

