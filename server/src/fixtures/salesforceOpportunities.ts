import type { CrmRecord } from "@syncbridge/shared";

/**
 * Canned Salesforce Opportunities used by MockSalesforceClient. Timestamps
 * are spread out in the past so a fresh cursor ('1970-01-01T00:00:00Z')
 * picks up everything on the first poll, and "Prospecting" is included to
 * prove the ingestion layer filters to Closed Won only.
 */
export const seedOpportunities: CrmRecord[] = [
  {
    id: "006Sf0000012ABC",
    attributes: { type: "Opportunity" },
    Name: "Acme Industrial - Annual Contract",
    StageName: "Closed Won",
    Amount: 84000,
    AccountId: "001Sf0000009XYZ",
    AccountName: "Acme Industrial",
    Email: "ap@acmeindustrial.example.com",
    CloseDate: "2026-07-10",
    LastModifiedDate: "2026-07-10T14:32:00.000Z",
  },
  {
    id: "006Sf0000012ABD",
    attributes: { type: "Opportunity" },
    Name: "Beacon Health - Platform License",
    StageName: "Closed Won",
    Amount: 156500,
    AccountId: "001Sf0000009XYA",
    AccountName: "Beacon Health Group",
    Email: "procurement@beaconhealth.example.com",
    CloseDate: "2026-07-12",
    LastModifiedDate: "2026-07-12T09:05:00.000Z",
  },
  {
    id: "006Sf0000012ABE",
    attributes: { type: "Opportunity" },
    Name: "Cascade Logistics - Fleet Renewal",
    StageName: "Prospecting",
    Amount: 42000,
    AccountId: "001Sf0000009XYB",
    AccountName: "Cascade Logistics",
    Email: "buying@cascadelogistics.example.com",
    CloseDate: "2026-08-01",
    LastModifiedDate: "2026-07-14T11:20:00.000Z",
  },
  {
    id: "006Sf0000012ABF",
    attributes: { type: "Opportunity" },
    Name: "Driftwood Retail - POS Rollout",
    StageName: "Closed Won",
    Amount: 61200,
    AccountId: "001Sf0000009XYC",
    AccountName: "Driftwood Retail Co",
    Email: "it@driftwoodretail.example.com",
    CloseDate: "2026-07-15",
    LastModifiedDate: "2026-07-15T16:45:00.000Z",
  },
  {
    id: "006Sf0000012ABG",
    attributes: { type: "Opportunity" },
    Name: "Everline Freight - Multi-Site Deal",
    StageName: "Closed Won",
    Amount: 233900,
    AccountId: "001Sf0000009XYD",
    AccountName: "Everline Freight Systems",
    Email: "finance@everlinefreight.example.com",
    CloseDate: "2026-07-18",
    LastModifiedDate: "2026-07-18T08:00:00.000Z",
  },
];
