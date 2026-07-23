import { pool } from "../db/client";
import { claimIdempotencyKey, linkIdempotencyKeyToEvent } from "./idempotency";
import { computeChangeHash } from "../utils/hash";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import type { EntityType, SyncDirection, SyncEvent, SyncStatus, SystemName } from "@syncbridge/shared";

interface SyncEventRow {
  id: string;
  source_system: SystemName;
  target_system: SystemName;
  entity_type: EntityType;
  source_external_id: string;
  target_external_id: string | null;
  direction: SyncDirection;
  status: SyncStatus;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
  transformed_payload: Record<string, unknown> | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: SyncEventRow): SyncEvent {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export interface CreateSyncEventInput {
  sourceSystem: SystemName;
  targetSystem: SystemName;
  entityType: EntityType;
  sourceExternalId: string;
  direction: SyncDirection;
  payload: Record<string, unknown>;
}

/**
 * Ingestion entry point for both pollers and webhooks. Wraps the
 * idempotency check + sync_events insert in one transaction: if the
 * (source_system, source_external_id, change_hash) triple has been seen
 * before, this is a no-op duplicate and no row/job is created.
 */
export async function createSyncEventIfNew(
  input: CreateSyncEventInput
): Promise<{ created: boolean; event: SyncEvent | null }> {
  const changeHash = computeChangeHash(input.payload);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const idempotencyKeyId = await claimIdempotencyKey(client, input.sourceSystem, input.sourceExternalId, changeHash);
    if (!idempotencyKeyId) {
      await client.query("ROLLBACK");
      logger.info("Duplicate change skipped (idempotency)", {
        sourceSystem: input.sourceSystem,
        sourceExternalId: input.sourceExternalId,
      });
      return { created: false, event: null };
    }

    const { rows } = await client.query<SyncEventRow>(
      `INSERT INTO sync_events
         (source_system, target_system, entity_type, source_external_id, direction, status, attempts, max_attempts, payload)
       VALUES ($1, $2, $3, $4, $5, 'pending', 0, $6, $7)
       RETURNING *`,
      [
        input.sourceSystem,
        input.targetSystem,
        input.entityType,
        input.sourceExternalId,
        input.direction,
        env.queue.maxAttempts,
        input.payload,
      ]
    );

    await linkIdempotencyKeyToEvent(client, idempotencyKeyId, rows[0].id);
    await client.query("COMMIT");

    return { created: true, event: mapRow(rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getSyncEventById(id: string): Promise<SyncEvent | null> {
  const { rows } = await pool.query<SyncEventRow>(`SELECT * FROM sync_events WHERE id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface ListSyncEventsFilters {
  status?: SyncStatus;
  direction?: SyncDirection;
  entityType?: EntityType;
  page: number;
  pageSize: number;
}

export async function listSyncEvents(filters: ListSyncEventsFilters) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.direction) {
    params.push(filters.direction);
    conditions.push(`direction = $${params.length}`);
  }
  if (filters.entityType) {
    params.push(filters.entityType);
    conditions.push(`entity_type = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.pageSize;

  const dataParams = [...params, filters.pageSize, offset];
  const { rows } = await pool.query<SyncEventRow>(
    `SELECT * FROM sync_events ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  const { rows: countRows } = await pool.query<{ count: string }>(`SELECT count(*) FROM sync_events ${where}`, params);

  const { rows: statusCounts } = await pool.query<{ status: SyncStatus; count: string }>(
    `SELECT status, count(*) FROM sync_events GROUP BY status`
  );
  const counts = { pending: 0, processing: 0, success: 0, failed: 0, dead: 0 };
  for (const row of statusCounts) {
    counts[row.status] = parseInt(row.count, 10);
  }

  return {
    data: rows.map(mapRow),
    total: parseInt(countRows[0].count, 10),
    page: filters.page,
    pageSize: filters.pageSize,
    counts,
  };
}

export async function markProcessing(id: string, attempts: number): Promise<void> {
  await pool.query(`UPDATE sync_events SET status = 'processing', attempts = $2, updated_at = now() WHERE id = $1`, [id, attempts]);
}

export async function markSuccess(
  id: string,
  targetExternalId: string,
  transformedPayload: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `UPDATE sync_events
     SET status = 'success', target_external_id = $2, transformed_payload = $3, last_error = NULL, updated_at = now()
     WHERE id = $1`,
    [id, targetExternalId, transformedPayload]
  );
}

export async function markFailed(id: string, errorMessage: string, isFinal: boolean): Promise<void> {
  await pool.query(
    `UPDATE sync_events SET status = $2, last_error = $3, updated_at = now() WHERE id = $1`,
    [id, isFinal ? "dead" : "failed", errorMessage]
  );
}

export async function resetForReplay(id: string): Promise<SyncEvent | null> {
  const { rows } = await pool.query<SyncEventRow>(
    `UPDATE sync_events
     SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now()
     WHERE id = $1 AND status IN ('failed', 'dead')
     RETURNING *`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
