import { Router } from "express";
import { pollSalesforce } from "../services/pollService";
import { logger } from "../utils/logger";

export const syncRouter = Router();

syncRouter.post("/poll", async (_req, res) => {
  try {
    const result = await pollSalesforce();
    res.json(result);
  } catch (err) {
    logger.error("Manual Salesforce poll failed", { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});
