/**
 * What-if share cards (C4): built only from a real Daily play and its engine values.
 * Sharing is an x.com/intent/post link the fan opens and posts themselves; nothing posts from code.
 */
import type { QuizChoice } from "./quiz";
import { optionStates, type DailyItem } from "./daily";
import { gameText, scoreboardText } from "./dailyView";
import { playIdFromItemId, storyHref } from "./gameStory";

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
  /** "If DET had punted:" */
  ifText: string;
  /** What the coach really did, in words. */
  real: string;
  strip: string;
  game: string;
  gameId: string | null;
  playId: number | null;
  /** Links back to the exact situation. */
  checkerHref: string;
  storyHref: string | null;
};

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Alt = the model's best call if the coach didn't make it, else the best allowed alternative. */
export function whatIfFor(item: DailyItem): WhatIfCard | null {
  const actual = item.historical_action as QuizChoice | null;
  const v = item.reveal.values;
  if (!actual || v[actual] == null) return null;
  const allowed = optionStates(item).filter((o) => o.shown && !o.disabled && o.id !== actual && v[o.id] != null);
  if (!allowed.length) return null;
  const alt = allowed.reduce((a, b) => (v[b.id]! > v[a.id]! ? b : a)).id;
  const team = item.situation.posteam;
  const from = v[actual]!;
  const to = v[alt]!;
  const gameId = item.source.game_id ?? null;
  const playId = playIdFromItemId(item.id);
  return {
    id: item.id,
    team,
    actual,
    alt,
    from,
    to,
    headline: `If ${team} had ${HAD[alt]}: ${pct(from)} → ${pct(to)}`,
    ifText: `If ${team} had ${HAD[alt]}:`,
    real: `${team} ${DID[actual]}.`,
    strip: scoreboardText(item),
    game: gameText(item),
    gameId,
    playId,
    checkerHref: `/fourth-down/?play=${encodeURIComponent(item.id)}`,
    storyHref: storyHref(gameId, playId),
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

/** Absolute URL of the prebuilt 1200×675 PNG (app/card/[id]/card.png, made at build time). */
export function cardImageUrl(id: string): string {
  return `${SITE_URL}${cardPath(id)}card.png`;
}
