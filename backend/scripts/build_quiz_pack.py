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
from nfl_sim.models.fourth_down_empirics import FG_SNAP_YARDS, MAX_FG_DISTANCE  # noqa: E402
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
MIX = {"punt": 0.36, "go": 0.3, "fg": 0.34}  # fg nudged so >=15% of answers are FG (H6, goal-line fix)


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


# Brief + shared engine (#50): a gap under 2 points of win chance is a "close call".
CLOSE_CALL_WP = 0.02
MAX_CLOSE_CALL_SHARE = 0.15  # "too close to call" is a fine answer, but not a third of the pack


def item_id_of(r) -> str:
    return f"{r.game_id}-{int(r.play_id)}"


# A game already decided (every option under 2% or over 98% win chance) makes a poor
# question and produces 0.1% "ties" (QA 2026-10-26 23:15, M13). Skip those plays.
DECIDED_WP = 0.02


def is_decided(values: dict) -> bool:
    return all(v < DECIDED_WP or v > 1.0 - DECIDED_WP for v in values.values())


def keep_item(item: dict) -> bool:
    """Whether a baked item may stay in the pack: decided games are dropped."""
    return not is_decided(item["reveal"]["values"])


def stable_select(existing_ids, rebake, fresh, n: int):
    """Keep every existing item that still qualifies, under its old id; fill gaps from fresh.

    Product UI pins the daily schedule by item id (dailySchedule.json), so a rebuild must
    only update values in place (#119 swapped 15 ids and reshuffled every daily set).
    rebake(id) -> item or None (None = play left the pool or no longer qualifies);
    fresh is an iterable of new items, best first. Returns (items, dropped_ids).
    """
    kept, dropped = [], []
    for iid in existing_ids:
        item = rebake(iid)
        (kept if item is not None else dropped).append(item if item is not None else iid)
    seen = {it["id"] for it in kept} | set(dropped)
    for item in fresh:
        if len(kept) >= n:
            break
        if item["id"] not in seen:
            kept.append(item)
            seen.add(item["id"])
    return kept[:n], dropped


def label(r) -> str:
    return f"{r.away_team} @ {r.home_team} — 4th & {int(r.ydstogo)}"


def bake(analyzer, row, r, item_id: str | None = None) -> dict:
    cmp = compare_transition_modes(analyzer, row, empirics_mode="pooled")
    payload = _payload_from_compare(cmp, truth_play="historical", disclaimer="")
    item = pack_item_from_situation_lab_payload(
        item_id=item_id or item_id_of(r), label=label(r), payload=payload,
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
    ap.add_argument("--fresh", action="store_true",
                    help="ignore the existing pack's ids (reshuffles the pinned daily schedule!)")
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
    pinned_ids = {ref["id"] for ref in HISTORICAL_REFS}
    existing = [] if a.fresh or not QUIZ_PACK_PATH.exists() else [
        it["id"] for it in json.loads(QUIZ_PACK_PATH.read_text())["items"] if it["id"] not in pinned_ids]
    by_id = {item_id_of(r): (i, r) for i, r in zip(pool.index, pool.itertuples())}

    def rebake(iid):
        if iid not in by_id:
            return None
        i, r = by_id[iid]
        item = bake(analyzer, pool.loc[i], r)
        return item if keep_item(item) else None

    def fresh():
        # New plays only fill slots freed by dropped items, in the target action mix.
        taken = {k: 0 for k in MIX}
        close = 0
        subs = {k: iter(pool[(pool["hist"] == k) & ~pool.index.isin(
            [by_id[e][0] for e in existing if e in by_id])].sort_values("k").itertuples()) for k in MIX}
        while subs:
            act = min(subs, key=lambda k: taken[k] / MIX[k])
            r = next(subs[act], None)
            if r is None:
                del subs[act]
                continue
            item = bake(analyzer, pool.loc[r.Index], r)
            if not keep_item(item):
                continue
            if item["reveal"]["inconclusive"]:
                if close >= int(a.n * MAX_CLOSE_CALL_SHARE):
                    continue
                close += 1
            taken[act] += 1
            yield item

    if existing:
        items, dropped = stable_select(existing, rebake, fresh(), a.n - len(pinned))
        if dropped:
            print(f"DROPPED {len(dropped)} ids (check dailySchedule.json): {sorted(dropped)}")
    else:
        for action, share in MIX.items():
            quota = round(a.n * share)
            close_quota = int(quota * MAX_CLOSE_CALL_SHARE)
            got = close = 0
            sub = pool[pool["hist"] == action].sort_values("k")
            for r in sub.itertuples():
                if got >= quota:
                    break
                item = bake(analyzer, sub.loc[r.Index], r)
                if not keep_item(item):
                    continue
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
