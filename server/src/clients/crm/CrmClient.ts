import type { CrmRecord } from "@syncbridge/shared";

/**
 * Everything the rest of SyncBridge knows about "the CRM". Ingestion, the
 * worker, and the API only ever depend on this interface - never on
 * MockSalesforceClient or RealSalesforceClient directly - so swapping in a
 * live org later is a one-line change in the factory, not a rewrite.
 */
export interface CrmClient {
  /**
   * Poll for records changed since `cursor` (an ISO-8601 timestamp).
   * Returns ALL modified Opportunities regardless of stage; the ingestion
   * layer decides which stages are sync-worthy (Closed Won).
   */
  fetchModifiedSince(cursor: string): Promise<CrmRecord[]>;

  /**
   * Push an update back into the CRM, e.g. reflecting a NexCore Sales
   * Order status change onto the originating Opportunity.
   */
  updateRecord(externalId: string, payload: object): Promise<{ externalId: string }>;
}
