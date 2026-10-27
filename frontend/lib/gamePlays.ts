/**
 * Full play lists for the Game Story pages: frontend/lib/plays/<game_id>.json (#86), real nflverse rows.
 * Fan text is the export's display_text, falling back to raw_desc. We never write our own play text.
 */
import BUF_NYJ from "./plays/2023_01_BUF_NYJ.json";
import DET_KC from "./plays/2023_01_DET_KC.json";
import PHI_TB from "./plays/2023_03_PHI_TB.json";
import type { CanonicalPlay, PlayType } from "../contracts";
import type { GamePlayList, SwingPlay } from "./wpFixtures";

export const GAME_PLAY_LISTS: Record<string, GamePlayList> = Object.fromEntries(
  ([BUF_NYJ, DET_KC, PHI_TB] as unknown as GamePlayList[]).map((g) => [g.game_id, g]),
);

/** display_text, else raw_desc; null when both fields are absent (then the page says "coming soon"). */
export function playText(p: Pick<SwingPlay, "display_text" | "raw_desc">): string | null {
  return p.display_text?.trim() || p.raw_desc?.trim() || null;
}

const PLAY_TYPES: Record<string, PlayType> = {
  pass: "pass", run: "rush", punt: "punt", field_goal: "field_goal", kickoff: "kickoff",
  extra_point: "extra_point", no_play: "no_play",
};

/** nflverse quarter clock -> seconds left in the half (OT: seconds left in OT). */
function halfSeconds(qtr: number, clock: number): number {
  return qtr === 1 || qtr === 3 ? clock + 900 : clock;
}

/** Rows the page renders: one per plays-file row that has fan text, in game order. */
export function gamePlays(gameId: string): CanonicalPlay[] | null {
  const list = GAME_PLAY_LISTS[gameId];
  if (!list) return null;
  return list.plays.flatMap((p, i) => {
    const text = playText(p);
    if (!text) return [];
    return [{
      play_id: p.play_id,
      game_id: gameId,
      play_index: i + 1,
      quarter: p.qtr,
      half_seconds_remaining: halfSeconds(p.qtr, p.clock_seconds),
      down: p.down,
      distance: p.distance,
      yardline_100: p.yardline_100,
      possession_team_id: p.possession_team_id,
      play_type: PLAY_TYPES[p.play_type] ?? "other",
      description: text,
    }];
  });
}
