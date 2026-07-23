import type { NexCoreWebhookPayload } from "@syncbridge/shared";
import { createSyncEventIfNew } from "./syncEventService";
import { enqueueSyncEvent } from "../queue/syncQueue";
import { logger } from "../utils/logger";

/**
 * Ingestion for the NexCore -> Salesforce direction. NexCore is ours, so
 * instead of polling it, it pushes changes to us directly.
 */
export async function handleNexCoreWebhook(body: NexCoreWebhookPayload): Promise<{ created: boolean; syncEventId: string | null }> {
  if (!body.order_id) {
    throw new Error("Webhook payload missing required field: order_id");
  }

  const result = await createSyncEventIfNew({
    sourceSystem: "nexcore",
    targetSystem: "salesforce",
    entityType: "sales_order",
    sourceExternalId: body.order_id,
    direction: "nexcore_to_salesforce",
    payload: body as unknown as Record<string, unknown>,
  });

  if (result.created && result.event) {
    await enqueueSyncEvent(result.event.id);
    logger.info("NexCore webhook ingested", { orderId: body.order_id, syncEventId: result.event.id });
    return { created: true, syncEventId: result.event.id };
  }

  logger.info("NexCore webhook duplicate skipped", { orderId: body.order_id });
  return { created: false, syncEventId: null };
}
