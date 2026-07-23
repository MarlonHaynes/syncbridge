import type { NexCoreCustomerPayload, NexCoreSalesOrderPayload } from "@syncbridge/shared";
import { ErpClient } from "./ErpClient";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

/**
 * Real NexCore API client, scaffolded against NEXCORE_API_URL /
 * NEXCORE_API_KEY. Since you own NexCore, this is mostly ready to go -
 * just point NEXCORE_API_URL at a real deployment and flip
 * USE_MOCK_NEXCORE=false. The fetch calls are sketched below; uncomment
 * and adjust to NexCore's actual route/response shape once it exists.
 */
export class RealNexCoreClient implements ErpClient {
  private async request<T>(path: string, body: object): Promise<T> {
    // TODO(live NexCore): confirm the actual response envelope and adjust.
    const res = await fetch(`${env.nexcore.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.nexcore.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`NexCore API error ${res.status} on ${path}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async createCustomer(payload: NexCoreCustomerPayload): Promise<{ externalId: string }> {
    logger.info("[RealNexCoreClient] createCustomer", { url: env.nexcore.apiUrl });
    // TODO(live NexCore): this will throw against the placeholder URL until
    // NEXCORE_API_URL points at a real instance.
    return this.request<{ externalId: string }>("/api/customers", payload);
  }

  async createSalesOrder(payload: NexCoreSalesOrderPayload): Promise<{ externalId: string }> {
    logger.info("[RealNexCoreClient] createSalesOrder", { url: env.nexcore.apiUrl });
    return this.request<{ externalId: string }>("/api/sales-orders", payload);
  }
}
