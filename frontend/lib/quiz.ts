/**
 * Offline fourth-down quiz helpers.
 * Credit uses baked scorer reveal (recommendation / inconclusive) — no WP math.
 */

import pack from "./quizPack.json";

export type QuizChoice = "go" | "fg" | "punt";
export type QuizPhase = "situation" | "confirm" | "reveal";
export type QuizResult = "correct" | "incorrect" | "near_tie";

export type QuizSituation = {
  posteam: string;
  defteam: string;
  home_team?: string | null;
  away_team?: string | null;
  posteam_score: number;
  defteam_score: number;
  score_differential: number;
  qtr: number;
  game_seconds_remaining: number;
  half_seconds_remaining?: number;
  /** Clock shown to fans: time left in the quarter (0:00–15:00). */
  quarter_seconds_remaining: number;
  yardline_100: number;
  down: number;
  distance: number;
  posteam_timeouts: number;
  defteam_timeouts: number;
};

export type QuizReveal = {
  recommendation: string;
  inconclusive: boolean;
  margin: number | null;
  values: Record<string, number>;
  layman_why: string;
  transition_mode?: string;
  empirics_mode?: string;
  /** Fan-language notes, safe to display. */
  assumptions?: string[];
  /** Not displayed: winning option's edge over the runner-up, in win-probability units. */
  edge_wp?: number | null;
  /** Not displayed: technical model assumptions. */
  model_notes?: string[];
  recommendation_changed_legacy_to_improved?: boolean;
};

export type QuizItem = {
  id: string;
  label: string;
  kind: string;
  source: {
    season?: number | null;
    game_id?: string | null;
    play_id?: number | null;
    week?: number | null;
    game_date?: string | null;
    note?: string;
    report?: string;
  };
  situation: QuizSituation;
  historical_action?: string | null;
  reveal: QuizReveal;
};

export type SessionStats = {
  answered: number;
  credit_total: number;
  accuracy: number;
  exact: number;
  near_tie: number;
  incorrect: number;
  streak: number;
  best_streak: number;
};

export const QUIZ_PACK = pack as {
  schema_version: string;
  offline: boolean;
  live_feed: boolean;
  items: QuizItem[];
};

export const QUIZ_ITEMS: QuizItem[] = QUIZ_PACK.items;

export const CHOICE_LABELS: Record<QuizChoice, string> = {
  go: "Go",
  fg: "Field Goal",
  punt: "Punt",
};

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Yard line caption from offense perspective (yardline_100 = yards to opponent EZ). */
export function yardLineCaption(yardline100: number, posteam: string): string {
  const yl = Math.max(1, Math.min(99, Math.round(yardline100)));
  if (yl > 50) {
    const own = 100 - yl;
    return `${posteam} ${own}`;
  }
  if (yl === 50) return "50";
  return `Opp ${yl}`;
}

/** Ball position 0–100 along field graphic (0 = own goal, 100 = opponent goal). */
export function ballProgress(yardline100: number): number {
  return Math.max(0, Math.min(100, 100 - yardline100));
}

export function scoreQuizChoice(
  choice: QuizChoice,
  reveal: QuizReveal,
): {
  result: QuizResult;
  credit: number;
  recommendation: string;
  inconclusive: boolean;
  values: Record<string, number>;
  layman_why: string;
  margin: number | null;
} {
  const inconclusive =
    Boolean(reveal.inconclusive) || reveal.recommendation === "inconclusive";
  if (inconclusive) {
    return {
      result: "near_tie",
      credit: 0.5,
      recommendation: reveal.recommendation,
      inconclusive: true,
      values: reveal.values,
      layman_why: reveal.layman_why,
      margin: reveal.margin,
    };
  }
  if (choice === reveal.recommendation) {
    return {
      result: "correct",
      credit: 1,
      recommendation: reveal.recommendation,
      inconclusive: false,
      values: reveal.values,
      layman_why: reveal.layman_why,
      margin: reveal.margin,
    };
  }
  return {
    result: "incorrect",
    credit: 0,
    recommendation: reveal.recommendation,
    inconclusive: false,
    values: reveal.values,
    layman_why: reveal.layman_why,
    margin: reveal.margin,
  };
}

export function emptySession(): SessionStats {
  return {
    answered: 0,
    credit_total: 0,
    accuracy: 0,
    exact: 0,
    near_tie: 0,
    incorrect: 0,
    streak: 0,
    best_streak: 0,
  };
}

export function updateSession(
  prev: SessionStats,
  scored: { result: QuizResult; credit: number },
): SessionStats {
  const answered = prev.answered + 1;
  const credit_total = prev.credit_total + scored.credit;
  const streak = scored.result === "correct" ? prev.streak + 1 : 0;
  return {
    answered,
    credit_total,
    accuracy: credit_total / answered,
    exact: prev.exact + (scored.result === "correct" ? 1 : 0),
    near_tie: prev.near_tie + (scored.result === "near_tie" ? 1 : 0),
    incorrect: prev.incorrect + (scored.result === "incorrect" ? 1 : 0),
    streak,
    best_streak: Math.max(prev.best_streak, streak),
  };
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
