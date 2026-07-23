import { Router } from "express";
import { getCrmClient, MockSalesforceClient } from "../clients/crm";
import { getErpClient, MockNexCoreClient } from "../clients/erp";
import { env } from "../config/env";

/**
 * Demo-only controls for driving the mock systems - not something a real
 * integration middleware would expose. Lets the dashboard (and the README
 * curl walkthrough) force the two failure-recovery scenarios without
 * touching real credentials:
 *   1. seed a brand new Closed Won Opportunity so a second poll visibly
 *      surfaces something new past the cursor.
 *   2. flip NexCore into "outage mode" so writes fail, retry, and dead-letter.
 */
export const adminRouter = Router();

adminRouter.get("/state", async (_req, res) => {
  const erp = getErpClient();
  const failureMode = erp instanceof MockNexCoreClient ? await erp.getFailureMode() : false;

  res.json({
    useMockSalesforce: env.useMockSalesforce,
    useMockNexcore: env.useMockNexcore,
    nexcoreFailureMode: failureMode,
  });
});

adminRouter.post("/salesforce/seed-opportunity", (_req, res) => {
  const crm = getCrmClient();
  if (!(crm instanceof MockSalesforceClient)) {
    return res.status(400).json({ error: "Only supported when USE_MOCK_SALESFORCE=true" });
  }
  const record = crm.seedNewClosedWonOpportunity();
  res.status(201).json(record);
});

adminRouter.post("/nexcore/fail-mode", async (req, res) => {
  const erp = getErpClient();
  if (!(erp instanceof MockNexCoreClient)) {
    return res.status(400).json({ error: "Only supported when USE_MOCK_NEXCORE=true" });
  }
  const enabled = Boolean(req.body?.enabled);
  await erp.setFailureMode(enabled);
  res.json({ nexcoreFailureMode: enabled });
});
