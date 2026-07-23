-- SyncBridge initial schema
-- SyncBridge owns this database; Salesforce and NexCore never see it directly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- connections: one row per external system this instance talks to.
-- credentials_ref is a POINTER (e.g. a secrets-manager key name), never a
-- raw token. In production this is where you'd wire up KMS/Vault-backed
-- encryption-at-rest; for the demo it stays a placeholder string.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system TEXT NOT NULL CHECK (system IN ('salesforce', 'nexcore')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  credentials_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- mappings: field transformations are DATA, not hardcoded branches in the
-- worker. field_map keys are dotted source paths, values are dotted target
-- paths, e.g. {"Amount": "sales_order.order_total"}.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL CHECK (source_system IN ('salesforce', 'nexcore')),
  target_system TEXT NOT NULL CHECK (target_system IN ('salesforce', 'nexcore')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('opportunity', 'sales_order')),
  field_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- sync_events: the heart of the system. One row per detected change, tracked
-- from detection through delivery (or dead-lettering).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL CHECK (source_system IN ('salesforce', 'nexcore')),
  target_system TEXT NOT NULL CHECK (target_system IN ('salesforce', 'nexcore')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('opportunity', 'sales_order')),
  source_external_id TEXT NOT NULL,
  target_external_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('salesforce_to_nexcore', 'nexcore_to_salesforce')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  payload JSONB NOT NULL,
  transformed_payload JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);
CREATE INDEX IF NOT EXISTS idx_sync_events_direction ON sync_events(direction);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity_type ON sync_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_events_created_at ON sync_events(created_at DESC);

-- ---------------------------------------------------------------------------
-- idempotency_keys: dedupe changes before they ever reach the queue. A
-- repeat change (same source record, same content) must not create a
-- duplicate downstream Customer/Sales Order/Opportunity update.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL CHECK (source_system IN ('salesforce', 'nexcore')),
  source_external_id TEXT NOT NULL,
  change_hash TEXT NOT NULL,
  sync_event_id UUID REFERENCES sync_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_external_id, change_hash)
);

-- ---------------------------------------------------------------------------
-- sync_cursors: polling watermark per (connection-ish key, entity_type).
-- We key by system + entity_type rather than a connections.id FK so the
-- mock and real clients share the same cursor row across swaps.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system TEXT NOT NULL CHECK (system IN ('salesforce', 'nexcore')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('opportunity', 'sales_order')),
  last_synced_at TIMESTAMPTZ,
  last_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system, entity_type)
);
