import { optionStates, type DailyItem } from "./daily";

/** Optional play facts a pack item may carry later (nflverse roof: outdoors/open/closed/dome). */
export type LimitFacts = { roof?: string | null };
export type ModelLimit = { id: "weather" | "kicker" | "people"; text: string };

export const MODEL_KNOWS = ["Down and distance", "Field position", "Score", "Time left", "Timeouts"];
export const MODEL_DOESNT_KNOW = ["Who the kicker is", "Weather and wind", "Injuries and tired players", "Momentum"];

/** Limits that apply to this play. Always at least one ("people"). */
export function limitsFor(item: DailyItem, facts: LimitFacts = {}): ModelLimit[] {
  const out: ModelLimit[] = [];
  const indoors = facts.roof === "dome" || facts.roof === "closed";
  if (!indoors) out.push({ id: "weather", text: "Weather and wind. A strong wind or rain changes kicks and passes; the numbers assume a normal day." });
  if (optionStates(item).some((o) => o.id === "fg" && !o.disabled)) out.push({ id: "kicker", text: "Who the kicker is. The numbers use an average NFL kicker, not this team's." });
  out.push({ id: "people", text: "Injuries and tired players. The numbers don't know who is hurt or worn out." });
  return out;
}
