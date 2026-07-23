import { createApp } from "./app";
import { env } from "./config/env";
import { startPollScheduler } from "./scheduler/pollScheduler";
import { logger } from "./utils/logger";

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`SyncBridge server listening on port ${env.port}`, {
    mockSalesforce: env.useMockSalesforce,
    mockNexcore: env.useMockNexcore,
  });
});

const schedulerHandle = startPollScheduler();

process.on("SIGTERM", () => {
  logger.info("Server shutting down (SIGTERM)");
  clearInterval(schedulerHandle);
  server.close(() => process.exit(0));
});
