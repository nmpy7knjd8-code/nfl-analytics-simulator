type TruthKind = "historical" | "predicted" | "simulated";

const LABELS: Record<TruthKind, string> = {
  historical: "Historical",
  predicted: "Predicted",
  simulated: "Simulated",
};

export function TruthChip({ kind }: { kind: TruthKind }) {
  return <span className={`truth-chip truth-chip--${kind}`}>{LABELS[kind]}</span>;
}
