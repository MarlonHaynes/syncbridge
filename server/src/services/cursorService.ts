import { pool } from "../db/client";
import type { EntityType, SystemName } from "@syncbridge/shared";

const EPOCH = "1970-01-01T00:00:00.000Z";

export async function getCursor(system: SystemName, entityType: EntityType): Promise<string> {
  const { rows } = await pool.query<{ last_synced_at: string | null }>(
    `SELECT last_synced_at FROM sync_cursors WHERE system = $1 AND entity_type = $2`,
    [system, entityType]
  );
  if (!rows[0] || !rows[0].last_synced_at) return EPOCH;
  return new Date(rows[0].last_synced_at).toISOString();
}

export async function advanceCursor(system: SystemName, entityType: EntityType, isoTimestamp: string, lastId?: string): Promise<void> {
  await pool.query(
    `INSERT INTO sync_cursors (system, entity_type, last_synced_at, last_id, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (system, entity_type)
     DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at, last_id = EXCLUDED.last_id, updated_at = now()`,
    [system, entityType, isoTimestamp, lastId ?? null]
  );
}
