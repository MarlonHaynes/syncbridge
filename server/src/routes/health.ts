import { Router } from "express";
import { env } from "../config/env";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    mocks: {
      salesforce: env.useMockSalesforce,
      nexcore: env.useMockNexcore,
    },
  });
});
