import { pool } from "./client";
import { logger } from "../utils/logger";

async function seed(): Promise<void> {
  await pool.query(`DELETE FROM mappings`);
  await pool.query(`DELETE FROM connections`);

  await pool.query(
    `INSERT INTO connections (system, config, credentials_ref) VALUES
       ('salesforce', $1::jsonb, 'secrets/salesforce-dev-org'),
       ('nexcore', $2::jsonb, 'secrets/nexcore-api-key')`,
    [
      JSON.stringify({ mode: "mock", note: "MockSalesforceClient active until USE_MOCK_SALESFORCE=false" }),
      JSON.stringify({ mode: "mock", note: "MockNexCoreClient active until USE_MOCK_NEXCORE=false" }),
    ]
  );

  // Salesforce Opportunity (Closed Won) -> NexCore Customer + Sales Order.
  // Linkage fields (customer_external_id, currency, status, external_ref)
  // are filled in by the worker, not the mapping - they depend on the
  // result of createCustomer(), not on static source data.
  const sfToNexCoreMap = {
    AccountName: "customer.legal_name",
    Email: "customer.email",
    Id: "customer.external_ref",
    Amount: "sales_order.order_total",
  };

  // NexCore Sales Order status change -> Salesforce Opportunity fields.
  const nexCoreToSfMap = {
    status: "NexCore_Order_Status__c",
    order_id: "NexCore_Order_Id__c",
    updated_at: "NexCore_Last_Synced__c",
  };

  await pool.query(
    `INSERT INTO mappings (source_system, target_system, entity_type, field_map, active) VALUES
       ('salesforce', 'nexcore', 'opportunity', $1::jsonb, true),
       ('nexcore', 'salesforce', 'sales_order', $2::jsonb, true)`,
    [JSON.stringify(sfToNexCoreMap), JSON.stringify(nexCoreToSfMap)]
  );

  logger.info("Seed complete: 2 connections, 2 active mappings.");
  logger.info(
    "Mock Salesforce fixture data (4 Closed Won opportunities + 1 Prospecting) lives in src/fixtures/salesforceOpportunities.ts " +
      "and loads automatically into MockSalesforceClient - no DB seeding needed for it."
  );
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    logger.error("Seed failed", { error: (err as Error).message });
    pool.end().finally(() => process.exit(1));
  });
