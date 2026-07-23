# SyncBridge

**SyncBridge** is a bidirectional integration middleware that syncs data between a CRM (Salesforce) and an ERP (NexCore). It demonstrates the patterns that matter in production integration systems: async queue processing, idempotency, retries with exponential backoff, dead-lettering, and an operator dashboard for observing and recovering failed syncs.

The whole system runs **today, with zero real credentials** — both external systems sit behind interfaces with mock implementations that are on by default. Real API clients are scaffolded and swapped in later via environment flags.

## The scenario

1. An **Opportunity** is marked **Closed Won** in Salesforce → SyncBridge creates a matching **Customer** and **Sales Order** in NexCore.
2. When that Sales Order's status changes in NexCore → SyncBridge pushes the update back onto the originating Opportunity in Salesforce.

The interesting part is the middleware in between — detection, queuing, idempotency, transformation, retries, dead-lettering, and recovery — not CRUD on either system.

## Tech stack

- **Backend:** Node.js + Express, TypeScript
- **Database:** PostgreSQL (works with Supabase via `DATABASE_URL`)
- **Queue:** BullMQ + Redis
- **Frontend:** React + TypeScript + Vite
- **Monorepo:** npm workspaces (`shared` / `server` / `client`)

## Repo structure

```
syncbridge/
├─ docker-compose.yml       # Postgres + Redis for local dev
├─ .env.example / .env      # config (mocks on by default)
├─ shared/                  # types shared by server + client
├─ server/
│  ├─ src/clients/crm/      # CrmClient interface + Mock/Real Salesforce clients
│  ├─ src/clients/erp/      # ErpClient interface + Mock/Real NexCore clients
│  ├─ src/db/               # migrations, migrate.ts, seed.ts
│  ├─ src/services/         # idempotency, mapping, polling, webhook, sync_event logic
│  ├─ src/queue/            # BullMQ queue + worker
│  ├─ src/routes/           # Express routes (events, webhooks, sync, admin, health)
│  └─ src/fixtures/         # canned Salesforce Opportunity data
└─ client/
   └─ src/                  # operator dashboard (events table, detail drawer, controls)
```

## Architecture

```
 Salesforce (mock/real)                          NexCore (mock/real)
        │  poll (cursor)                              │  webhook (push)
        ▼                                              ▼
 ┌───────────────────────────── Ingestion ─────────────────────────────┐
 │  pollService.ts                              webhookService.ts      │
 └───────────────────────────────────┬──────────────────────────────────┘
                                      │ idempotency check → sync_events (pending)
                                      ▼
                              enqueueSyncEvent()
                                      │
                                      ▼
                              BullMQ queue (Redis)
                          retries + exponential backoff
                                      │
                                      ▼
                                  worker.ts
                    load mapping → transform → call target client
                                      │
                     success ──────┐ │ └────── throw (BullMQ retries)
                          ▼        │              │
                   sync_events           after max attempts:
                    = success            sync_events = dead
                                              │
                                     dashboard "Replay" button
                                     → resets to pending, re-enqueues
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the reasoning behind the queue, idempotency, retry, and dead-letter design.

## The mock-vs-real design

Every external system sits behind a TypeScript interface:

```ts
interface CrmClient {
  fetchModifiedSince(cursor: string): Promise<CrmRecord[]>;
  updateRecord(externalId: string, payload: object): Promise<{ externalId: string }>;
}

interface ErpClient {
  createCustomer(payload: object): Promise<{ externalId: string }>;
  createSalesOrder(payload: object): Promise<{ externalId: string }>;
}
```

Each has two implementations, selected by a factory based on env flags:

| Interface  | Mock (default)         | Real (stub)              | Toggle                  |
|------------|-------------------------|---------------------------|--------------------------|
| `CrmClient`| `MockSalesforceClient` | `RealSalesforceClient`   | `USE_MOCK_SALESFORCE`   |
| `ErpClient`| `MockNexCoreClient`    | `RealNexCoreClient`      | `USE_MOCK_NEXCORE`      |

Everything else — ingestion, the worker, the API — depends only on the interfaces. Flipping a flag and filling in real credentials is the entire migration path; no other code changes.

- `MockSalesforceClient` seeds itself from canned Closed Won Opportunities (`server/src/fixtures/salesforceOpportunities.ts`) and supports appending new ones at runtime (see "Demo controls" below), so polling and cursor-advancement are both visibly demonstrable without a real org.
- `MockNexCoreClient` stores Customers/Sales Orders in memory and has a Redis-backed "failure mode" flag used to force the retry → dead-letter → replay demo.
- `RealSalesforceClient` has the OAuth 2.0 username-password flow and SOQL query shape scaffolded, with `TODO` markers where a live Dev Org is required.
- `RealNexCoreClient` is wired to `NEXCORE_API_URL` / `NEXCORE_API_KEY` and mostly ready to go once NexCore exists at that URL.

## Getting started

### 1. Start Postgres + Redis

```bash
docker compose up -d
```

> **Port note:** Postgres is mapped to **host port 5433** (not 5432), in case you already have a local Postgres install using 5432. `DATABASE_URL` in `.env` / `.env.example` is already set to match. If you don't have a conflicting local Postgres, you can safely change the mapping back to `5432:5432` in `docker-compose.yml` and update `DATABASE_URL` accordingly.

### 2. Install dependencies

```bash
npm install
```

This also builds the `shared` types package (via a `postinstall` hook) so `server` and `client` can resolve `@syncbridge/shared`.

### 3. Migrate + seed the database

```bash
npm run migrate
npm run seed
```

Seeding inserts two `connections` rows and the two active field `mappings` (Salesforce→NexCore and NexCore→Salesforce). The mock Salesforce fixture data (4 Closed Won Opportunities + 1 non-Closed-Won, to prove filtering) lives in code and loads automatically — no DB seeding needed for it.

### 4. Run the app (three processes)

```bash
npm run dev:server   # Express API on :4000
npm run dev:worker   # BullMQ worker
npm run dev:client   # React dashboard on :5173
```

Open **http://localhost:5173**.

## Demo script

With mocks on (the default) and zero real credentials:

1. **Poll Salesforce.** Click **Run Salesforce Poll** in the dashboard (or `curl -X POST http://localhost:4000/sync/poll`). The 4 seeded Closed Won Opportunities flow through as sync events, land in the NexCore mock as Customers + Sales Orders, and show **Success** in the table.

2. **Send a NexCore webhook** (simulating a Sales Order status change):

   ```bash
   curl -X POST http://localhost:4000/webhooks/nexcore \
     -H "Content-Type: application/json" \
     -d '{
       "event_type": "order.status_changed",
       "order_id": "<a target_external_id from step 1>",
       "status": "Shipped",
       "opportunity_id": "<the matching source_external_id>",
       "updated_at": "2026-07-21T13:00:00.000Z"
     }'
   ```

   The event flows NexCore → Salesforce and shows **Success**.

3. **Force a failure.** Click **Simulate NexCore Outage** (or `curl -X POST http://localhost:4000/admin/nexcore/fail-mode -d '{"enabled":true}' -H "Content-Type: application/json"`), then **+ Seed SF Opportunity** to create a new Closed Won record, then **Run Salesforce Poll** again. Watch the new event go **Pending → Failed** (retrying with exponential backoff) and finally **Dead** after 5 attempts (~30s).

4. **Recover it.** Click **Simulate NexCore Outage** again to clear it, then hit **Replay** on the dead event (in the table row or the detail drawer). It resets to pending, re-enqueues, and comes back **Success**.

5. **Advance the cursor.** Click **+ Seed SF Opportunity** again, then **Run Salesforce Poll** — only the new record (past the stored watermark) is picked up; already-synced records are skipped.

## API reference

| Method | Path                        | Purpose                                            |
|--------|------------------------------|-----------------------------------------------------|
| `POST` | `/webhooks/nexcore`          | Inbound NexCore change → creates event + enqueues   |
| `POST` | `/sync/poll`                 | Manually trigger a Salesforce poll                  |
| `GET`  | `/events`                    | List sync events (filter: `status`, `direction`, `entityType`; paginated) |
| `GET`  | `/events/:id`                | Full event detail (payload, transformed payload, error) |
| `POST` | `/events/:id/replay`         | Reset a failed/dead event to pending and re-enqueue |
| `GET`  | `/health`                    | Liveness check                                      |
| `GET`  | `/admin/state`               | Current mock/failure-mode state (demo only)         |
| `POST` | `/admin/salesforce/seed-opportunity` | Append a new Closed Won Opportunity (demo only) |
| `POST` | `/admin/nexcore/fail-mode`   | Toggle simulated NexCore outage (demo only)         |

A background scheduler also polls Salesforce automatically every `SF_POLL_INTERVAL_MS` (default 30s) — the manual endpoint exists for demos.

## Environment variables

See [`.env.example`](./.env.example) for the full list with comments. The important ones:

- `USE_MOCK_SALESFORCE`, `USE_MOCK_NEXCORE` — both default `true`. Nothing else needs to change to run the whole system.
- `DATABASE_URL`, `REDIS_URL` — point at your Postgres/Redis (defaults match `docker-compose.yml`).
- `QUEUE_MAX_ATTEMPTS`, `QUEUE_BACKOFF_DELAY_MS` — retry/backoff tuning at the BullMQ queue level.
- `SF_*`, `NEXCORE_*` — real-system credentials, only read when the corresponding mock flag is `false`.

## Connecting real Salesforce later

1. Create a Salesforce Dev Org (free) and a Connected App with OAuth enabled.
2. Fill in `SF_INSTANCE_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_USERNAME`, `SF_PASSWORD` (append your security token, or relax IP restrictions), and `SF_API_VERSION` in `.env`.
3. Implement the `TODO`-marked OAuth token exchange and SOQL/REST calls in `server/src/clients/crm/RealSalesforceClient.ts` (the shape is already sketched — mostly uncommenting and pointing at your org).
4. Set `USE_MOCK_SALESFORCE=false` and restart the server + worker.
5. Consider swapping the polling-based ingestion in `pollService.ts` for **Change Data Capture** (Salesforce Platform Events) once you're past the prototype stage — the ingestion layer is isolated behind `CrmClient.fetchModifiedSince`, so this is a contained change.

## Connecting real NexCore later

1. Point `NEXCORE_API_URL` at your deployed NexCore instance and set `NEXCORE_API_KEY`.
2. Confirm/adjust the request and response shapes in `server/src/clients/erp/RealNexCoreClient.ts` to match NexCore's actual API.
3. Set `USE_MOCK_NEXCORE=false` and restart.
4. Point NexCore's webhook at `POST https://<your-syncbridge-host>/webhooks/nexcore`.

## Deploying

- **Backend** (`server/`) → Railway. Set the env vars above; `DATABASE_URL` can point at Supabase, `REDIS_URL` at Upstash or a Railway Redis addon.
- **Frontend** (`client/`) → Vercel. Set `VITE_API_BASE_URL` to your deployed backend URL.
- **Redis** → Upstash or Railway.
- Run `npm run migrate` (and `npm run seed`, once) against the production database before first boot.

## Notes on security (for the record)

`connections.credentials_ref` stores a **pointer** (e.g. a secrets-manager key name), never a raw token — see the comment in `server/src/db/migrations/001_init.sql`. In a real deployment, credentials would live in a secrets manager (AWS Secrets Manager, Vault, etc.) with envelope encryption at rest; wiring that up is out of scope for this portfolio build but the schema leaves the seam for it.
