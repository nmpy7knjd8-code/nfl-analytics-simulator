"""Build G5 QB swing profiles (NFL Teams & Games UI).

Outputs (spec: nfl-research/teams/g5-json-shape.md):
  frontend/lib/qbIndex.json                    small index (generateStaticParams + /player list)
  frontend/public/data/players/<gsis_id>.json  one lazy file per QB

Who is a QB: any nflverse gsis_id listed at position QB on an nflverse weekly roster 2019-2025 who has
at least one swing. Names come from nflverse players (display_name), never the abbreviated pbp names.

A swing (same rule as mining/build_swings.py, C2/C3): regulation only (qtr 1-4, no overtime), a run or
pass snap (no kneels, spikes, penalty-only rows), nflverse vegas_wp before and the QA-Q3 wp_after
(next clocked later play, else the final result), |wp_after - vegas_wp| >= 0.15. The QB is credited
when he is nflverse passer_player_id (passes and sacks) or rusher_player_id (scrambles and designed
runs). Regular season and playoffs are both included (season_type on each swing).
desc is the games-v4 display_text (read-only).

Fan-facing fields: no EPA, xpass, play ids or betting fields. wp_before/wp_after/swing are the
offense's chance to win on a 0-1 scale, rounded to 4 decimals (the UI shows x100 as points).

Frozen: every published swing in every published player file must stay identical, no player file may
disappear, and index rows must not change while the season list is unchanged (exit 1).

Usage: python mining/build_qb_profiles.py PBP_PARQUET [...] --rosters ROSTER_PARQUET [...]
       --players players.csv --games <dir of games-v4 per-game json>
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "mining"))
from build_stamp import stamp  # noqa: E402

_spec = importlib.util.spec_from_file_location("build_swings", ROOT / "mining/build_swings.py")
sw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sw)

INDEX = ROOT / "frontend/lib/qbIndex.json"
PLAYERS_DIR = ROOT / "frontend/public/data/players"
SCHEMA_VERSION = 1
SWING_MIN = 0.15
COLUMNS = sw.COLUMNS + ["defteam", "game_date", "passer_player_id", "rusher_player_id", "sack", "qb_scramble"]
_num = sw._num


def role(r: dict[str, Any], qb: str) -> str | None:
    if r.get("passer_player_id") == qb:
        return "sack" if _num(r.get("sack")) == 1 else "pass"
    if r.get("rusher_player_id") == qb:
        return "scramble" if _num(r.get("qb_scramble")) == 1 else "run"
    return None


def is_qb_swing(r: dict[str, Any]) -> bool:
    return (r.get("play_type") in ("run", "pass") and sw.is_swing_candidate(r)
            and abs(float(r["_wp_after"]) - float(r["vegas_wp"])) >= SWING_MIN - 1e-12)


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def assign_slugs(names: dict[str, str]) -> dict[str, str]:
    """name slug; when two QBs share it, every one of them gets '-<last 4 of gsis id>'."""
    base = {i: slugify(n) for i, n in names.items()}
    count: dict[str, int] = defaultdict(int)
    for s in base.values():
        count[s] += 1
    return {i: s if count[s] == 1 else f"{s}-{i.replace('-', '')[-4:]}" for i, s in base.items()}


def record(r: dict[str, Any], rl: str) -> dict[str, Any]:
    wp, after = float(r["vegas_wp"]), float(r["_wp_after"])
    return {
        "season": int(r["season"]), "week": int(r["week"]), "season_type": r["season_type"],
        "game_id": r["game_id"], "team": r["posteam"], "opp": r["defteam"],
        "qtr": int(r["qtr"]), "clock": r["time"],
        "down": None if _num(r.get("down")) is None else int(r["down"]),
        "togo": None if _num(r.get("ydstogo")) is None else int(r["ydstogo"]),
        "yardline_100": None if _num(r.get("yardline_100")) is None else int(r["yardline_100"]),
        "role": rl, "desc": r["_text"],
        "wp_before": round(wp, 4), "wp_after": round(after, 4), "swing": round(after - wp, 4),
    }


def swing_key(s: dict[str, Any]) -> tuple:
    return (s["game_id"], s["qtr"], s["clock"], s["team"], s["role"])


def build(rows: list[dict[str, Any]], qbs: dict[str, str], text_of) -> tuple[dict[str, Any], dict[str, dict]]:
    """qbs: gsis_id -> full name (QBs by roster). Returns (index, {gsis_id: player file})."""
    rows = sw.attach_after(sw.mark_bad_rows(rows))
    per: dict[str, list[tuple]] = defaultdict(list)
    for r in rows:
        if not is_qb_swing(r):
            continue
        for pid in {r.get("passer_player_id"), r.get("rusher_player_id")} - {None}:
            rl = role(r, pid)
            if pid in qbs and rl:
                per[pid].append((r, rl))
    seasons = sorted({int(r["season"]) for r in rows})
    last = max((str(r.get("game_date") or "") for r in rows), default="")
    slugs = assign_slugs({i: qbs[i] for i in per})
    files, index_rows = {}, []
    for pid in sorted(per, key=lambda i: (qbs[i], i)):
        for r, _ in per[pid]:
            r.setdefault("_text", text_of(r["game_id"], r["play_id"]))
        sw_list = sorted((record(r, rl) for r, rl in per[pid]),
                         key=lambda s: (s["season"], s["week"], s["game_id"], s["qtr"], -_clock(s["clock"])))
        files[pid] = {"schema_version": SCHEMA_VERSION, "id": pid, "slug": slugs[pid], "name": qbs[pid],
                      "swings": sw_list}
        by_season: dict[str, list[int]] = {}
        for s in sw_list:
            c = by_season.setdefault(str(s["season"]), [0, 0])
            c[0 if s["swing"] > 0 else 1] += 1
        up = sum(c[0] for c in by_season.values())
        index_rows.append({"id": pid, "slug": slugs[pid], "name": qbs[pid],
                           "teams": sorted({s["team"] for s in sw_list}), "swings": len(sw_list),
                           "up": up, "down": len(sw_list) - up, "by_season": by_season})
    index = {"schema_version": SCHEMA_VERSION, "stub": False,
             "source": "nflverse play-by-play, weekly rosters and players via mining/build_qb_profiles.py",
             "season_list": seasons, "dataThrough": last[:10], "builtAt": "",
             "swing_min": SWING_MIN,
             "swing_def": "Regulation run or pass snap (passes, sacks, scrambles, runs) where the offense's chance "
                          "to win changed by 15+ points; regular season and playoffs; no overtime",
             "qbs": index_rows}
    return index, files


def _clock(c: str | None) -> int:
    try:
        m, s = (c or "0:0").split(":")
        return int(m) * 60 + int(s)
    except ValueError:
        return 0


def check_frozen(old_index: dict | None, new_index: dict, old_files: dict[str, dict],
                 new_files: dict[str, dict]) -> list[str]:
    bad: list[str] = []
    for pid, of in old_files.items():
        nf = new_files.get(pid)
        if nf is None:
            bad.append(f"{pid}:file removed")
            continue
        if (of["name"], of["slug"]) != (nf["name"], nf["slug"]):
            bad.append(f"{pid}:name/slug")
        nk = {swing_key(s): s for s in nf["swings"]}
        bad += [f"{pid}:{swing_key(s)}" for s in of["swings"] if nk.get(swing_key(s)) != s]
    if old_index and old_index.get("season_list") == new_index["season_list"]:
        nr = {q["id"]: q for q in new_index["qbs"]}
        bad += [f"index:{q['id']}" for q in old_index["qbs"] if nr.get(q["id"]) != q]
        bad += [f"index:new {i}" for i in nr if i not in {q["id"] for q in old_index["qbs"]}]
    return bad


def load_qbs(roster_paths: list[str], players_csv: str) -> dict[str, str]:
    import pandas as pd

    ids: dict[str, str] = {}
    for p in roster_paths:
        df = pd.read_parquet(p, columns=["gsis_id", "position", "full_name"])
        for g, n in df[(df["position"] == "QB") & df["gsis_id"].notna()][["gsis_id", "full_name"]].values:
            ids.setdefault(g, n)
    pl = pd.read_csv(players_csv, usecols=["gsis_id", "display_name"], dtype=str)
    names = dict(pl.dropna().values)
    return {g: names.get(g) or n for g, n in ids.items()}


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--rosters", nargs="+", required=True)
    ap.add_argument("--players", required=True)
    ap.add_argument("--games", default=str(sw.GAMES_DIR))
    ap.add_argument("--index", default=str(INDEX))
    ap.add_argument("--players-dir", default=str(PLAYERS_DIR))
    a = ap.parse_args(argv)
    sw.COLUMNS[:] = COLUMNS
    index, files = build(sw.load_rows(a.pbp), load_qbs(a.rosters, a.players), sw.display_texts(Path(a.games)))
    ipath, pdir = Path(a.index), Path(a.players_dir)
    old_index = json.loads(ipath.read_text()) if ipath.exists() else None
    old_files = {p.stem: json.loads(p.read_text()) for p in pdir.glob("*.json")} if pdir.exists() else {}
    bad = check_frozen(old_index, index, old_files, files)
    if bad:
        print("FAIL: published QB swings would change: " + "; ".join(bad[:20]), file=sys.stderr)
        return 1
    index = stamp(index, old_index)
    pdir.mkdir(parents=True, exist_ok=True)
    for pid, f in files.items():
        (pdir / f"{pid}.json").write_text(dumps(f))
    ipath.write_text(dumps(index))
    sizes = [(pdir / f"{p}.json").stat().st_size for p in files]
    print(f"wrote {ipath} ({ipath.stat().st_size} B) + {len(files)} player files "
          f"({sum(sizes)} B total, max {max(sizes)} B)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
