import { useCallback, useEffect, useRef, useState } from "react";
import type { SyncDirection, SyncEvent, SyncEventListResponse, SyncStatus, EntityType } from "@syncbridge/shared";
import { TopBar } from "./components/TopBar";
import { EventsTable } from "./components/EventsTable";
import { EventDetailDrawer } from "./components/EventDetailDrawer";
import {
  fetchAdminState,
  fetchEvents,
  replayEvent,
  runSalesforcePoll,
  seedNewOpportunity,
  setNexCoreFailureMode,
} from "./api";

const REFRESH_INTERVAL_MS = 4000;

export default function App() {
  const [listResponse, setListResponse] = useState<SyncEventListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SyncStatus | "">("");
  const [directionFilter, setDirectionFilter] = useState<SyncDirection | "">("");
  const [entityFilter, setEntityFilter] = useState<EntityType | "">("");
  const [selected, setSelected] = useState<SyncEvent | null>(null);
  const [polling, setPolling] = useState(false);
  const [nexcoreFailureMode, setNexcoreFailureModeState] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetchEvents({
        status: statusFilter || undefined,
        direction: directionFilter || undefined,
        entityType: entityFilter || undefined,
        pageSize: 50,
      });
      setListResponse(res);
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, directionFilter, entityFilter]);

  const loadAdminState = useCallback(async () => {
    try {
      const state = await fetchAdminState();
      setNexcoreFailureModeState(state.nexcoreFailureMode);
    } catch (err) {
      console.error("Failed to load admin state", err);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadAdminState();
  }, [loadEvents, loadAdminState]);

  useEffect(() => {
    const interval = setInterval(loadEvents, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadEvents]);

  useEffect(() => {
    if (selected) {
      const updated = listResponse?.data.find((e) => e.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [listResponse, selected]);

  const handleRunPoll = async () => {
    setPolling(true);
    try {
      const result = await runSalesforcePoll();
      showToast(`Poll complete: ${result.created} new event(s), ${result.eligible} Closed Won found, ${result.duplicates} duplicate(s) skipped.`);
      await loadEvents();
    } catch (err) {
      showToast(`Poll failed: ${(err as Error).message}`);
    } finally {
      setPolling(false);
    }
  };

  const handleSeedOpportunity = async () => {
    try {
      await seedNewOpportunity();
      showToast("New Closed Won Opportunity seeded into mock Salesforce. Run a poll to sync it.");
    } catch (err) {
      showToast(`Seed failed: ${(err as Error).message}`);
    }
  };

  const handleToggleFailureMode = async () => {
    try {
      const result = await setNexCoreFailureMode(!nexcoreFailureMode);
      setNexcoreFailureModeState(result.nexcoreFailureMode);
      showToast(result.nexcoreFailureMode ? "NexCore outage simulated - new writes will fail and retry." : "NexCore outage cleared - replay failed/dead events to recover.");
    } catch (err) {
      showToast(`Toggle failed: ${(err as Error).message}`);
    }
  };

  const handleReplay = async (event: SyncEvent) => {
    try {
      await replayEvent(event.id);
      showToast(`Event ${event.id.slice(0, 8)} re-enqueued.`);
      await loadEvents();
    } catch (err) {
      showToast(`Replay failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="app">
      <TopBar
        counts={listResponse?.counts ?? null}
        nexcoreFailureMode={nexcoreFailureMode}
        polling={polling}
        onRunPoll={handleRunPoll}
        onSeedOpportunity={handleSeedOpportunity}
        onToggleFailureMode={handleToggleFailureMode}
      />

      <div className="filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SyncStatus | "")}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="dead">Dead</option>
        </select>

        <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as SyncDirection | "")}>
          <option value="">All directions</option>
          <option value="salesforce_to_nexcore">Salesforce → NexCore</option>
          <option value="nexcore_to_salesforce">NexCore → Salesforce</option>
        </select>

        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value as EntityType | "")}>
          <option value="">All entities</option>
          <option value="opportunity">Opportunity</option>
          <option value="sales_order">Sales Order</option>
        </select>

        <div className="autorefresh">
          <span className="pulse" />
          Auto-refreshing every {REFRESH_INTERVAL_MS / 1000}s
        </div>
      </div>

      <EventsTable events={listResponse?.data ?? []} loading={loading} onSelect={setSelected} onReplay={handleReplay} />

      {selected && <EventDetailDrawer event={selected} onClose={() => setSelected(null)} onReplay={handleReplay} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
