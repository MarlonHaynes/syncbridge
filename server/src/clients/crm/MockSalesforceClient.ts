import type { CrmRecord } from "@syncbridge/shared";
import { CrmClient } from "./CrmClient";
import { seedOpportunities } from "../../fixtures/salesforceOpportunities";
import { logger } from "../../utils/logger";

/**
 * In-memory stand-in for a Salesforce org. Seeded with canned Closed Won
 * (and one non-Closed-Won, to prove filtering) Opportunities so the first
 * poll produces visible sync events with zero real credentials.
 */
export class MockSalesforceClient implements CrmClient {
  private records: CrmRecord[];
  private nextSeq = 1000;

  constructor() {
    this.records = [...seedOpportunities];
  }

  async fetchModifiedSince(cursor: string): Promise<CrmRecord[]> {
    const cursorTime = new Date(cursor).getTime();
    const changed = this.records
      .filter((r) => new Date(r.LastModifiedDate).getTime() > cursorTime)
      .sort((a, b) => new Date(a.LastModifiedDate).getTime() - new Date(b.LastModifiedDate).getTime());

    logger.info("[MockSalesforceClient] fetchModifiedSince", {
      cursor,
      matched: changed.length,
    });
    return changed;
  }

  async updateRecord(externalId: string, payload: object): Promise<{ externalId: string }> {
    logger.info("[MockSalesforceClient] updateRecord (simulated)", { externalId, payload });
    const idx = this.records.findIndex((r) => r.id === externalId);
    if (idx >= 0) {
      this.records[idx] = { ...this.records[idx], ...payload, LastModifiedDate: new Date().toISOString() };
    }
    return { externalId };
  }

  /**
   * Demo helper (not part of the CrmClient interface): appends a brand new
   * Closed Won Opportunity with LastModifiedDate = now, so the next poll
   * visibly surfaces it as a "new" record once the cursor has advanced.
   */
  seedNewClosedWonOpportunity(): CrmRecord {
    this.nextSeq += 1;
    const record: CrmRecord = {
      id: `006Sf000001${this.nextSeq}`,
      attributes: { type: "Opportunity" },
      Name: `Generated Deal #${this.nextSeq}`,
      StageName: "Closed Won",
      Amount: 10000 + Math.round(Math.random() * 90000),
      AccountId: `001Sf000000${this.nextSeq}`,
      AccountName: `Generated Account ${this.nextSeq}`,
      Email: `contact${this.nextSeq}@generated.example.com`,
      CloseDate: new Date().toISOString().slice(0, 10),
      LastModifiedDate: new Date().toISOString(),
    };
    this.records.push(record);
    logger.info("[MockSalesforceClient] seeded new Closed Won opportunity", { id: record.id });
    return record;
  }
}
