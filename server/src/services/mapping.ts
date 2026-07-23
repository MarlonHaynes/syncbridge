import { pool } from "../db/client";
import type { EntityType, Mapping, SystemName } from "@syncbridge/shared";

export async function loadActiveMapping(
  sourceSystem: SystemName,
  targetSystem: SystemName,
  entityType: EntityType
): Promise<Mapping | null> {
  const { rows } = await pool.query<Mapping>(
    `SELECT id, source_system, target_system, entity_type, field_map, active
     FROM mappings
     WHERE source_system = $1 AND target_system = $2 AND entity_type = $3 AND active = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [sourceSystem, targetSystem, entityType]
  );
  return rows[0] ?? null;
}

function getPath(obj: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setPath(obj: Record<string, unknown>, dottedPath: string, value: unknown): void {
  const keys = dottedPath.split(".");
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

/**
 * Applies a config-driven field_map ({"Source.Path": "target.path"}) to a
 * source payload, producing a nested target object. Transformation logic
 * lives in data (the mappings table), not in worker branches - so ops can
 * change field mappings without a deploy.
 */
export function applyMapping(fieldMap: Record<string, string>, sourcePayload: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [sourcePath, targetPath] of Object.entries(fieldMap)) {
    const value = getPath(sourcePayload, sourcePath);
    setPath(output, targetPath, value);
  }
  return output;
}
