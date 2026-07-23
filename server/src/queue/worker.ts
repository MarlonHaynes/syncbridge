import { Job, Worker } from "bullmq";
import type { NexCoreCustomerPayload, NexCoreSalesOrderPayload, NexCoreWebhookPayload } from "@syncbridge/shared";
import { connection } from "./connection";
import { SYNC_QUEUE_NAME, SyncJobData } from "./syncQueue";
import { getSyncEventById, markFailed, markProcessing, markSuccess } from "../services/syncEventService";
import { applyMapping, loadActiveMapping } from "../services/mapping";
import { getErpClient } from "../clients/erp";
import { getCrmClient } from "../clients/crm";
import { logger } from "../utils/logger";
import { env } from "../config/env";

interface ProcessResult {
  targetExternalId: string;
  transformedPayload: Record<string, unknown>;
}

async function processSyncEvent(job: Job<SyncJobData>): Promise<ProcessResult> {
  const { syncEventId } = job.data;

  const event = await getSyncEventById(syncEventId);
  if (!event) {
    // Not retryable - the row is gone, retrying will never succeed.
    throw new Error(`sync_event ${syncEventId} not found (attempt ${job.attemptsMade + 1})`);
  }

  const mapping = await loadActiveMapping(event.source_system, event.target_system, event.entity_type);
  if (!mapping) {
    throw new Error(
      `No active mapping for ${event.source_system} -> ${event.target_system} (${event.entity_type}). Seed one in the mappings table.`
    );
  }

  const transformed = applyMapping(mapping.field_map, event.payload);

  if (event.direction === "salesforce_to_nexcore") {
    const erp = getErpClient();

    const customerInput = (transformed.customer ?? {}) as NexCoreCustomerPayload;
    const customer = await erp.createCustomer(customerInput);

    const salesOrderBase = (transformed.sales_order ?? {}) as Partial<NexCoreSalesOrderPayload>;
    const salesOrderInput: NexCoreSalesOrderPayload = {
      order_total: salesOrderBase.order_total as number,
      currency: "USD",
      status: "New",
      external_ref: event.source_external_id,
      customer_external_id: customer.externalId,
    };
    const salesOrder = await erp.createSalesOrder(salesOrderInput);

    return {
      targetExternalId: salesOrder.externalId,
      transformedPayload: {
        customer: { ...customerInput, externalId: customer.externalId },
        sales_order: { ...salesOrderInput, externalId: salesOrder.externalId },
      },
    };
  }

  // nexcore_to_salesforce
  const crm = getCrmClient();
  const webhookPayload = event.payload as unknown as NexCoreWebhookPayload;
  const opportunityId = webhookPayload.opportunity_id;
  if (!opportunityId) {
    throw new Error("NexCore webhook payload is missing opportunity_id - cannot route the update back to Salesforce");
  }

  const result = await crm.updateRecord(opportunityId, transformed);
  return { targetExternalId: result.externalId, transformedPayload: transformed };
}

export const syncWorker = new Worker<SyncJobData, ProcessResult>(SYNC_QUEUE_NAME, processSyncEvent, {
  connection,
  concurrency: 5,
});

syncWorker.on("active", (job) => {
  markProcessing(job.data.syncEventId, job.attemptsMade + 1).catch((err) =>
    logger.error("Failed to mark sync_event processing", { error: (err as Error).message })
  );
});

syncWorker.on("completed", (job, result: ProcessResult) => {
  markSuccess(job.data.syncEventId, result.targetExternalId, result.transformedPayload)
    .then(() => logger.info("sync_event succeeded", { syncEventId: job.data.syncEventId, targetExternalId: result.targetExternalId }))
    .catch((err) => logger.error("Failed to mark sync_event success", { error: (err as Error).message }));
});

syncWorker.on("failed", (job, err) => {
  if (!job) return;
  const maxAttempts = (job.opts.attempts as number | undefined) ?? env.queue.maxAttempts;
  const isFinal = job.attemptsMade >= maxAttempts;

  markFailed(job.data.syncEventId, err.message, isFinal)
    .then(() =>
      logger.warn(`sync_event attempt failed${isFinal ? " (DEAD-LETTERED)" : " - will retry"}`, {
        syncEventId: job.data.syncEventId,
        attempt: job.attemptsMade,
        maxAttempts,
        error: err.message,
      })
    )
    .catch((e) => logger.error("Failed to mark sync_event failed", { error: (e as Error).message }));
});

syncWorker.on("error", (err) => {
  logger.error("Worker error", { error: err.message });
});

logger.info("SyncBridge worker started", { queue: SYNC_QUEUE_NAME, concurrency: 5 });

process.on("SIGTERM", async () => {
  logger.info("Worker shutting down (SIGTERM)");
  await syncWorker.close();
  process.exit(0);
});
