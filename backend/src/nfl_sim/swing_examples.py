"""Shared swing filter + real swing-play export for the example game pages.

Swing filter (house rule): regulation (qtr 1-4) runs, passes, field goals and punts only;
kneels, spikes, no-plays, penalties-only, kickoffs, timeouts and other non-play rows are skipped.
Overtime plays never get a win-chance swing; they are exported separately without WP.
"""
from __future__ import annotations

from typing import Any

GAME_IDS = ("2023_01_BUF_NYJ", "2023_01_DET_KC", "2023_03_PHI_TB")
SWING_PLAY_TYPES = frozenset({"run", "pass", "field_goal", "punt"})
TOP_N = 5
FIXTURE_COLUMNS = [
    "game_id", "play_id", "qtr", "time", "desc", "play_type", "posteam", "home_team", "away_team",
    "home_wp", "home_wp_post", "total_home_score", "total_away_score", "qb_kneel", "qb_spike",
    "touchdown", "home_score", "away_score",
]


def is_swing_candidate(r: dict[str, Any]) -> bool:
    return (
        r.get("qtr") is not None and 1 <= int(r["qtr"]) <= 4
        and r.get("play_type") in SWING_PLAY_TYPES
        and not r.get("qb_kneel") and not r.get("qb_spike")
        and r.get("home_wp") is not None and r.get("home_wp_post") is not None
    )


def clock_seconds(clock: str) -> int:
    m, s = clock.split(":")
    return int(m) * 60 + int(s)


def _play(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "game_id": r["game_id"], "play_id": str(r["play_id"]), "qtr": int(r["qtr"]),
        "clock": r["time"], "clock_seconds": clock_seconds(r["time"]), "description": r["desc"],
        "play_type": r["play_type"], "possession_team_id": r["posteam"],
        "home_score_after": int(r["total_home_score"]), "away_score_after": int(r["total_away_score"]),
    }


def top_swings(rows: list[dict[str, Any]], n: int = TOP_N) -> list[dict[str, Any]]:
    cands = [r for r in rows if is_swing_candidate(r)]
    ranked = sorted(cands, key=lambda r: -abs(r["home_wp_post"] - r["home_wp"]))[:n]
    ranked.sort(key=lambda r: (int(r["qtr"]), -clock_seconds(r["time"]), float(r["play_id"])))
    out = []
    for r in ranked:
        p = _play(r)
        p.update(home_wp_pre=round(r["home_wp"], 4), home_wp_post=round(r["home_wp_post"], 4),
                 delta_home_wp=round(r["home_wp_post"] - r["home_wp"], 4))
        out.append(p)
    return out


def overtime_scoring_plays(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_play(r) for r in rows
            if r.get("qtr") == 5 and r.get("play_type") in SWING_PLAY_TYPES | {"kickoff", "extra_point"}
            and (r.get("touchdown") or r.get("play_type") == "field_goal")]


def chart_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every regulation play row with real WP (the full win-chance line).

    nflverse leaves home_wp_post empty on some rows (e.g. kneels); those use the next row's
    pre-snap home_wp, which is what nflverse's own post value means.
    """
    out = []
    for i, r in enumerate(rows):
        if r.get("qtr") is None or int(r["qtr"]) > 4 or r.get("home_wp") is None:
            continue
        if not r.get("play_type") or not r.get("time"):
            continue
        post = r.get("home_wp_post")
        if post is None:
            post = next((n["home_wp"] for n in rows[i + 1:] if n.get("home_wp") is not None), None)
        if post is None:
            continue
        p = _play(r)
        p.update(home_wp_pre=round(r["home_wp"], 4), home_wp_post=round(post, 4),
                 swing_eligible=is_swing_candidate(r))
        out.append(p)
    return out


def build_export(rows: list[dict[str, Any]]) -> dict[str, Any]:
    games = {}
    for gid in GAME_IDS:
        g = [r for r in rows if r["game_id"] == gid]
        last = g[-1]
        games[gid] = {
            "game_id": gid, "home_team_id": last["home_team"], "away_team_id": last["away_team"],
            "home_score": int(last["home_score"]), "away_score": int(last["away_score"]),
            "first_home_wp": round(next(r["home_wp"] for r in g if r.get("home_wp") is not None), 4),
            "swings": top_swings(g), "overtime_plays": overtime_scoring_plays(g),
            "chart": chart_rows(g),
        }
    return {
        "source": "nflverse_pbp_2023", "wp_source": "nflverse home_wp (pre-snap) / home_wp_post",
        "swing_filter": "regulation run/pass/field_goal/punt; no kneels, spikes or non-plays",
        "top_n": TOP_N, "games": games,
    }
