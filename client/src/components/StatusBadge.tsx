import type { SyncStatus } from "@syncbridge/shared";

const LABELS: Record<SyncStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  success: "Success",
  failed: "Failed",
  dead: "Dead",
};

export function StatusBadge({ status }: { status: SyncStatus }) {
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {LABELS[status]}
    </span>
  );
}
