/**
 * Win-chance series for the game pages, built from real nflverse 2023 play-by-play
 * (public/data/games/{id}.json: nflverse home_wp / home_wp_after, real clock and play text).
 * Replaces the old hand-made wpFixtures.ts, whose swing plays never happened (QA2 H5, M9).
 */
import DET_KC from "../public/data/games/2023_01_DET_KC.json";
import BUF_NYJ from "../public/data/games/2023_01_BUF_NYJ.json";
import PHI_TB from "../public/data/games/2023_03_PHI_TB.json";
import {
  DEFAULT_SWING_WP_THRESHOLD,
  REGULATION_SECONDS,
  splitAtRegulation,
  type ChartSeries,
  type WinProbabilityPoint,
  type WinProbabilitySeries,
} from "./winProbability";

type GameFilePlay = {
  play_id: number;
  qtr: number;
  clock: string;
  posteam: string | null;
  text: string;
  play_type: string | null;
  home_wp: number;
  home_wp_after: number;
  swing: boolean;
};
type GameFile = {
  game: { id: string; home: string; away: string; home_score: number; away_score: number };
  swing_threshold?: number;
  plays: GameFilePlay[];
};

function secondsLeft(clock: string): number {
  const [m, s] = clock.split(":").map(Number);
  return m * 60 + s;
}

export function seriesFromGameFile(file: GameFile): ChartSeries {
  const g = file.game;
  // Only real snaps: drop nflverse's GAME / END QUARTER marker rows.
  const plays = file.plays.filter((p) => p.play_type != null);
  const points: WinProbabilityPoint[] = plays.map((p, k) => {
    const left = secondsLeft(p.clock);
    return {
      play_id: String(p.play_id),
      play_index: k + 1,
      quarter: p.qtr,
      is_overtime: p.qtr > 4,
      game_seconds_elapsed: p.qtr > 4 ? REGULATION_SECONDS + (600 - left) : p.qtr * 900 - left,
      possession_team_id: p.posteam,
      description: p.text,
      home_wp_pre: p.home_wp,
      home_wp_post: p.home_wp_after,
      delta_home_wp: p.home_wp_after - p.home_wp,
      is_swing: p.swing,
    };
  });
  const result = g.home_score > g.away_score ? "home_win" : g.home_score < g.away_score ? "away_win" : "tie";
  const series: WinProbabilitySeries = {
    game_id: g.id,
    home_team_id: g.home,
    away_team_id: g.away,
    home_score: g.home_score,
    away_score: g.away_score,
    result,
    perspective: "home",
    timing: "pre_snap",
    swing_threshold: file.swing_threshold ?? DEFAULT_SWING_WP_THRESHOLD,
    source: "nflverse_reference_home_wp",
    truth_label: "historical",
    has_overtime: points.some((p) => p.is_overtime),
    points,
    swing_play_ids: points.filter((p) => p.is_swing).map((p) => p.play_id),
  };
  return { ...splitAtRegulation(series), origin: "live", note: "Win chance from nflverse's model, real 2023 play-by-play." };
}

export const WP_SERIES: Record<string, ChartSeries> = Object.fromEntries(
  [DET_KC, BUF_NYJ, PHI_TB].map((f) => [f.game.id, seriesFromGameFile(f as GameFile)]),
);

export function gameWinProbability(gameId: string): ChartSeries | null {
  return WP_SERIES[gameId] ?? null;
}
