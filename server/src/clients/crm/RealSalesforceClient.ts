import type { CrmRecord } from "@syncbridge/shared";
import { CrmClient } from "./CrmClient";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

/**
 * Real Salesforce REST API client, scaffolded but not wired to a live org.
 * The OAuth flow and SOQL query shape are correct; swap USE_MOCK_SALESFORCE
 * to false and fill in SF_* env vars against a real Dev Org to activate it.
 *
 * Auth: username-password OAuth 2.0 flow (simplest for a server-to-server
 * integration; swap for JWT bearer flow in production for better security
 * posture - no long-lived password in env vars).
 */
export class RealSalesforceClient implements CrmClient {
  private accessToken: string | null = null;
  private instanceUrl: string | null = null;

  private async authenticate(): Promise<void> {
    // TODO(live org): POST to https://login.salesforce.com/services/oauth2/token
    // with grant_type=password, client_id, client_secret, username,
    // password + security token. Salesforce returns { access_token,
    // instance_url, ... }. Cache the token and re-authenticate on 401.
    //
    // const res = await fetch("https://login.salesforce.com/services/oauth2/token", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/x-www-form-urlencoded" },
    //   body: new URLSearchParams({
    //     grant_type: "password",
    //     client_id: env.salesforce.clientId,
    //     client_secret: env.salesforce.clientSecret,
    //     username: env.salesforce.username,
    //     password: env.salesforce.password,
    //   }),
    // });
    // const data = await res.json();
    // this.accessToken = data.access_token;
    // this.instanceUrl = data.instance_url;

    throw new Error(
      "RealSalesforceClient.authenticate() is a stub - connect a live Dev Org and implement the OAuth 2.0 token exchange (see TODO above) before setting USE_MOCK_SALESFORCE=false."
    );
  }

  async fetchModifiedSince(cursor: string): Promise<CrmRecord[]> {
    await this.authenticate();

    // TODO(live org): SOQL query via the REST API's /query endpoint.
    // const soql = `SELECT Id, Name, StageName, Amount, AccountId, Account.Name, ` +
    //   `Account.Email__c, CloseDate, LastModifiedDate FROM Opportunity ` +
    //   `WHERE LastModifiedDate > ${cursor} ORDER BY LastModifiedDate ASC`;
    // const url = `${this.instanceUrl}/services/data/${env.salesforce.apiVersion}/query?q=${encodeURIComponent(soql)}`;
    // const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    // const data = await res.json();
    // return data.records;

    logger.warn("RealSalesforceClient.fetchModifiedSince called but not implemented against a live org");
    return [];
  }

  async updateRecord(externalId: string, payload: object): Promise<{ externalId: string }> {
    await this.authenticate();

    // TODO(live org): PATCH /services/data/{version}/sobjects/Opportunity/{id}
    // const url = `${this.instanceUrl}/services/data/${env.salesforce.apiVersion}/sobjects/Opportunity/${externalId}`;
    // await fetch(url, {
    //   method: "PATCH",
    //   headers: {
    //     Authorization: `Bearer ${this.accessToken}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(payload),
    // });

    logger.warn("RealSalesforceClient.updateRecord called but not implemented against a live org", { externalId });
    return { externalId };
  }
}
