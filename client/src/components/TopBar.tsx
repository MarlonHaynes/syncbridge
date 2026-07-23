import type { SyncEventListResponse } from "@syncbridge/shared";

interface Props {
  counts: SyncEventListResponse["counts"] | null;
  nexcoreFailureMode: boolean;
  polling: boolean;
  onRunPoll: () => void;
  onSeedOpportunity: () => void;
  onToggleFailureMode: () => void;
}

export function TopBar({ counts, nexcoreFailureMode, polling, onRunPoll, onSeedOpportunity, onToggleFailureMode }: Props) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">SB</div>
        <div>
          <h1>SyncBridge</h1>
          <div className="sub">Salesforce ⇄ NexCore integration middleware</div>
        </div>
      </div>

      <div className="topbar-controls">
        {counts && (
          <div className="counters">
            <span className="counter pending">
              <span className="dot" />
              {counts.pending + counts.processing} pending
            </span>
            <span className="counter failed">
              <span className="dot" />
              {counts.failed} failed
            </span>
            <span className="counter dead">
              <span className="dot" />
              {counts.dead} dead
            </span>
          </div>
        )}

        <button className="btn small" onClick={onSeedOpportunity} title="Append a new Closed Won Opportunity to the mock Salesforce org">
          + Seed SF Opportunity
        </button>

        <button
          className={`btn small danger-toggle ${nexcoreFailureMode ? "active" : ""}`}
          onClick={onToggleFailureMode}
          title="Toggle simulated NexCore outage to demo retries + dead-lettering"
        >
          {nexcoreFailureMode ? "NexCore Outage: ON" : "Simulate NexCore Outage"}
        </button>

        <button className="btn primary" onClick={onRunPoll} disabled={polling}>
          {polling ? "Polling..." : "Run Salesforce Poll"}
        </button>
      </div>
    </div>
  );
}
