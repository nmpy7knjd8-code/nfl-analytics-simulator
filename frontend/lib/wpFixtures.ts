/**
 * EXAMPLE win-probability fixtures for Game Explorer charts.
 * Hand-made to illustrate the UI. NOT model output and NOT real nflverse values.
 * Swap for the published frontend/contracts WP shape once Phase 0 lands.
 */
import type { WinProbabilityPoint, WinProbabilitySeries } from "./winProbability";

type Row = [number, number, number, number, string | null, string, number?];
// [play_index, quarter, game_seconds_remaining, home_wp AFTER the play, possession, description, ot_seconds?]
// Rows are written "after the play" for readability; build() converts them to the
// pre-snap convention: each play's point holds the previous row's after-value. The last
// row is the final state (no play).

function build(game_id: string, home: string, away: string, rows: Row[]): WinProbabilitySeries {
  const points: WinProbabilityPoint[] = rows.map(([i, q, s, wp, pos, desc, ot], k) => ({
    play_id: String(i),
    play_index: i,
    quarter: q,
    game_seconds_remaining: s,
    ot_seconds_remaining: ot ?? null,
    home_wp: k === 0 || k === rows.length - 1 ? wp : rows[k - 1][3],
    possession_team_id: pos,
    description: desc,
  }));
  return {
    game_id,
    home_team_id: home,
    away_team_id: away,
    points,
    source: "example",
    source_note: "Example win chance — hand-made for the demo, not model output.",
  };
}

export const WP_FIXTURES: Record<string, WinProbabilitySeries> = {
  "2023_01_DET_KC": build("2023_01_DET_KC", "KC", "DET", [
    [1, 1, 3600, 0.6, "KC", "Opening kickoff."],
    [2, 1, 3200, 0.66, "KC", "Chiefs field goal."],
    [3, 2, 2400, 0.55, "DET", "Lions touchdown run."],
    [4, 2, 1920, 0.5, "DET", "Fourth-and-1 — Detroit goes for it and converts."],
    [5, 3, 1500, 0.69, "KC", "Mahomes touchdown pass."],
    [6, 3, 1100, 0.42, "DET", "Interception returned for a touchdown by Detroit."],
    [7, 4, 600, 0.6, "KC", "Chiefs touchdown pass to retake the lead."],
    [8, 4, 300, 0.48, "DET", "Lions field goal."],
    [9, 4, 45, 0.85, "KC", "Mahomes scramble picks up a first down."],
    [10, 4, 30, 1.0, "KC", "Chiefs kneel to run out the clock."],
    [11, 4, 0, 1.0, null, "Final — Chiefs 21, Lions 20 (example result)."],
  ]),
  "2023_02_BUF_NYJ": build("2023_02_BUF_NYJ", "NYJ", "BUF", [
    [1, 1, 3600, 0.35, "BUF", "Opening kickoff."],
    [2, 1, 2900, 0.28, "BUF", "Bills touchdown."],
    [3, 2, 2100, 0.38, "NYJ", "Jets field goal."],
    [4, 3, 1400, 0.47, "NYJ", "Fumble recovered by the Jets."],
    [5, 4, 400, 0.3, "BUF", "Bills field goal."],
    [6, 4, 0, 0.55, null, "End of regulation — tied."],
    [7, 5, 0, 1.0, "NYJ", "Punt return touchdown in overtime.", 452],
    [8, 5, 0, 1.0, null, "Final — Jets win in overtime (example result).", 452],
  ]),
  "2023_03_PHI_TB": build("2023_03_PHI_TB", "TB", "PHI", [
    [1, 1, 3600, 0.4, "PHI", "Opening kickoff."],
    [2, 2, 2200, 0.3, "PHI", "Eagles field goal."],
    [3, 3, 1500, 0.18, "PHI", "Eagles touchdown pass."],
    [4, 4, 700, 0.06, "PHI", "Eagles field goal."],
    [5, 4, 120, 0.02, "TB", "Buccaneers turnover on downs."],
    [6, 4, 0, 0.0, null, "Final (example result)."],
  ]),
};

export function fixtureWinProbability(gameId: string): WinProbabilitySeries | null {
  return WP_FIXTURES[gameId] ?? null;
}
