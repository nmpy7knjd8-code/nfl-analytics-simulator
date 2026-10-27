// UI Critic 2236 P1-E / P2-H: per-row state on a quiz reveal, kept pure so it can be tested.
export type RevealTag = "Your pick" | "Best" | "About as good" | null;
export type RevealRowState = { rec: boolean; picked: boolean; close: boolean; tag: RevealTag };

export function revealRow(
  id: string,
  s: { inconclusive: boolean; result: string; recommendation: string; selected: string | null; nearTie: string[]; off: boolean },
): RevealRowState {
  const picked = s.selected === id;
  // P1-E: a Correct pick is always the "good" row, even on a close call (inconclusive).
  const rec = !s.off && ((!s.inconclusive && s.recommendation === id) || (s.result === "correct" && picked));
  const close = s.inconclusive && s.result !== "incorrect" && !s.off && !picked && s.nearTie.includes(id);
  let tag: RevealTag = null;
  if (picked) tag = "Your pick";
  else if (close) tag = s.result === "near_tie" ? "Best" : "About as good";
  else if (rec) tag = "Best";
  return { rec, picked, close, tag };
}
