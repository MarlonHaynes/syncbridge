import { Queue } from "bullmq";
import { connection } from "./connection";
import { env } from "../config/env";

export const SYNC_QUEUE_NAME = "sync-events";

export interface SyncJobData {
  syncEventId: string;
}

/**
 * Retries with exponential backoff, capped at QUEUE_MAX_ATTEMPTS. When a
 * job exhausts its attempts, BullMQ marks it failed permanently and the
 * worker's 'failed' handler dead-letters the corresponding sync_event.
 */
export const syncQueue = new Queue<SyncJobData>(SYNC_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: env.queue.maxAttempts,
    backoff: {
      type: "exponential",
      delay: env.queue.backoffDelayMs,
    },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 5000 },
  },
});

export async function enqueueSyncEvent(syncEventId: string): Promise<void> {
  await syncQueue.add("process-sync-event", { syncEventId });
}
