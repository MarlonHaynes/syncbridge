import type { SyncDirection } from "@syncbridge/shared";

export function DirectionLabel({ direction }: { direction: SyncDirection }) {
  const [from, to] = direction === "salesforce_to_nexcore" ? ["Salesforce", "NexCore"] : ["NexCore", "Salesforce"];
  return (
    <span className="direction">
      <span className="sys">{from}</span>
      <span aria-hidden>→</span>
      <span className="sys">{to}</span>
    </span>
  );
}
