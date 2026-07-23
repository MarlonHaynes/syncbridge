import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { eventsRouter } from "./routes/events";
import { webhooksRouter } from "./routes/webhooks";
import { syncRouter } from "./routes/sync";
import { adminRouter } from "./routes/admin";
import { logger } from "./utils/logger";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.use("/", healthRouter);
  app.use("/events", eventsRouter);
  app.use("/webhooks", webhooksRouter);
  app.use("/sync", syncRouter);
  app.use("/admin", adminRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("Unhandled request error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
