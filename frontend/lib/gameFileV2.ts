/**
 * game.v2 (compact, columnar) → game.v1 rows. Mirrors backend nfl_sim/products/game_compact.expand.
 * #57's GameFile/GamePlay types read the v1 shape, so call expandGameV2(json) after fetch/read.
 */
type Opt = "go" | "fg" | "punt";
const ORDER: Opt[] = ["go", "fg", "punt"];
const FG_SNAP_YARDS = 18;

export type GameFileV2 = {
  schema_version: "game.v2";
  provenance: Record<string, unknown>;
  game: Record<string, unknown> & { id: string; home: string; away: string };
  wp_perspective: "home";
  swing_threshold: number;
  final_home_wp: number | null;
  swing_play_ids: number[];
  /** Plays whose home_wp came from our model because nflverse had none (END GAME rows). */
  wp_fallback_play_ids?: number[];
  engine_version: string | null;
  fourth_cols: string[];
  cols: {
    play_id: number[]; qtr: number[]; sec: (number | null)[]; posteam: (string | null)[];
    down: (number | null)[]; ydstogo: (number | null)[]; yardline_100: (number | null)[];
    text: string[]; play_type: (string | null)[]; home_wp: (number | null)[];
    home_score: (number | null)[]; away_score: (number | null)[];
    /** fan-facing sentence (backend play_text.display_text); games-v3+, absent in games-v2 */
    display_text?: string[];
    /** penalty sentence(s) after a play; null on 'No play' rows (flag is in display_text) and flag-free rows */
    penalty_text?: (string | null)[];
  };
  /** row index → [recommendation, close_call 0/1, gap_pts, wp (offense), actual, is_home_offense 0/1] */
  fourth: Record<string, [Opt, number, number, Partial<Record<Opt, number>>, Opt | null, number]>;
};

const clock = (s: number | null) => (s == null ? null : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function expandGameV2(doc: GameFileV2) {
  const c = doc.cols;
  const n = c.play_id.length;
  const swings = new Set(doc.swing_play_ids);
  const plays = Array.from({ length: n }, (_, i) => {
    const f = doc.fourth[String(i)];
    const yl = c.yardline_100[i];
    return {
      play_id: c.play_id[i], qtr: c.qtr[i], clock: clock(c.sec[i]), posteam: c.posteam[i], down: c.down[i],
      ydstogo: c.ydstogo[i], yardline_100: yl, text: c.text[i], display_text: c.display_text?.[i] ?? c.text[i], penalty_text: c.penalty_text?.[i] ?? null, play_type: c.play_type[i],
      home_wp: c.home_wp[i], home_wp_after: i + 1 < n ? c.home_wp[i + 1] : doc.final_home_wp,
      swing: swings.has(c.play_id[i]), home_score: c.home_score[i], away_score: c.away_score[i],
      fourth_down: f
        ? {
            recommendation: f[0], close_call: !!f[1], gap_pts: f[2], wp: f[3], actual: f[4],
            home_wp: Object.fromEntries(Object.entries(f[3]).map(([k, v]) => [k, f[5] ? v : r3(1 - (v as number))])),
            options: ORDER.filter((o) => o in f[3]),
            kick_distance: yl == null ? null : yl + FG_SNAP_YARDS,
            engine_version: doc.engine_version,
          }
        : null,
    };
  });
  const { cols: _c, fourth: _f, fourth_cols: _fc, engine_version: _e, ...rest } = doc;
  return { ...rest, schema_version: "game.v1" as const, plays };
}

/** Clock stoppages and markers, not plays (same rows the #86 plays files leave out). */
const NON_PLAY = /^(GAME|END (QUARTER \d|GAME)|Two-Minute Warning|Timeout #\d)/i;

/** One row of the Game Story play-by-play list. */
export type FeedRow = {
  /** nflverse play_id (named `id`: the static HTML carries these props, and 'play_id' is dev text). */
  id: string;
  quarter: number;
  /** Seconds left in the quarter (OT: in the period). */
  clock_seconds: number | null;
  down: number | null;
  distance: number | null;
  text: string;
};

/** Live per-game file served by Pages (fetched from the games-v2 release at build). */
export function gameFileUrl(gameId: string, basePath = ""): string {
  return `${basePath}/data/games/${encodeURIComponent(gameId)}.json`;
}

/**
 * game.v2 → play-list rows, in game order. Drops non-plays (game start, quarter ends, timeouts,
 * two-minute warnings). The v2 file carries only nflverse's raw desc, so fan text comes from
 * `fanText` (display_text by play_id, from the export) when present; we never write play text.
 */
export function feedRowsFromGameV2(doc: GameFileV2, fanText: Map<string, string> = new Map()): FeedRow[] {
  const c = doc.cols;
  const rows: FeedRow[] = [];
  for (let i = 0; i < c.play_id.length; i++) {
    if (c.play_type[i] == null || NON_PLAY.test(c.text[i] ?? "")) continue;
    const id = String(c.play_id[i]);
    const text = fanText.get(id)?.trim() || c.text[i]?.trim();
    if (!text) continue;
    rows.push({ id, quarter: c.qtr[i], clock_seconds: c.sec[i], down: c.down[i], distance: c.ydstogo[i], text });
  }
  return rows;
}

/** Narrow an unknown JSON body to game.v2 (anything else is treated as a load error). */
export function isGameFileV2(x: unknown): x is GameFileV2 {
  const d = x as Partial<GameFileV2> | null;
  return !!d && d.schema_version === "game.v2" && !!d.cols && Array.isArray(d.cols.play_id);
}
