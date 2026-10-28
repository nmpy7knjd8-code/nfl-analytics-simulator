/**
 * What-if cards (C4, ported from closed PR #59): built only from a real Daily play and its engine values.
 * Engine-derived: the /card/ pages render only when CHECKER_ENABLED is true.
 * Sharing is an x.com/intent/post link the fan opens and posts themselves; nothing posts from code.
 */
import type { QuizChoice } from "./quiz";
import { optionStates, type DailyItem } from "./daily";
import { gameText, scoreboardText } from "./dailyView";

export const SITE_URL = "https://nmpy7knjd8-code.github.io/nfl-analytics-simulator";
export const CARD_SOURCE = "Data: nflverse";

const HAD: Record<QuizChoice, string> = { go: "gone for it", fg: "kicked the field goal", punt: "punted" };
const DID: Record<QuizChoice, string> = { go: "went for it", fg: "kicked the field goal", punt: "punted" };

export type WhatIfCard = {
  id: string;
  team: string;
  actual: QuizChoice;
  alt: QuizChoice;
  /** Possession team's win chance with the real call and with the other one (0–1). */
  from: number;
  to: number;
  headline: string;
  ifText: string;
  real: string;
  strip: string;
  game: string;
};

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Alt = the best allowed call the coach didn't make. Null for overtime (no win chance in OT) or missing values. */
export function whatIfFor(item: DailyItem): WhatIfCard | null {
  if (item.situation.qtr > 4) return null;
  const actual = item.historical_action as QuizChoice | null | undefined;
  const v = item.reveal.values;
  if (!actual || v[actual] == null) return null;
  const allowed = optionStates(item).filter((o) => o.shown && !o.disabled && o.id !== actual && v[o.id] != null);
  if (!allowed.length) return null;
  const alt = allowed.reduce((a, b) => (v[b.id]! > v[a.id]! ? b : a)).id;
  const team = item.situation.posteam;
  const from = v[actual]!;
  const to = v[alt]!;
  return {
    id: item.id, team, actual, alt, from, to,
    headline: `If ${team} had ${HAD[alt]}: ${pct(from)} → ${pct(to)}`,
    ifText: `If ${team} had ${HAD[alt]}:`,
    real: `${team} ${DID[actual]}.`,
    strip: scoreboardText(item),
    game: gameText(item),
  };
}

export function cardPath(id: string): string {
  return `/card/${encodeURIComponent(id)}/`;
}

/** X web intent: opens x.com with the text prefilled; the fan decides whether to post. */
export function xIntentUrl(card: WhatIfCard): string {
  const text = `${card.headline} (${card.team} win chance). ${card.strip}. ${CARD_SOURCE}`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL + cardPath(card.id))}`;
}
