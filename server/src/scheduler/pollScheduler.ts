import { pollSalesforce } from "../services/pollService";
import { logger } from "../utils/logger";
import { env } from "../config/env";

/**
 * Background poller so the system self-syncs without a human clicking
 * anything - the manual POST /sync/poll endpoint exists for demos.
 */
export function startPollScheduler(): NodeJS.Timeout {
  logger.info("Salesforce poll scheduler started", { intervalMs: env.scheduler.sfPollIntervalMs });

  return setInterval(() => {
    pollSalesforce().catch((err) => {
      logger.error("Scheduled Salesforce poll failed", { error: (err as Error).message });
    });
  }, env.scheduler.sfPollIntervalMs);
}
