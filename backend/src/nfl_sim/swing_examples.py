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
    "game_id", "play_id", "qtr", "time", "desc", "play_type", "posteam", "defteam",
    "posteam_timeouts_remaining", "defteam_timeouts_remaining", "home_team", "away_team",
    "home_wp", "home_wp_post", "total_home_score", "total_away_score", "qb_kneel", "qb_spike",
    "touchdown", "home_score", "away_score",
    "down", "ydstogo", "yardline_100", "posteam_score", "defteam_score", "yards_gained",
    "interception", "fumble_lost", "fourth_down_failed", "field_goal_result", "kick_distance",
    "return_yards", "incomplete_pass", "sack", "penalty", "extra_point_result", "two_point_conv_result",
    "passer_player_name", "receiver_player_name", "rusher_player_name", "interception_player_name",
    "kicker_player_name", "punter_player_name", "punt_returner_player_name", "kickoff_returner_player_name",
    "return_touchdown", "td_team",
    "fumbled_1_player_name", "fumble_recovery_1_player_name", "sack_player_name", "td_player_name",
    "touchback", "safety", "fumble", "fumble_recovery_1_team", "penalty_team", "penalty_type", "penalty_yards", "penalty_player_name",
]
from nfl_sim.play_names import NAME_ROLES  # noqa: E402,F401  (re-export)


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
    home_b, away_b = score_before(r)
    return {
        "game_id": r["game_id"], "play_id": str(r["play_id"]), "qtr": int(r["qtr"]),
        "clock": r["time"], "clock_seconds": clock_seconds(r["time"]), "description": r["desc"],
        "play_type": r["play_type"], "possession_team_id": r["posteam"],
        "defense_team_id": r.get("defteam"),
        "posteam_timeouts_remaining": _int(r.get("posteam_timeouts_remaining")),
        "defteam_timeouts_remaining": _int(r.get("defteam_timeouts_remaining")),
        "home_score_after": int(r["total_home_score"]), "away_score_after": int(r["total_away_score"]),
        "home_score_before": home_b, "away_score_before": away_b,
        "down": _int(r.get("down")), "distance": _int(r.get("ydstogo")), "yardline_100": _int(r.get("yardline_100")),
        "yards_gained": _int(r.get("yards_gained")),
        "return_td": is_return_td(r),
        "kick_return_td": is_kick_return_td(r),
        "fourth_down_failed": _int(r.get("down")) == 4 and bool(r.get("fourth_down_failed")),
        "event": event_tag(r), "display_text": display_text(r), "penalty_text": penalty_text(r), "raw_desc": r["desc"],
    }


from nfl_sim.play_text import display_text, event_tag, penalty_text  # noqa: E402


def _int(v: Any) -> int | None:
    return None if v is None else int(v)


def is_return_td(r: dict[str, Any]) -> bool:
    """Interception or fumble returned for a TD by the defense (not punt/kick returns)."""
    if not (r.get("interception") or r.get("fumble_lost")):
        return False
    td_team, pos = r.get("td_team"), r.get("posteam")
    return bool(r.get("return_touchdown")) or bool(td_team and pos and td_team != pos)


def is_kick_return_td(r: dict[str, Any]) -> bool:
    """Punt or kickoff returned for a TD (nflverse return_touchdown); turnovers stay in return_td."""
    return bool(r.get("return_touchdown")) and r.get("play_type") in ("punt", "kickoff") and not is_return_td(r)


def score_before(r: dict[str, Any]) -> tuple[int, int]:
    """Score before the snap: nflverse posteam_score/defteam_score; else the prior row's totals (_prev_*)."""
    if r.get("posteam") and r.get("posteam_score") is not None and r.get("defteam_score") is not None:
        ps, ds = int(r["posteam_score"]), int(r["defteam_score"])
        return (ps, ds) if r["posteam"] == r["home_team"] else (ds, ps)
    return int(r.get("_prev_home", 0)), int(r.get("_prev_away", 0))


def is_real_play(r: dict[str, Any]) -> bool:
    """Every real snap/kick incl. penalties (no_play); drops timeouts, quarter/game markers, etc."""
    if not r.get("play_type") or not r.get("time"):
        return False
    d = (r.get("desc") or "").lstrip()
    return not d.startswith("Timeout") and not d.startswith("END ") and "Two-Minute Warning" not in d


def all_plays(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_play(r) for r in rows if is_real_play(r)]


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
        if not is_real_play(r):
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


def _with_prev_scores(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out, h, a = [], 0, 0
    for r in rows:
        out.append({**r, "_prev_home": h, "_prev_away": a})
        if r.get("total_home_score") is not None:
            h, a = int(r["total_home_score"]), int(r["total_away_score"])
    return out


def build_play_lists(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Per-game full play lists (frontend/lib/plays/<game_id>.json), kept out of swingPlays.json for size."""
    return {gid: all_plays(_with_prev_scores([r for r in rows if r["game_id"] == gid])) for gid in GAME_IDS}


def build_export(rows: list[dict[str, Any]]) -> dict[str, Any]:
    games = {}
    for gid in GAME_IDS:
        g = _with_prev_scores([r for r in rows if r["game_id"] == gid])
        last = g[-1]
        games[gid] = {
            "game_id": gid, "home_team_id": last["home_team"], "away_team_id": last["away_team"],
            "home_score": int(last["home_score"]), "away_score": int(last["away_score"]),
            "first_home_wp": round(next(r["home_wp"] for r in g if r.get("home_wp") is not None), 4),
            # QA H7: pre-snap home_wp of the first real play (opening kickoff), straight from nflverse.
            "opening_home_wp": (o := round(next(r["home_wp"] for r in g if is_real_play(r) and r.get("home_wp") is not None), 4)),
            "opening_away_wp": round(1 - o, 4),
            "swings": top_swings(g), "overtime_plays": overtime_scoring_plays(g),
            "chart": chart_rows(g),
        }
    return {
        "source": "nflverse_pbp_2023", "wp_source": "nflverse home_wp (pre-snap) / home_wp_post",
        "swing_filter": "regulation run/pass/field_goal/punt; no kneels, spikes or non-plays",
        "top_n": TOP_N, "games": games,
    }
