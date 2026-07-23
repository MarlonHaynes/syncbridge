# SyncBridge — Architecture Notes

This document explains the *why* behind SyncBridge's core design decisions: async processing, idempotency, retries, and dead-lettering. It's written to double as interview prep — each section states the problem, the decision, and the tradeoff I accepted.

## 1. Why nothing happens synchronously in the request path

**Problem:** A webhook handler or poll trigger that calls the target system inline (e.g. `POST /webhooks/nexcore` directly calling `salesforce.updateRecord()`) ties the caller's response time — and success/failure — to a third party's API. If Salesforce is slow or down, NexCore's webhook call times out or hangs. If it partially fails, there's no record of what happened.

**Decision:** Ingestion (`pollService.ts`, `webhookService.ts`) only ever does two things: validate + dedupe the incoming change, and write a `sync_events` row + enqueue a BullMQ job. The actual work — loading a mapping, transforming the payload, calling the target client — happens later, in the worker, decoupled from the request.

**Tradeoff:** Callers get an immediate `202 Accepted` with no confirmation the sync actually succeeded. That's the right tradeoff for a webhook (NexCore doesn't want to block on Salesforce's latency) — the dashboard, not the HTTP response, is the source of truth for outcome.

## 2. Idempotency: why a three-part key, not just a BullMQ job ID

**Problem:** Both ingestion paths can see the same change more than once — a poll can re-scan a record if the cursor logic has any overlap, and NexCore might redeliver a webhook after a timeout even though the first delivery succeeded. Creating a second Customer/Sales Order for the same Opportunity, or double-updating an Opportunity, is a real (and hard to debug) correctness bug in integration systems.

**Decision:** `idempotency_keys` has a unique constraint on `(source_system, source_external_id, change_hash)`. `change_hash` is a stable SHA-256 of the change payload (`utils/hash.ts`, with recursively sorted keys so field order never changes the hash). The insert uses `ON CONFLICT DO NOTHING RETURNING id` inside the same transaction as the `sync_events` insert — so the check-and-insert is atomic at the database level, not a check-then-insert race in application code.

Why hash the *payload*, not just dedupe on `source_external_id` alone? Because the same Opportunity legitimately changes more than once (e.g. Closed Won today, a status correction tomorrow) — those should each become their own sync event. Deduping on ID alone would silently drop real changes; deduping on ID + content hash only drops *identical* redeliveries.

**Tradeoff:** This only guards against duplicate *ingestion*. It does not make the two writes inside one sync event (`createCustomer` then `createSalesOrder`) atomic — see §5.

## 3. Retries: why exponential backoff at the queue level, not in application code

**Problem:** Transient failures (a rate limit, a momentary network blip, a downstream deploy) shouldn't dead-letter an event on the first failure — but hammering a struggling downstream system with immediate retries makes things worse, not better.

**Decision:** Retry policy is configured once, declaratively, on the BullMQ `Queue` (`defaultJobOptions: { attempts: QUEUE_MAX_ATTEMPTS, backoff: { type: 'exponential', delay: QUEUE_BACKOFF_DELAY_MS } }`). The worker's job processor doesn't know or care about retry counting — it just does the work and throws on failure. BullMQ owns the scheduling; `worker.ts`'s event listeners (`active`, `completed`, `failed`) only *reflect* BullMQ's state into `sync_events` (status, attempts, last_error). This keeps retry policy in one place and keeps the processor function simple and testable.

**Tradeoff:** Because BullMQ re-invokes the whole processor function on each retry (not just the failed sub-step), a job that fails partway through a multi-call sequence re-runs *everything* from the top on the next attempt. See §5 for why that matters here specifically.

## 4. Dead-lettering and replay: why reset instead of clone

**Problem:** After exhausting retries, silently dropping the event loses the failure entirely — an operator has no way to know something needs attention, let alone fix it.

**Decision:** On the final failed attempt (`job.attemptsMade >= maxAttempts` in the `failed` listener), the event's status flips to `dead` instead of `failed`, and `last_error` is preserved. It just sits there, visible in the dashboard, red badge, until someone acts. **Replay** (`POST /events/:id/replay`) resets `status → pending`, `attempts → 0`, `last_error → NULL` on the *same row* and re-enqueues it — it doesn't clone a new event. This keeps one event = one logical change, with its full history (`created_at` unchanged) intact, rather than accumulating a chain of near-duplicate rows every time someone retries.

**Tradeoff:** Replay history isn't tracked (you can't see "this was replayed 3 times before it stuck") — only the current attempt count and the latest error. For a real system I'd add a lightweight `replay_log` table if operators needed that audit trail; skipped here since the dashboard's job is triage, not audit.

## 5. The honest gap: multi-step writes aren't step-idempotent

This is the one thing I'd flag first in an interview about this project.

The Salesforce→NexCore direction does two writes per event: `createCustomer()` then `createSalesOrder()`. If `createCustomer` succeeds but `createSalesOrder` fails (network blip, validation error, whatever), BullMQ retries the *whole job* — which calls `createCustomer` again. NexCore now has two customer records for one Opportunity.

Why I left it this way for this build: the mock and the interface don't have a concept of "resume from step 2," and adding one honestly is more scaffolding than a portfolio-scale demo needs to prove the pattern. In a production system I'd close this gap one of two ways:

1. **Push idempotency into NexCore itself** — `createCustomer` takes a caller-supplied idempotency key (e.g. the Opportunity ID, which `external_ref` already carries) and NexCore enforces uniqueness on it server-side, making repeated calls safe.
2. **Checkpoint progress in `sync_events`** — persist the customer's `externalId` onto the row as soon as step 1 succeeds, and have the worker check for it before re-issuing `createCustomer` on retry.

Option 1 is the more standard pattern (it's how Stripe's `Idempotency-Key` header works) and is the one I'd reach for first, since NexCore is a system I control end-to-end here.

## 6. Field mapping as data, not code

**Problem:** Every time a client wants to sync a different field, hardcoded `if`/`switch` branches in the worker mean a deploy.

**Decision:** `mappings.field_map` is a flat JSON object of `{"Source.Path": "target.path"}`, applied generically by `applyMapping()` (dotted-path get/set, recursively building the nested target object). The worker fills in *linkage* fields that can't come from static mapping — `customer_external_id` on the Sales Order, for instance, only exists after `createCustomer()` returns — but every scalar field transformation is config.

**Tradeoff:** This buys ops-level flexibility (change a mapping via a DB update, no deploy) at the cost of type safety — a bad `field_map` entry (wrong path, typo) fails at runtime, not compile time. The upside: that runtime failure is exactly the kind of thing this system is built to surface — it shows up as a `failed`/`dead` sync event with a clear `last_error`, not a silent no-op.

## 7. Polling with a stored cursor vs. Change Data Capture

**Problem:** Salesforce doesn't push to us (in this build), so we have to ask. Naively re-querying "all Closed Won Opportunities" on every poll rescans everything and can't tell new changes from old ones.

**Decision:** `sync_cursors` stores a `last_synced_at` watermark per `(system, entity_type)`. Each poll asks `CrmClient.fetchModifiedSince(cursor)`, and advances the cursor to the max `LastModifiedDate` seen — across *all* modified records, not just the Closed Won ones, so a flurry of unrelated Opportunity edits doesn't cause the same non-qualifying records to be rescanned forever.

**Why filter to Closed Won in the ingestion layer, not the client:** `fetchModifiedSince` returns anything changed; `pollSalesforce()` decides what's sync-worthy. This keeps the "what deserves a sync event" business rule in one place instead of duplicated across a mock client and a real SOQL query — and it's exactly the seam where a future stage filter (e.g. "also sync Proposal-stage deals over $50k") would go.

**The upgrade path:** this is explicitly a placeholder for Salesforce **Change Data Capture** (Platform Events), which pushes changes instead of making us ask. Because ingestion only talks to `CrmClient.fetchModifiedSince`, swapping polling for a CDC subscriber later means adding a new ingestion entry point that calls the same `createSyncEventIfNew()` — the queue, worker, mapping, and idempotency layers don't change at all.

## 8. Why the mock/real split lives behind an interface + factory, not env-conditionals scattered around

**Problem:** "Just check `USE_MOCK_SALESFORCE` before every API call" works until it's checked in ten different places and someone forgets one.

**Decision:** `CrmClient`/`ErpClient` are the only types the rest of the app knows about. `clients/crm/index.ts` and `clients/erp/index.ts` are the single place the env flag is read, returning a singleton. Everything downstream — the worker, the poll service, the admin routes — depends on the interface, never the concrete mock/real class (except the demo-only `/admin` routes, which intentionally `instanceof`-check to reach mock-only methods like `seedNewClosedWonOpportunity()`).

**A real bug this caused, worth knowing about:** the server (Express API) and the worker (`queue/worker.ts`) run as **separate Node processes**. Each process gets its own singleton instance of `MockNexCoreClient` — so a naive in-memory `failureMode` boolean set via `POST /admin/nexcore/fail-mode` (handled by the server process) would never be seen by the worker process actually calling `createCustomer`/`createSalesOrder`. I hit this during testing: toggling the outage flag did nothing. The fix was moving that one piece of state into Redis (already-shared infrastructure) instead of process memory. It's a small thing, but it's the same class of bug that shows up in real multi-process/multi-instance deployments — any "current state" that isn't in the database or a shared cache is invisible to your other processes.

## 9. What I'd do differently at real scale

- **Idempotency key on outbound calls** (§5), to make retries safe for multi-step writes.
- **Partitioned/sharded queues per target system**, so a NexCore outage's retry storm can't starve Salesforce-bound jobs sharing the same worker pool.
- **Structured dead-letter alerting** (today it's just a red badge in the dashboard) — a real op would want a Slack/PagerDuty hook when `dead` count crosses a threshold.
- **Encryption-at-rest for `connections.credentials_ref`** — currently a placeholder string; production would resolve it through a secrets manager (Vault/AWS Secrets Manager) with envelope encryption, never storing the raw token in this database at all.
