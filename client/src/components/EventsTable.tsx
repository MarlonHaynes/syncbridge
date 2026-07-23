import type { SyncEvent } from "@syncbridge/shared";
import { StatusBadge } from "./StatusBadge";
import { DirectionLabel } from "./DirectionLabel";

interface Props {
  events: SyncEvent[];
  loading: boolean;
  onSelect: (event: SyncEvent) => void;
  onReplay: (event: SyncEvent) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function EventsTable({ events, loading, onSelect, onReplay }: Props) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Direction</th>
            <th>Entity</th>
            <th>Source ID</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr className="empty-row">
              <td colSpan={7}>{loading ? "Loading events..." : "No sync events yet. Run a Salesforce poll or send a NexCore webhook to get started."}</td>
            </tr>
          )}
          {events.map((event) => (
            <tr key={event.id} onClick={() => onSelect(event)}>
              <td>
                <DirectionLabel direction={event.direction} />
              </td>
              <td>
                <span className="entity-tag">{event.entity_type.replace("_", " ")}</span>
              </td>
              <td className="mono">{event.source_external_id}</td>
              <td>
                <StatusBadge status={event.status} />
              </td>
              <td className="attempts">
                {event.attempts} / {event.max_attempts}
              </td>
              <td className="updated-at">{formatTime(event.updated_at)}</td>
              <td>
                {(event.status === "failed" || event.status === "dead") && (
                  <button
                    className="btn small replay-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReplay(event);
                    }}
                  >
                    Replay
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
