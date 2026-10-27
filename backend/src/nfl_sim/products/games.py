"""games/{season}.json indexes and games/{id}.json play files, from nflverse only.

Index facts come from nflverse schedules (whitelisted columns, never odds). Play rows,
text, and home-side win chances come from nflverse PBP's published spread-aware WP
(models.past_play_wp; our model only on rows nflverse leaves empty, listed in
`wp_fallback_play_ids`). Swing flags come
from `build_wp_series`, which forces the final point to 1/0/0.5 by result. 4th-down
values come from the shared engine table (products.fourth_downs).

    python -m nfl_sim.products.games [--index-only]
"""
from __future__ import annotations

import json
import sys

import pandas as pd

from nfl_sim.models.past_play_wp import MODEL_INPUT_COLUMNS, NFLVERSE_WP_COLUMNS, past_play_home_wp
from nfl_sim.models.wp_series import build_wp_series
from nfl_sim.products import fourth_downs
from nfl_sim.products.game_compact import compact
from nfl_sim.play_names import ID_COLS, TEXT_COLUMNS, attach_names, load_players, load_roster
from nfl_sim.play_text import display_text, penalty_text
from nfl_sim.products.meta import provenance, write_json

SEASONS = fourth_downs.SEASONS
SWING_THRESHOLD = 0.08
# Facts only. Never copy spread / moneyline / total / odds columns.
FACT_COLUMNS = ("game_id", "season", "game_type", "week", "gameday", "home_team", "away_team",
                "home_score", "away_score", "overtime", "stadium", "home_coach", "away_coach")
PLAY_COLS = ["game_id", "play_id", "qtr", "quarter_seconds_remaining", "game_seconds_remaining", "posteam",
             "down", "ydstogo", "yardline_100", "desc", "play_type", "home_wp", "total_home_score",
             "total_away_score"]
PBP_COLS = list(dict.fromkeys([c for c in PLAY_COLS if c != "home_wp"] + TEXT_COLUMNS + ID_COLS
                               + NFLVERSE_WP_COLUMNS + MODEL_INPUT_COLUMNS))


def play_texts(recs: list[dict], players: dict, roster: dict) -> list[tuple[str, str | None]]:
    """(display_text, penalty_text) for raw pbp rows (same play_text logic as frontend/lib/plays)."""
    out = []
    for r in recs:
        r = attach_names({k: (None if isinstance(v, float) and v != v else v) for k, v in r.items()}, players, roster)
        out.append((display_text(r), penalty_text(r)))
    return out


def play_display_texts(recs: list[dict], players: dict, roster: dict) -> list[str]:
    return [d for d, _ in play_texts(recs, players, roster)]


def load_schedules(seasons=SEASONS) -> pd.DataFrame:
    import nflreadpy as nfl
    return nfl.load_schedules(list(seasons)).to_pandas()


def index_rows(schedules: pd.DataFrame, season: int) -> list[dict]:
    s = schedules[(schedules["season"] == season) & schedules["home_score"].notna()]
    out = []
    for r in s[list(FACT_COLUMNS)].sort_values(["week", "gameday", "game_id"]).to_dict("records"):
        out.append({
            "id": r["game_id"], "season": int(r["season"]), "week": int(r["week"]),
            "season_type": "REG" if r["game_type"] == "REG" else "POST", "game_type": r["game_type"],
            "date": str(r["gameday"]), "home": r["home_team"], "away": r["away_team"],
            "home_score": int(r["home_score"]), "away_score": int(r["away_score"]),
            "overtime": bool(int(r["overtime"])), "stadium": r["stadium"],
            "home_coach": r["home_coach"], "away_coach": r["away_coach"],
        })
    return out


def _clock(qsr) -> str | None:
    if qsr is None or qsr != qsr:
        return None
    s = int(qsr)
    return f"{s // 60}:{s % 60:02d}"


def _int(v):
    return None if v is None or v != v else int(v)


def _str(v):
    return v if isinstance(v, str) else None


def game_doc(game: dict, plays: pd.DataFrame, fourth: dict[float, dict], prov: dict,
             players: dict | None = None, roster: dict | None = None) -> dict:
    # nflverse row order is play order; play_id is NOT monotone (e.g. late timeouts).
    if "vegas_wp" in plays.columns:  # raw nflverse rows (tests may pass home_wp directly)
        wp = past_play_home_wp(plays)
        plays = plays.assign(home_wp=wp["home_wp"], wp_fallback=wp["wp_fallback"])
    plays = plays[plays["desc"].notna()].reset_index(drop=True)
    recs = plays.to_dict("records")
    series = build_wp_series(
        {"game_id": game["id"], "home_team_id": game["home"], "away_team_id": game["away"],
         "home_score": game["home_score"], "away_score": game["away_score"], "season_type": game["season_type"]},
        [{"play_id": str(int(r["play_id"])), "play_index": i, "quarter": int(r["qtr"]),
          "game_seconds_remaining": _int(r["game_seconds_remaining"]), "possession_team_id": _str(r["posteam"]),
          "description": r["desc"],
          "reference": {"home_wp": None if r["home_wp"] != r["home_wp"] else float(r["home_wp"])}}
         for i, r in enumerate(recs)],
        swing_threshold=SWING_THRESHOLD,
    )
    pts = {p.play_index: p for p in series.points}
    texts = play_texts(recs, players or {}, roster or {})
    rows = []
    for i, r in enumerate(recs):
        p = pts.get(i)
        rows.append({
            "play_id": int(r["play_id"]), "qtr": int(r["qtr"]), "clock": _clock(r["quarter_seconds_remaining"]),
            "posteam": _str(r["posteam"]), "down": _int(r["down"]), "ydstogo": _int(r["ydstogo"]),
            "yardline_100": _int(r["yardline_100"]), "text": r["desc"], "play_type": _str(r["play_type"]),
            "home_wp": None if p is None else round(p.home_wp_pre, 4),
            "home_wp_after": None if p is None else round(p.home_wp_post, 4),
            "swing": bool(p and p.is_swing),
            "display_text": texts[i][0], "penalty_text": texts[i][1],
            "home_score": _int(r["total_home_score"]), "away_score": _int(r["total_away_score"]),
            "fourth_down": fourth.get(float(r["play_id"])),
        })
    last = series.points[-1] if series.points else None
    return {
        "schema_version": "game.v1", "provenance": prov, "game": game,
        "wp_perspective": "home", "swing_threshold": SWING_THRESHOLD,
        "final_home_wp": None if last is None else last.home_wp_post,
        "swing_play_ids": [int(x) for x in series.swing_play_ids],
        "wp_fallback_play_ids": [int(r["play_id"]) for r in recs if r.get("wp_fallback")],
        "plays": rows,
    }


def fourth_lookup(fd: pd.DataFrame, game_id: str) -> dict[float, dict]:
    g = fd[fd["game_id"] == game_id]
    return {float(pid): {**json.loads(e), "actual": a}
            for pid, e, a in zip(g["play_id"], g["engine"], g["actual"])}


def build(index_only: bool = False, seasons=SEASONS) -> dict[int, int]:
    sched = load_schedules()
    fd = None if index_only else fourth_downs.load()
    players = None if index_only else load_players()
    counts = {}
    for season in seasons:
        prov = provenance([season], extra={"schedules": "nflverse schedules via nflreadpy (facts only, no odds)"})
        idx = index_rows(sched, season)
        write_json(f"games/{season}.json", {"schema_version": "games_index.v1", "provenance": prov,
                                            "season": season, "games": idx})
        counts[season] = len(idx)
        if index_only:
            continue
        by_id = {g["id"]: g for g in idx}
        pbp = fourth_downs.load_pbp(season, PBP_COLS)
        roster = load_roster(season)
        fds = fd[fd["season"] == season]
        for gid, plays in pbp.groupby("game_id"):
            if gid in by_id:
                write_json(f"games/{gid}.json", compact(game_doc(by_id[gid], plays, fourth_lookup(fds, gid), prov,
                                                                            players, roster)))
    return counts


if __name__ == "__main__":
    print(build(index_only="--index-only" in sys.argv))
