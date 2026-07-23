import { createHash } from "crypto";

/**
 * JSON.stringify with recursively sorted object keys, so the same logical
 * payload always serializes to the same string regardless of key order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
  );
  return `{${entries.join(",")}}`;
}

/**
 * Deterministic fingerprint of a change payload, used as the third leg of
 * the idempotency key (source_system, source_external_id, change_hash).
 * If the exact same payload comes through twice (e.g. a re-delivered
 * webhook, or polling picking up a record it already saw), the hash
 * matches and the event is deduped before it ever reaches the queue.
 */
export function computeChangeHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
