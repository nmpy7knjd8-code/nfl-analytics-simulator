/**
 * EXAMPLE win-probability fixtures, shaped as the contract's WinProbabilitySeries.
 * Hand-made to illustrate the UI. NOT model output and NOT real nflverse values.
 * The contract's `source`/`truth_label` constants describe real nflverse data, so the
 * honest "example" label travels in ChartSeries.origin instead.
 */
import {
  DEFAULT_SWING_WP_THRESHOLD,
  REGULATION_SECONDS,
  isSwing,
  splitAtRegulation,
  type ChartSeries,
  type WinProbabilityPoint,
  type WinProbabilitySeries,
} from "./winProbability";

// [play_index, quarter, clock seconds left (quarter clock; OT clock in OT), possession,
//  description, home WP AFTER the play]. First row also needs a starting pre-snap value.
type Row = [number, number, number, string | null, string, number];

function build(
  game_id: string,
  home: string,
  away: string,
  scores: { home: number; away: number },
  startHomeWp: number,
  rows: Row[],
): ChartSeries {
  const points: WinProbabilityPoint[] = rows.map(([i, q, left, pos, desc, post], k) => {
    const pre = k === 0 ? startHomeWp : rows[k - 1][5];
    const elapsed = q > 4 ? REGULATION_SECONDS + (600 - left) : q * 900 - left;
    const delta = post - pre;
    return {
      play_id: String(i),
      play_index: i,
      quarter: q,
      is_overtime: q > 4,
      game_seconds_elapsed: elapsed,
      possession_team_id: pos,
      description: desc,
      home_wp_pre: pre,
      home_wp_post: post,
      delta_home_wp: delta,
      // Fixtures have no backend flag, so apply the fallback threshold.
      is_swing: isSwing({ delta_home_wp: delta }),
    };
  });
  const result = scores.home > scores.away ? "home_win" : scores.home < scores.away ? "away_win" : "tie";
  const series: WinProbabilitySeries = {
    game_id,
    home_team_id: home,
    away_team_id: away,
    home_score: scores.home,
    away_score: scores.away,
    result,
    perspective: "home",
    timing: "pre_snap",
    swing_threshold: DEFAULT_SWING_WP_THRESHOLD,
    source: "nflverse_reference_home_wp",
    truth_label: "historical",
    has_overtime: points.some((p) => p.is_overtime),
    points,
    swing_play_ids: points.filter((p) => p.is_swing).map((p) => p.play_id),
  };
  return { ...splitAtRegulation(series), origin: "example", note: "Example win chance — hand-made for the demo, not model output." };
}

export const WP_FIXTURES: Record<string, ChartSeries> = {
  // Detroit (away) won 21–20 at Kansas City.
  "2023_01_DET_KC": build("2023_01_DET_KC", "KC", "DET", { home: 20, away: 21 }, 0.6, [
    [1, 1, 900, "KC", "Opening kickoff.", 0.6],
    [2, 1, 500, "KC", "Chiefs field goal.", 0.66],
    [3, 2, 600, "DET", "Lions touchdown run.", 0.55],
    [4, 2, 120, "DET", "Fourth-and-1 — Detroit goes for it and converts.", 0.5],
    [5, 3, 600, "KC", "Mahomes touchdown pass.", 0.69],
    [6, 3, 200, "KC", "Interception returned for a touchdown by Detroit.", 0.42],
    [7, 4, 600, "KC", "Chiefs touchdown pass to retake the lead.", 0.6],
    [8, 4, 250, "DET", "Montgomery touchdown run puts Detroit ahead.", 0.22],
    [9, 4, 45, "KC", "Mahomes pass incomplete on fourth down. Detroit takes over.", 0.03],
    [10, 4, 30, "DET", "Lions kneel to run out the clock.", 0],
  ]),
  "2023_01_BUF_NYJ": build("2023_01_BUF_NYJ", "NYJ", "BUF", { home: 22, away: 16 }, 0.35, [
    [1, 1, 900, "BUF", "Opening kickoff.", 0.35],
    [2, 1, 200, "BUF", "Bills touchdown.", 0.28],
    [3, 2, 300, "NYJ", "Jets field goal.", 0.38],
    [4, 3, 500, "NYJ", "Fumble recovered by the Jets.", 0.47],
    [5, 4, 400, "NYJ", "Jets field goal ties the game.", 0.55],
    [6, 5, 452, "NYJ", "Xavier Gipson punt return touchdown in overtime. Jets win 22–16.", 1],
  ]),
  "2023_03_PHI_TB": build("2023_03_PHI_TB", "TB", "PHI", { home: 11, away: 25 }, 0.4, [
    [1, 1, 900, "PHI", "Opening kickoff.", 0.4],
    [2, 2, 400, "PHI", "Eagles field goal.", 0.3],
    [3, 3, 600, "PHI", "Eagles touchdown pass.", 0.18],
    [4, 4, 700, "PHI", "Eagles field goal.", 0.06],
    [5, 4, 120, "TB", "Buccaneers turnover on downs.", 0],
  ]),
};

export function fixtureWinProbability(gameId: string): ChartSeries | null {
  return WP_FIXTURES[gameId] ?? null;
}
