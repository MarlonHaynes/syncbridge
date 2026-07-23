import { getCrmClient } from "../clients/crm";
import { createSyncEventIfNew } from "./syncEventService";
import { enqueueSyncEvent } from "../queue/syncQueue";
import { getCursor, advanceCursor } from "./cursorService";
import { logger } from "../utils/logger";

export interface PollResult {
  scanned: number;
  eligible: number;
  created: number;
  duplicates: number;
  cursorBefore: string;
  cursorAfter: string;
}

/**
 * Ingestion for the Salesforce -> NexCore direction. Polls for ANY
 * Opportunity modified since the stored cursor, filters down to Closed Won
 * (the only stage that should ever create downstream records), then hands
 * each one to the idempotency-guarded event creator.
 *
 * This is the seam to swap for Change Data Capture later: everything below
 * `fetchModifiedSince` is agnostic to how changes were detected.
 */
export async function pollSalesforce(): Promise<PollResult> {
  const cursorBefore = await getCursor("salesforce", "opportunity");
  const crm = getCrmClient();

  const changed = await crm.fetchModifiedSince(cursorBefore);
  const closedWon = changed.filter((r) => r.StageName === "Closed Won");

  let created = 0;
  let duplicates = 0;

  for (const opp of closedWon) {
    const result = await createSyncEventIfNew({
      sourceSystem: "salesforce",
      targetSystem: "nexcore",
      entityType: "opportunity",
      sourceExternalId: opp.id,
      direction: "salesforce_to_nexcore",
      payload: opp as unknown as Record<string, unknown>,
    });

    if (result.created && result.event) {
      created += 1;
      await enqueueSyncEvent(result.event.id);
    } else {
      duplicates += 1;
    }
  }

  let cursorAfter = cursorBefore;
  if (changed.length > 0) {
    const latest = changed.reduce((max, r) => (r.LastModifiedDate > max ? r.LastModifiedDate : max), changed[0].LastModifiedDate);
    cursorAfter = new Date(latest).toISOString();
    await advanceCursor("salesforce", "opportunity", cursorAfter, changed[changed.length - 1].id);
  }

  logger.info("Salesforce poll complete", {
    scanned: changed.length,
    eligible: closedWon.length,
    created,
    duplicates,
    cursorBefore,
    cursorAfter,
  });

  return {
    scanned: changed.length,
    eligible: closedWon.length,
    created,
    duplicates,
    cursorBefore,
    cursorAfter,
  };
}
