import { PoolClient } from "pg";
import type { SystemName } from "@syncbridge/shared";

/**
 * Attempts to claim an idempotency key inside an existing transaction.
 * Uses ON CONFLICT DO NOTHING against the (source_system,
 * source_external_id, change_hash) unique constraint, so concurrent
 * pollers/webhooks can never create two sync_events for the same change.
 *
 * Returns the new idempotency_keys row id if this is a genuinely new
 * change, or null if it's a duplicate (caller should skip it).
 */
export async function claimIdempotencyKey(
  client: PoolClient,
  sourceSystem: SystemName,
  sourceExternalId: string,
  changeHash: string
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO idempotency_keys (source_system, source_external_id, change_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (source_system, source_external_id, change_hash) DO NOTHING
     RETURNING id`,
    [sourceSystem, sourceExternalId, changeHash]
  );
  return rows[0]?.id ?? null;
}

export async function linkIdempotencyKeyToEvent(
  client: PoolClient,
  idempotencyKeyId: string,
  syncEventId: string
): Promise<void> {
  await client.query(`UPDATE idempotency_keys SET sync_event_id = $1 WHERE id = $2`, [syncEventId, idempotencyKeyId]);
}
