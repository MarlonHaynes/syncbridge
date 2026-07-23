import type { NexCoreCustomerPayload, NexCoreSalesOrderPayload } from "@syncbridge/shared";

/**
 * Everything the rest of SyncBridge knows about "the ERP". NexCore pushes
 * its own changes to us via webhook (see routes/webhooks.ts), so this
 * interface only needs outbound write operations - no fetch method.
 */
export interface ErpClient {
  createCustomer(payload: NexCoreCustomerPayload): Promise<{ externalId: string }>;
  createSalesOrder(payload: NexCoreSalesOrderPayload): Promise<{ externalId: string }>;
}
