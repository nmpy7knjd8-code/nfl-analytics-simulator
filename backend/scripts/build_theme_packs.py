"""Build the themed 4th-down packs (B6): Goal Line, Playoffs, Marathon.

Usage: python backend/scripts/build_theme_packs.py [--n 60] [--seasons 2022,2023] [--fresh]
(lake + WP artifact required, same as build_quiz_pack.py).

Writes frontend/public/data/packs/{goal-line,playoffs,marathon}.json. Every item has exactly the
fields of a daily item (frontend/lib/dailyPack.json, scripts/build-daily-pack.mjs); Marathon items
add driveId and playOrder. Ids are "<game_id>-<play_id>", like the daily pack, and stay stable:
a rebuild keeps every existing item that still qualifies, under its old id, and only fills gaps.
A play that is also in dailyPack.json is copied from there, so the same id never shows two values.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "backend" / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

PACK_DIR = REPO / "frontend" / "public" / "data" / "packs"
DAILY_PACK = REPO / "frontend" / "lib" / "dailyPack.json"
RETIRED = REPO / "frontend" / "lib" / "retiredDailyIds.json"
SCHEMA = "fourth_and_theme_pack.v1"
SITUATION_KEYS = ("posteam", "defteam", "home_team", "away_team", "posteam_score", "defteam_score", "qtr",
                  "quarter_seconds_remaining", "yardline_100", "down", "distance", "posteam_timeouts",
                  "defteam_timeouts")
MARATHON_MIN_PLAYS = 12  # nflverse drive_play_count
GOAL_LINE_MAX_YARDS = 5

THEMES = {
    "goal-line": {"title": "Goal Line", "blurb": "4th downs at the opponent's 5-yard line or closer."},
    "playoffs": {"title": "Playoffs", "blurb": "4th downs from postseason games."},
    "marathon": {"title": "Marathon", "blurb": f"4th downs on drives of {MARATHON_MIN_PLAYS}+ plays."},
}


def qualifies(theme: str, r) -> bool:
    if theme == "goal-line":
        return r.yardline_100 <= GOAL_LINE_MAX_YARDS
    if theme == "playoffs":
        return str(r.season_type) == "POST"
    if theme == "marathon":
        return r.drive_play_count >= MARATHON_MIN_PLAYS and r.fixed_drive == r.fixed_drive
    raise KeyError(theme)


def slim(item: dict) -> dict:
    """Python twin of frontend/scripts/build-daily-pack.mjs slim(): daily item fields only."""
    src = item["source"]
    out_src = {k: src[k] for k in ("season", "week", "game_date", "game_id")}
    if isinstance(src.get("play_id"), int):
        out_src["play_id"] = src["play_id"]
    return {
        "id": item["id"],
        "kind": item["kind"],
        "source": out_src,
        "situation": {k: item["situation"].get(k) for k in SITUATION_KEYS},
        "historical_action": item.get("historical_action"),
        "reveal": {
            "recommendation": item["reveal"]["recommendation"],
            "values": {k: float(f"{v:.6g}") for k, v in item["reveal"]["values"].items()},
        },
    }


def drive_fields(r, play_order: dict) -> dict:
    return {"driveId": f"{r.game_id}-d{int(r.fixed_drive)}", "playOrder": play_order[(r.game_id, int(r.play_id))]}


def compute_play_order(raw) -> dict:
    """1-based position of each snap within its drive (nflverse rows with a play_type, no markers)."""
    df = raw[raw["play_type"].notna() & raw["fixed_drive"].notna()][["game_id", "fixed_drive", "play_id"]]
    df = df.sort_values(["game_id", "play_id"], kind="mergesort")
    order = df.groupby(["game_id", "fixed_drive"]).cumcount() + 1
    return {(g, int(p)): int(o) for g, p, o in zip(df["game_id"], df["play_id"], order)}


def select(existing_ids, candidates_by_id, make, n):
    """Stable selection: keep existing ids that still qualify (in order), then fill by hash order.

    candidates_by_id: id -> candidate row; make(id) -> item or None (None = no longer qualifies).
    Returns (items, dropped_ids).
    """
    items, dropped, seen = [], [], set()
    for iid in existing_ids:
        it = make(iid) if iid in candidates_by_id else None
        (items.append(it) if it is not None else dropped.append(iid))
        seen.add(iid)
    for iid in sorted(candidates_by_id, key=lambda i: hashlib.sha256(i.encode()).hexdigest()):
        if len(items) >= n:
            break
        if iid in seen:
            continue
        it = make(iid)
        if it is not None:
            items.append(it)
    return items[:n] if len(items) > n else items, dropped


def load_existing(theme: str) -> list[str]:
    p = PACK_DIR / f"{theme}.json"
    return [it["id"] for it in json.loads(p.read_text())["items"]] if p.exists() else []


def write_pack(theme: str, items: list[dict], seasons: str) -> None:
    pack = {
        "schema_version": SCHEMA,
        "theme": theme,
        "title": THEMES[theme]["title"],
        "blurb": THEMES[theme]["blurb"],
        "derived_from": "fourth_down_quiz_pack.v2",
        "source": f"nflverse play-by-play REG+POST {seasons}; built by backend/scripts/build_theme_packs.py",
        "items": items,
    }
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    (PACK_DIR / f"{theme}.json").write_text(json.dumps(pack, indent=1) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=60)
    ap.add_argument("--seasons", default="2022,2023")
    ap.add_argument("--fresh", action="store_true", help="ignore existing pack ids (changes item ids!)")
    a = ap.parse_args()

    import build_quiz_pack as bq
    from nfl_sim.models.dataset import load_raw_seasons
    from nfl_sim.models.decision_lab import load_fourth_down_frame

    seasons = [int(s) for s in a.seasons.split(",")]
    analyzer = bq._load_analyzer()
    if analyzer is None:
        raise SystemExit("WP artifact missing — train/build it first")
    bq.load_fourth_down_frame = lambda s, season_type=None: load_fourth_down_frame(s, season_type=None)
    pool = bq.candidates(seasons)
    play_order = compute_play_order(load_raw_seasons(seasons))
    daily = {it["id"]: it for it in json.loads(DAILY_PACK.read_text())["items"]}
    retired = set(json.loads(RETIRED.read_text()))
    rows = {bq.item_id_of(r): (i, r) for i, r in zip(pool.index, pool.itertuples())}
    baked: dict[str, dict | None] = {}

    def base_item(iid):
        if iid in daily:
            return json.loads(json.dumps(daily[iid]))
        if iid not in baked:
            i, r = rows[iid]
            it = bq.bake(analyzer, pool.loc[i], r)
            baked[iid] = slim(it) if not bq.is_decided(it["reveal"]["values"]) else None
        return json.loads(json.dumps(baked[iid])) if baked[iid] else None

    for theme in THEMES:
        cands = {iid: r for iid, (_, r) in rows.items() if iid not in retired and qualifies(theme, r)}

        def make(iid, theme=theme):
            it = base_item(iid)
            if it is not None and theme == "marathon":
                it.update(drive_fields(rows[iid][1], play_order))
            return it

        existing = [] if a.fresh else load_existing(theme)
        items, dropped = select(existing, cands, make, a.n)
        if dropped:
            print(f"{theme}: DROPPED {len(dropped)} ids (flag to Product UI): {sorted(dropped)}")
        write_pack(theme, items, a.seasons)
        print(f"{theme}.json: {len(items)} items ({len(cands)} candidates)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
