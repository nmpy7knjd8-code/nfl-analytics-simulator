/**
 * Themed 4th-down packs (B6) and the theme schedule (B3). Data & Models owns these shapes.
 * Packs: /data/packs/<theme>.json, built by backend/scripts/build_theme_packs.py.
 * Rules: lib/themeRules.json. Schedule: lib/themeSchedule.json, extended by scripts/extend-theme-schedule.ts.
 */

export type ThemeId = "goal-line" | "playoffs" | "marathon";
export type PackChoice = "go" | "punt" | "fg";

/** Same fields as a daily item (lib/dailyPack.json, `DailyItem` in lib/daily.ts). */
export type ThemePackItem = {
  /** "<game_id>-<play_id>", stable across rebuilds; same id as the daily pack when the play is in both. */
  id: string;
  kind: string;
  source: { season: number; week: number; game_date: string; game_id: string; play_id?: number };
  situation: {
    posteam: string; defteam: string; home_team: string; away_team: string;
    posteam_score: number; defteam_score: number; qtr: number; quarter_seconds_remaining: number;
    yardline_100: number; down: number; distance: number;
    posteam_timeouts: number | null; defteam_timeouts: number | null;
  };
  historical_action: PackChoice | null;
  reveal: { recommendation: PackChoice | "inconclusive"; values: Partial<Record<PackChoice, number>> };
};

/** Marathon items add the drive: "<game_id>-d<nflverse fixed_drive>" and the 1-based snap number within it. */
export type MarathonPackItem = ThemePackItem & { driveId: string; playOrder: number };

export type ThemePack<T extends ThemePackItem = ThemePackItem> = {
  schema_version: "fourth_and_theme_pack.v1";
  theme: ThemeId;
  title: string;
  blurb: string;
  derived_from: string;
  source: string;
  items: T[];
};
export type GoalLinePack = ThemePack;
export type PlayoffsPack = ThemePack;
export type MarathonPack = ThemePack<MarathonPackItem>;

/** lib/themeRules.json: which weekday (ET) gets which themed set. */
export type ThemeRule = { theme: ThemeId; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 /* 0 = Sunday */ };
export type ThemeRules = { note: string; setSize: number; rules: ThemeRule[] };

/** lib/themeSchedule.json: append-only; only dates after the last published daily day are ever added. */
export type ThemeDay = { theme: ThemeId; ids: string[] };
export type ThemeSchedule = { note: string; days: Record<string, ThemeDay> };
