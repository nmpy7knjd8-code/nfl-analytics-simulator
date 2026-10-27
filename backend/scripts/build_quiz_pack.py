"""Rebuild the 4th-down quiz pack from REAL nflverse plays (lake + WP artifact required).

Usage: python backend/scripts/build_quiz_pack.py [--n 365] [--seasons 2022,2023]

Every item is a real regular-season 4th down: real team codes, real score, real quarter
clock, baked with the same FourthDownAnalyzer as Situation Lab (FG dropped beyond 64 yd).
Writes backend/src/nfl_sim/quiz/data/curated_pack.json and frontend/lib/quizPack.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "backend" / "src"))

from nfl_sim.api.situation_lab import _load_analyzer, _payload_from_compare  # noqa: E402
from nfl_sim.models.decision_lab import compare_transition_modes, load_fourth_down_frame  # noqa: E402
from nfl_sim.models.fourth_down_empirics import MAX_FG_DISTANCE  # noqa: E402
from nfl_sim.quiz.pack import HISTORICAL_REFS, QUIZ_PACK_PATH, fanify_reveal, pack_item_from_situation_lab_payload  # noqa: E402

FRONTEND_PACK = REPO / "frontend" / "lib" / "quizPack.json"
# Hidden model details stay in the backend pack only; never ship them in the client bundle.
BACKEND_ONLY_REVEAL_FIELDS = ("model_notes", "edge_wp")


def frontend_pack(pack: dict) -> dict:
    out = json.loads(json.dumps(pack))
    for it in out["items"]:
        for k in BACKEND_ONLY_REVEAL_FIELDS:
            it["reveal"].pop(k, None)
    return out


def write_packs(pack: dict) -> None:
    QUIZ_PACK_PATH.write_text(json.dumps(pack, indent=2) + "\n")
    FRONTEND_PACK.write_text(json.dumps(frontend_pack(pack), indent=2) + "\n")
ACTION = {"pass": "go", "run": "go", "punt": "punt", "field_goal": "fg"}
# Target mix of what teams actually did, so the pack isn't 70% punts.
MIX = {"punt": 0.4, "go": 0.3, "fg": 0.3}


def _key(r) -> str:
    return hashlib.sha256(f"{r.game_id}|{int(r.play_id)}".encode()).hexdigest()


def candidates(seasons):
    df = load_fourth_down_frame(seasons, season_type="REG")
    pt = df["play_type"].astype("string").str.lower()
    m = (
        pt.isin(list(ACTION))
        & df["qtr"].between(1, 4)
        & df["ydstogo"].between(1, 15)
        & df["posteam_score"].notna() & df["defteam_score"].notna()
        & df["quarter_seconds_remaining"].between(0, 900)
        & df["posteam"].notna() & df["defteam"].notna()
    )
    if "penalty" in df.columns:
        m &= df["penalty"].fillna(0).eq(0)
    if "two_point_attempt" in df.columns:
        m &= df["two_point_attempt"].fillna(0).eq(0)
    out = df[m].copy()
    out["hist"] = pt[m].map(ACTION)
    # A real team never tries a 65+ yd FG in this pool; keep the pack consistent anyway.
    out = out[~((out["hist"] == "fg") & (out["yardline_100"] + FG_SNAP_YARDS > MAX_FG_DISTANCE))]
    out["k"] = [_key(r) for r in out.itertuples()]
    return out


FG_SNAP_YARDS = 18  # nflverse kick_distance = yardline_100 + 18 (same as the shared engine, #50)
# Brief + shared engine (#50): a gap under 2 points of win chance is a "close call".
CLOSE_CALL_WP = 0.02
MAX_CLOSE_CALL_SHARE = 0.15  # "too close to call" is a fine answer, but not a third of the pack


def label(r) -> str:
    return f"{r.away_team} @ {r.home_team} — 4th & {int(r.ydstogo)}"


def bake(analyzer, row, r, item_id: str | None = None) -> dict:
    cmp = compare_transition_modes(analyzer, row, empirics_mode="pooled")
    payload = _payload_from_compare(cmp, truth_play="historical", disclaimer="")
    item = pack_item_from_situation_lab_payload(
        item_id=item_id or f"{r.game_id}-{int(r.play_id)}", label=label(r), payload=payload,
    )
    rv = item["reveal"]
    if rv.get("margin") is not None:
        rv["inconclusive"] = rv["margin"] < CLOSE_CALL_WP
    fanify_reveal(rv)  # fan-language display text; model details -> model_notes / edge_wp
    sit = item["situation"]
    # Real scoreboard + real quarter clock straight from the play (no placeholders).
    sit.update(
        posteam_score=int(r.posteam_score),
        defteam_score=int(r.defteam_score),
        score_differential=int(r.posteam_score) - int(r.defteam_score),
        qtr=int(r.qtr),
        quarter_seconds_remaining=int(r.quarter_seconds_remaining),
        home_team=str(r.home_team),
        away_team=str(r.away_team),
        posteam=str(r.posteam),
        defteam=str(r.defteam),
    )
    item["source"].update(season=int(r.season), week=int(r.week), game_date=str(r.game_date))
    item["historical_action"] = r.hist
    item["source"]["play_id"] = int(r.play_id)
    return item


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=365)
    ap.add_argument("--seasons", default="2022,2023")
    ap.add_argument("--rewrite-text", action="store_true",
                    help="re-apply fan-language text to the existing pack (no lake/WP needed)")
    a = ap.parse_args()
    if a.rewrite_text:
        pack = json.loads(QUIZ_PACK_PATH.read_text())
        for it in pack["items"]:
            fanify_reveal(it["reveal"])
        write_packs(pack)
        print(f"rewrote text for {len(pack['items'])} items")
        return 0
    seasons = [int(s) for s in a.seasons.split(",")]
    analyzer = _load_analyzer()
    if analyzer is None:
        raise SystemExit("WP artifact missing — train/build it first")
    pool = candidates(seasons)
    items, t0 = [], time.time()
    # Pinned reference plays (stable ids used by Situation Lab + tests) go first.
    pinned = []
    for ref in HISTORICAL_REFS:
        hit = pool[(pool["game_id"] == ref["game_id"]) & (pool["play_id"] == float(ref["play_id"]))]
        if hit.empty:
            raise SystemExit(f"pinned play missing from pool: {ref}")
        r = next(hit.itertuples())
        pinned.append(bake(analyzer, hit.loc[r.Index], r, item_id=ref["id"]))
    pool = pool.drop(index=[i for ref in HISTORICAL_REFS for i in pool.index[
        (pool["game_id"] == ref["game_id"]) & (pool["play_id"] == float(ref["play_id"]))]])
    for action, share in MIX.items():
        quota = round(a.n * share)
        close_quota = int(quota * MAX_CLOSE_CALL_SHARE)
        got = close = 0
        sub = pool[pool["hist"] == action].sort_values("k")
        for r in sub.itertuples():
            if got >= quota:
                break
            item = bake(analyzer, sub.loc[r.Index], r)
            if item["reveal"]["inconclusive"]:
                if close >= close_quota:
                    continue
                close += 1
            items.append(item)
            got += 1
    items.sort(key=lambda it: hashlib.sha256(it["id"].encode()).hexdigest())
    items = pinned + items[: a.n - len(pinned)]
    pack = {
        "schema_version": "fourth_down_quiz_pack.v2",
        "offline": True,
        "live_feed": False,
        "scorer": "FourthDownAnalyzer compare_transition_modes (pooled_improved); FG capped at 64 yd",
        "primary_config": "pooled_improved",
        "source": f"nflverse play-by-play REG {a.seasons}; built by backend/scripts/build_quiz_pack.py",
        "items": items,
    }
    write_packs(pack)
    print(f"{len(items)} items in {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
