import { ErpClient } from "./ErpClient";
import { MockNexCoreClient } from "./MockNexCoreClient";
import { RealNexCoreClient } from "./RealNexCoreClient";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

let instance: ErpClient | null = null;

/** Singleton so the mock's in-memory store and failure-mode flag persist across requests. */
export function getErpClient(): ErpClient {
  if (!instance) {
    instance = env.useMockNexcore ? new MockNexCoreClient() : new RealNexCoreClient();
    logger.info(`ERP client initialized: ${env.useMockNexcore ? "MockNexCoreClient" : "RealNexCoreClient"}`);
  }
  return instance;
}

export type { ErpClient } from "./ErpClient";
export { MockNexCoreClient } from "./MockNexCoreClient";
