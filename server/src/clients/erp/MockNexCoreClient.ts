import { randomUUID } from "crypto";
import type { NexCoreCustomerPayload, NexCoreSalesOrderPayload } from "@syncbridge/shared";
import { ErpClient } from "./ErpClient";
import { logger } from "../../utils/logger";
import { connection } from "../../queue/connection";

interface StoredCustomer extends NexCoreCustomerPayload {
  externalId: string;
}

interface StoredSalesOrder extends NexCoreSalesOrderPayload {
  externalId: string;
}

const FAILURE_MODE_KEY = "syncbridge:mock:nexcore:failure_mode";

/**
 * In-memory stand-in for NexCore. Also doubles as the "force a failure"
 * lever for the demo: toggling failureMode on makes every write throw,
 * so a queued job visibly retries with backoff and lands dead - then
 * toggling it back off and hitting Replay recovers it to success.
 *
 * The failure flag lives in Redis, not process memory: the API server (where
 * the toggle is flipped) and the worker (where createCustomer/createSalesOrder
 * actually run) are separate processes, so in-memory state wouldn't be
 * visible across them.
 */
export class MockNexCoreClient implements ErpClient {
  private customers: StoredCustomer[] = [];
  private salesOrders: StoredSalesOrder[] = [];

  async setFailureMode(enabled: boolean): Promise<void> {
    await connection.set(FAILURE_MODE_KEY, enabled ? "1" : "0");
    logger.warn(`[MockNexCoreClient] failure mode ${enabled ? "ENABLED" : "disabled"}`);
  }

  async getFailureMode(): Promise<boolean> {
    return (await connection.get(FAILURE_MODE_KEY)) === "1";
  }

  async createCustomer(payload: NexCoreCustomerPayload): Promise<{ externalId: string }> {
    if (await this.getFailureMode()) {
      throw new Error("NexCore outage simulated (failure mode enabled): createCustomer rejected");
    }
    if (!payload.legal_name || !payload.email) {
      throw new Error(`NexCore validation error: missing required customer field(s) in payload ${JSON.stringify(payload)}`);
    }

    const externalId = `nx-cust-${randomUUID().slice(0, 8)}`;
    const record: StoredCustomer = { ...payload, externalId };
    this.customers.push(record);
    logger.info("[MockNexCoreClient] createCustomer", { externalId, legal_name: payload.legal_name });
    return { externalId };
  }

  async createSalesOrder(payload: NexCoreSalesOrderPayload): Promise<{ externalId: string }> {
    if (await this.getFailureMode()) {
      throw new Error("NexCore outage simulated (failure mode enabled): createSalesOrder rejected");
    }
    if (!payload.customer_external_id || typeof payload.order_total !== "number") {
      throw new Error(`NexCore validation error: missing required sales order field(s) in payload ${JSON.stringify(payload)}`);
    }

    const externalId = `nx-so-${randomUUID().slice(0, 8)}`;
    const record: StoredSalesOrder = { ...payload, externalId };
    this.salesOrders.push(record);
    logger.info("[MockNexCoreClient] createSalesOrder", { externalId, total: payload.order_total });
    return { externalId };
  }

  listCustomers(): StoredCustomer[] {
    return this.customers;
  }

  listSalesOrders(): StoredSalesOrder[] {
    return this.salesOrders;
  }
}
