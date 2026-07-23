import type { SyncEvent } from "@syncbridge/shared";
import { StatusBadge } from "./StatusBadge";
import { DirectionLabel } from "./DirectionLabel";

interface Props {
  event: SyncEvent;
  onClose: () => void;
  onReplay: (event: SyncEvent) => void;
}

export function EventDetailDrawer({ event, onClose, onReplay }: Props) {
  const replayable = event.status === "failed" || event.status === "dead";

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <h2>Sync Event</h2>
            <DirectionLabel direction={event.direction} />
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <h3>Overview</h3>
            <dl className="kv-grid">
              <dt>Status</dt>
              <dd>
                <StatusBadge status={event.status} />
              </dd>
              <dt>Entity type</dt>
              <dd>{event.entity_type}</dd>
              <dt>Source ID</dt>
              <dd className="mono">{event.source_external_id}</dd>
              <dt>Target ID</dt>
              <dd className="mono">{event.target_external_id ?? "—"}</dd>
              <dt>Attempts</dt>
              <dd>
                {event.attempts} / {event.max_attempts}
              </dd>
              <dt>Created</dt>
              <dd>{new Date(event.created_at).toLocaleString()}</dd>
              <dt>Updated</dt>
              <dd>{new Date(event.updated_at).toLocaleString()}</dd>
            </dl>
          </div>

          {event.last_error && (
            <div className="drawer-section">
              <h3>Last Error</h3>
              <div className="error-box">{event.last_error}</div>
            </div>
          )}

          <div className="drawer-section">
            <h3>Source Payload</h3>
            <pre className="payload">{JSON.stringify(event.payload, null, 2)}</pre>
          </div>

          {event.transformed_payload && (
            <div className="drawer-section">
              <h3>Transformed Payload (sent to target)</h3>
              <pre className="payload">{JSON.stringify(event.transformed_payload, null, 2)}</pre>
            </div>
          )}

          {replayable && (
            <div className="drawer-section">
              <button className="btn primary" onClick={() => onReplay(event)}>
                Replay Event
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
