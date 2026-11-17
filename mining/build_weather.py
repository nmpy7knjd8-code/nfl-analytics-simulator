"""Build data/site/weather.json for G6 Weather badge (Game Story header).

Source: nflverse play-by-play 2019-2025 (REG+POST): game-level roof, temp (F), wind (mph), final scores.
A game gets weather only when nflverse roof is "outdoors" or "open" and both temp and wind are present;
when the numeric temp and wind are empty, wind and temp are read from the play-by-play ``weather`` text
(parse_weather_text; nfl_sim.weather_text after #344 merges). Dome, closed-roof and missing-weather games are absent from ``games``;
dome/closed-roof games are listed in ``indoors`` (nflverse roof) so the badge can say "Indoors".
2022_17_BUF_CIN (suspended) is left out. ``bands`` are average total points per wind band and per
temperature band over those games, so the badge can say e.g. "Games this windy averaged 42.3 points".
No play ids, EPA, win chance or betting fields.

Frozen: a published game's weather never changes; band numbers only change under a reviewed override
that lists the added games and the band cells that move (mining/frozen_overrides/). New games and
indoors entries otherwise only from an open season past the watermark (mining/_frozen.py).

Usage: python mining/build_weather.py PBP_PARQUET [...] [--out data/site/weather.json]
       [--allow-changes mining/frozen_overrides/<file>.json]
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_stamp import stamp  # noqa: E402

import _frozen as fz  # noqa: E402
from _frozen import read_pbp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/weather.json"
SCHEMA = "weather/v1"
NO_RESULT_GAME = "2022_17_BUF_CIN"
OPEN_AIR = ("outdoors", "open")
WIND_BANDS = [(0, 9), (10, 14), (15, 19), (20, None)]
TEMP_BANDS = [(None, 32), (33, 50), (51, 70), (71, None)]
COLUMNS = ["game_id", "game_date", "roof", "temp", "wind", "weather", "home_score", "away_score"]


# Copied exactly from Data & Models PR #344 (backend/src/nfl_sim/weather_text.py,
# head 21d282e). Will be deduped onto nfl_sim.weather_text after #344 merges.
_TEMP = re.compile(r"\bTemp:\s*(-?\d{1,3})\s*°\s*F\b", re.I)
_WIND = re.compile(r"\bWind:\s*(?:[A-Za-z]{1,10}\s+)?(\d{1,2})\s*mph\b", re.I)


def parse_weather_text(text: object) -> tuple[int, int] | None:
    """(wind_mph, temp_f) or None."""
    if not isinstance(text, str) or not text.strip():
        return None
    if re.search(r"\bindoors?\b", text, re.I) or re.search(r"\bWind:\s*N/?A\b", text, re.I):
        return None
    t, w = _TEMP.search(text), _WIND.search(text)
    if not t or not w:
        return None
    return int(w.group(1)), int(t.group(1))


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _band(rows: list[tuple[int, int]], lo: int | None, hi: int | None, key: str) -> dict[str, Any]:
    pts = [p for v, p in rows if (lo is None or v >= lo) and (hi is None or v <= hi)]
    return {key: [lo, hi], "games": len(pts), "avg_points": round(sum(pts) / len(pts), 1) if pts else None}


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    games: dict[str, dict[str, Any]] = {}
    for r in rows:
        if r["game_id"] != NO_RESULT_GAME:
            games.setdefault(r["game_id"], r)
    out: dict[str, list[int]] = {}
    wind, temp = [], []
    indoors = sorted(gid for gid, g in games.items() if g.get("roof") in ("dome", "closed"))
    for gid, g in sorted(games.items()):
        t, w = _num(g.get("temp")), _num(g.get("wind"))
        if t is None and w is None:
            parsed = parse_weather_text(g.get("weather"))
            if parsed:
                w, t = parsed
        if g.get("roof") not in OPEN_AIR or t is None or w is None:
            continue
        pts = int(g["home_score"]) + int(g["away_score"])
        out[gid] = [int(w), int(t)]
        wind.append((int(w), pts))
        temp.append((int(t), pts))
    last = max(str(g.get("game_date") or "")[:10] for g in games.values())
    return {
        "schema": SCHEMA,
        "source": "nflverse play-by-play (CC BY 4.0), REG+POST; open-air games (roof outdoors/open) with weather",
        "builtAt": "",
        "dataThrough": last,
        "season_list": sorted({int(gid[:4]) for gid in games}),
        "cols": ["wind_mph", "temp_f"],
        "bands": {"wind": [_band(wind, lo, hi, "mph") for lo, hi in WIND_BANDS],
                  "temp": [_band(temp, lo, hi, "f") for lo, hi in TEMP_BANDS]},
        "games": out,
        "indoors": indoors,
    }


def band_cell_changes(old: dict[str, Any], new: dict[str, Any]) -> list[tuple[str, tuple | None, str]]:
    """(kind, range-or-None, field) for every band value that moved; range is None if the set of bands changed."""
    out: list[tuple[str, tuple | None, str]] = []
    for kind, key in (("wind", "mph"), ("temp", "f")):
        om = {tuple(b[key]): b for b in old.get(kind, [])}
        nm = {tuple(b[key]): b for b in new.get(kind, [])}
        if set(om) != set(nm):
            out.append((kind, None, "ranges"))
            continue
        for rng, ob in om.items():
            nb = nm[rng]
            for field in ("games", "avg_points"):
                if ob.get(field) != nb.get(field):
                    out.append((kind, rng, field))
    return out


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any],
                 allowed_games: set[str] | frozenset = frozenset(),
                 allowed_bands: set[tuple] | frozenset = frozenset()) -> list[str]:
    """A published game's [wind, temp] never changes. New frozen-season games and band-cell edits are
    allowed only when listed on a reviewed override (``allowed_games`` / ``allowed_bands``)."""
    if not old or old.get("schema") != new["schema"]:
        return []
    bad = [g for g, v in old["games"].items() if new["games"].get(g) != v]
    bad += [f"games added: {g}" for g in new["games"]
            if g not in old["games"] and g not in allowed_games and fz.is_frozen_game(g, "weather")]
    for kind, rng, field in band_cell_changes(old.get("bands") or {}, new.get("bands") or {}):
        if (kind, rng, field) not in allowed_bands:
            label = f"bands.{kind}.{list(rng) if rng is not None else 'ranges'}.{field}"
            bad.append(label)
    if "indoors" in old:
        ni = new.get("indoors") or []
        bad += ["indoors"] if ni[:len(old["indoors"])] != old["indoors"] else []  # append-only
        bad += [f"indoors added: {g}" for g in ni[len(old["indoors"]):] if fz.is_frozen_game(g, "weather")]
    return bad


def load_override(path: str | None) -> tuple[set[str], set[tuple]]:
    if not path:
        return set(), set()
    o = json.loads(Path(path).read_text())
    if (not o.get("reason") or not o.get("approved_by") or o.get("rule") != "text_fallback"
            or not isinstance(o.get("games"), list) or not isinstance(o.get("band_cells"), list)):
        raise SystemExit(f"override {path} needs reason, approved_by, rule text_fallback, games and band_cells")
    cells: set[tuple] = set()
    for c in o["band_cells"]:
        cells.add((c["kind"], tuple(c["range"]) if c.get("range") is not None else None, c["field"]))
    return set(o["games"]), cells


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = read_pbp(paths, COLUMNS)
    df = df.drop_duplicates("game_id")
    df["game_date"] = df["game_date"].astype(str)
    return json.loads(df.to_json(orient="records"))


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--allow-changes", default=None)
    a = ap.parse_args(argv)
    out = Path(a.out)
    new = build(load_rows(a.pbp))
    old = json.loads(out.read_text()) if out.exists() else None
    bad = check_frozen(old, new, *load_override(a.allow_changes))
    if bad:
        print("FAIL: published weather data would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(stamp(new, old)))
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['games'])} games)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
