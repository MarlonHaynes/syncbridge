import { Router } from "express";
import type { SyncDirection, SyncStatus, EntityType } from "@syncbridge/shared";
import { getSyncEventById, listSyncEvents, resetForReplay } from "../services/syncEventService";
import { enqueueSyncEvent } from "../queue/syncQueue";
import { logger } from "../utils/logger";

export const eventsRouter = Router();

const VALID_STATUSES: SyncStatus[] = ["pending", "processing", "success", "failed", "dead"];
const VALID_DIRECTIONS: SyncDirection[] = ["salesforce_to_nexcore", "nexcore_to_salesforce"];
const VALID_ENTITY_TYPES: EntityType[] = ["opportunity", "sales_order"];

eventsRouter.get("/", async (req, res) => {
  const status = req.query.status as SyncStatus | undefined;
  const direction = req.query.direction as SyncDirection | undefined;
  const entityType = req.query.entityType as EntityType | undefined;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  if (direction && !VALID_DIRECTIONS.includes(direction)) {
    return res.status(400).json({ error: `Invalid direction. Must be one of: ${VALID_DIRECTIONS.join(", ")}` });
  }
  if (entityType && !VALID_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}` });
  }

  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? "25", 10) || 25));

  const result = await listSyncEvents({ status, direction, entityType, page, pageSize });
  res.json(result);
});

eventsRouter.get("/:id", async (req, res) => {
  const event = await getSyncEventById(req.params.id);
  if (!event) return res.status(404).json({ error: "sync_event not found" });
  res.json(event);
});

eventsRouter.post("/:id/replay", async (req, res) => {
  const event = await resetForReplay(req.params.id);
  if (!event) {
    return res.status(409).json({ error: "Event not found or not in a replayable state (must be failed or dead)" });
  }
  await enqueueSyncEvent(event.id);
  logger.info("Event replayed", { syncEventId: event.id });
  res.json(event);
});
