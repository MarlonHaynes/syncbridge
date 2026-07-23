import { CrmClient } from "./CrmClient";
import { MockSalesforceClient } from "./MockSalesforceClient";
import { RealSalesforceClient } from "./RealSalesforceClient";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

let instance: CrmClient | null = null;

/**
 * Singleton so MockSalesforceClient's in-memory records (and the demo
 * "seed new opportunity" helper) persist across requests within one
 * running process.
 */
export function getCrmClient(): CrmClient {
  if (!instance) {
    instance = env.useMockSalesforce ? new MockSalesforceClient() : new RealSalesforceClient();
    logger.info(`CRM client initialized: ${env.useMockSalesforce ? "MockSalesforceClient" : "RealSalesforceClient"}`);
  }
  return instance;
}

export type { CrmClient } from "./CrmClient";
export { MockSalesforceClient } from "./MockSalesforceClient";
