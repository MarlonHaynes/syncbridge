/**
 * Shared types used by both the SyncBridge server and the operator dashboard.
 * Keeping these in one package means the API contract can't silently drift
 * between backend and frontend.
 */

export type SystemName = "salesforce" | "nexcore";

export type SyncDirection = "salesforce_to_nexcore" | "nexcore_to_salesforce";

export type SyncStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "dead";

export type EntityType = "opportunity" | "sales_order";

export interface SyncEvent {
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
  created_at: string;
  updated_at: string;
}

export interface SyncEventListResponse {
  data: SyncEvent[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    pending: number;
    processing: number;
    success: number;
    failed: number;
    dead: number;
  };
}

export interface Mapping {
  id: string;
  source_system: SystemName;
  target_system: SystemName;
  entity_type: EntityType;
  field_map: Record<string, string>;
  active: boolean;
}

export interface Connection {
  id: string;
  system: SystemName;
  config: Record<string, unknown>;
  credentials_ref: string | null;
  created_at: string;
}

// --- CRM (Salesforce) domain shapes ---

export interface CrmRecord {
  id: string; // Salesforce Opportunity Id
  attributes: {
    type: "Opportunity";
  };
  Name: string;
  StageName: string;
  Amount: number;
  AccountId: string;
  AccountName: string;
  Email: string;
  CloseDate: string;
  LastModifiedDate: string;
}

// --- ERP (NexCore) domain shapes ---

export interface NexCoreCustomerPayload {
  legal_name: string;
  email: string;
  external_ref: string;
}

export interface NexCoreSalesOrderPayload {
  customer_external_id: string;
  order_total: number;
  currency: string;
  external_ref: string;
  status: string;
}

export interface NexCoreWebhookPayload {
  event_type: "order.status_changed" | "order.created";
  order_id: string;
  status: string;
  opportunity_id?: string;
  updated_at: string;
  [key: string]: unknown;
}
