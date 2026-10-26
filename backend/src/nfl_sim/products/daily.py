"""daily/pack.json: "Today's 5", 365 ET dates × 5 real nflverse 4th downs (2019–2025).

Every item is a real play row from the shared engine table (no synthetic boards);
its values are the engine's, so the quiz and the checker agree. Each play appears
once in the 365-day cycle (no repeat within 365 days). Answers are balanced across
Go / Kick / Punt by engine recommendation, and close calls are capped at 15%. Crowd
split is static (null) until Phase 4.

    python -m nfl_sim.products.daily
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta

import pandas as pd

from nfl_sim.products import fourth_downs
from nfl_sim.products.engine import ENGINE_VERSION
from nfl_sim.products.meta import provenance, write_json

DAYS = 365
PER_DAY = 5
START_DATE = date(2026, 11, 1)  # day 0 of the cycle, US Eastern calendar date
TIMEZONE = "America/New_York"
SEED = 20261101
CLOSE_CALL_CAP = 0.15
WP_BAND = (0.03, 0.97)  # skip decided games
OPTIONS = ("go", "fg", "punt")
_UNUSED_FIELDS = ("game_id", "play_id", "season", "season_type", "week", "game_date", "home_team", "away_team",
               "posteam", "defteam", "qtr", "quarter_seconds_remaining", "down", "ydstogo", "yardline_100",
               "posteam_score", "defteam_score", "score_differential", "posteam_timeouts_remaining",
               "defteam_timeouts_remaining", "desc", "actual")


def _clock(s: int) -> str:
    return f"{s // 60}:{s % 60:02d}"


TRAINING_SEASONS = (2019, 2020, 2021)  # engine empirics fit; WP model training per #37


def select(table: pd.DataFrame, n: int = DAYS * PER_DAY, seed: int = SEED) -> pd.DataFrame:
    """Balanced Go/Kick/Punt; ≤15% close calls; out-of-training seasons first, 2019–21 backfill."""
    t = table.copy()
    eng = t["engine"].map(json.loads)
    t["rec"] = eng.map(lambda e: e["recommendation"])
    t["close"] = eng.map(lambda e: e["close_call"])
    t = t[t["wp"].between(*WP_BAND)]
    per = -(-n // len(OPTIONS))
    n_close = int(per * CLOSE_CALL_CAP)
    picks = []
    for k, o in enumerate(OPTIONS):
        for close, want in ((False, per - n_close), (True, n_close)):
            pool = t[(t["rec"] == o) & (t["close"] == close)]
            fresh = pool[~pool["season"].isin(TRAINING_SEASONS)]
            take = fresh.sample(min(want, len(fresh)), random_state=seed + k)
            if len(take) < want:
                old = pool[pool["season"].isin(TRAINING_SEASONS)]
                take = pd.concat([take, old.sample(want - len(take), random_state=seed + 10 + k)])
            picks.append(take)
    return pd.concat(picks)


def _i(v):
    return None if v is None or v != v else int(v)


def item(r: dict, day: int, slot: int) -> dict:
    e = json.loads(r["engine"])
    home = bool(r["is_home_possession"])
    return {
        "id": f"{r['game_id']}#{int(r['play_id'])}",
        "kind": "historical",
        "date": (START_DATE + timedelta(days=day)).isoformat(), "day": day, "slot": slot,
        "source": {"season": int(r["season"]), "week": int(r["week"]), "game_date": r["game_date"],
                   "game_id": r["game_id"], "play_id": int(r["play_id"]), "season_type": r["season_type"],
                   "in_engine_training": int(r["season"]) in TRAINING_SEASONS},
        "situation": {
            "posteam": r["posteam"], "defteam": r["defteam"], "home_team": r["home_team"], "away_team": r["away_team"],
            "posteam_score": _i(r["posteam_score"]), "defteam_score": _i(r["defteam_score"]),
            "score_differential": _i(r["score_differential"]), "qtr": _i(r["qtr"]),
            "quarter_seconds_remaining": _i(r["quarter_seconds_remaining"]),
            "game_seconds_remaining": _i(r["game_seconds_remaining"]),
            "half_seconds_remaining": _i(r["half_seconds_remaining"]),
            "clock": _clock(int(r["quarter_seconds_remaining"])),
            "yardline_100": _i(r["yardline_100"]), "down": 4, "distance": _i(r["ydstogo"]),
            "posteam_timeouts": _i(r["posteam_timeouts_remaining"]),
            "defteam_timeouts": _i(r["defteam_timeouts_remaining"]), "is_home_possession": home,
        },
        "historical_action": r["actual"],
        "reveal": {
            "recommendation": e["recommendation"], "close_call": e["close_call"], "gap_pts": e["gap_pts"],
            "values": e["wp"],            # offense-side win chance after each option
            "home_values": e["home_wp"],  # same, home-team side
            "kick_distance": e["kick_distance"], "options": e["options"], "engine_version": e["engine_version"],
        },
        "pre_snap": {"wp": round(float(r["wp"]), 4), "home_wp": round(float(r["home_wp"]), 4)},  # nflverse
        "what_happened": {"desc": r["desc"], "yards_gained": _i(r["yards_gained"]), "result": r["result"]},
        "crowd_split": None,
    }


def schedule(picked: pd.DataFrame, seed: int = SEED) -> list[dict]:
    """Interleave Go/Kick/Punt so every day mixes answers; then 5 per date."""
    rng = random.Random(seed)
    queues = {o: picked[picked["rec"] == o].sample(frac=1, random_state=seed).to_dict("records") for o in OPTIONS}
    order = []
    while len(order) < DAYS * PER_DAY and any(queues.values()):
        cycle = list(OPTIONS)
        rng.shuffle(cycle)
        order += [queues[o].pop() for o in cycle if queues[o]]
    return [item(r, *divmod(i, PER_DAY)) for i, r in enumerate(order[: DAYS * PER_DAY])]


SELECTION = ("Real nflverse 4th downs (REG+POST, quarters 1–4, offense pre-snap WP 3–97%) where the team "
             "ran a play, kicked, or punted. Balanced by engine recommendation (1/3 Go, Kick, Punt), close "
             "calls (<2 pts) capped at 15%. Drawn from 2022–2025 first (outside the engine's 2019–21 "
             "empirics fit); 2019–21 only as backfill, flagged source.in_engine_training. Seeded, deterministic.")


def build() -> dict:
    items = schedule(select(fourth_downs.load()))
    return {
        "schema_version": "daily_pack.v1", "engine_version": ENGINE_VERSION,
        "provenance": provenance(fourth_downs.SEASONS),
        "timezone": TIMEZONE, "start_date": START_DATE.isoformat(), "days": DAYS, "per_day": PER_DAY,
        "cycle_rule": "day = (ET date − start_date) mod days; each play appears once per cycle",
        "crowd_split": "static (null) until Phase 4",
        "selection": SELECTION,
        "source": "nflverse play-by-play 2019–2025 via nflreadpy; built by python -m nfl_sim.products.daily",
        "items": items,
    }


if __name__ == "__main__":
    doc = build()
    write_json("daily/pack.json", doc)
    print(len(doc["items"]))
