/** Penalty sentence(s) after the play text (#106 penalty_text). Null/empty renders nothing. */
export function PenaltyText({ text }: { text?: string | null }) {
  const t = text?.trim();
  return t ? <span className="play-penalty">{t}</span> : null;
}
