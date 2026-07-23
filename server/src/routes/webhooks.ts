import { Router } from "express";
import type { NexCoreWebhookPayload } from "@syncbridge/shared";
import { handleNexCoreWebhook } from "../services/webhookService";
import { logger } from "../utils/logger";

export const webhooksRouter = Router();

webhooksRouter.post("/nexcore", async (req, res) => {
  const body = req.body as NexCoreWebhookPayload;

  if (!body || !body.order_id || !body.status) {
    return res.status(400).json({ error: "Payload must include at least order_id and status" });
  }

  try {
    const result = await handleNexCoreWebhook(body);
    res.status(202).json(result);
  } catch (err) {
    logger.error("NexCore webhook handling failed", { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});
