"""Data audit: every fan JSON file under data/site and frontend/public/data (Analyte task, 2026-11-10).

Table-driven. GROUPS gives each file a group and an owning lane. Each file is read once (cached) and
scanned for every check. Each (check, group) pair is one test, so a failure names the check, the group
and up to 5 examples.

Checks: banned keys (play_id, EPA, WPA, xpass, Vegas, spread, odds, betting), banned words in text, nulls
(win chance may be null; it must be null in overtime), no win chance in overtime, field goals <= 64 yards,
doubled periods and doubled or broken initials in text, byte-identical frontend copies, and row and game
counts against nflverse 2019-2025.

Owners: findings in NFL Data & Models files (games index and per-game play files, Daily/quiz packs,
coaches, fourth-down grid) are listed in DEFERRED and marked xfail (not strict) with a reason. The data
builders lane fixes its own files (mining/build_*.py) with narrow frozen overrides.

nflverse truth: fixtures/nflverse_games_2019_2025.json (one row per game plus season totals) is committed,
so the count checks run in CI. When the pbp parquets are on disk ($NFL_PBP_DIR, else $FOURTH_PBP_DIR,
else /workspace/nfl-research/mining/data), test_truth_fixture_matches_nflverse_parquets rebuilds the
fixture from them and compares; CI has no parquets, so only that test skips there.
Regenerate: python backend/tests/test_data_audit.py --write-fixture
Per-game files (frontend/public/data/games/<game_id>.json) are a release asset, not in git: CI fetches them
(scripts/pages/game_files_release.sh fetch) before pytest. Their tests skip when the files are absent.
Findings report: python backend/tests/test_data_audit.py --report
"""
from __future__ import annotations

import functools
import glob
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Iterator

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = Path(__file__).parent / "fixtures" / "nflverse_games_2019_2025.json"
SEASONS = list(range(2019, 2026))
B, DM = "data builders", "NFL Data & Models"

# (group, glob relative to ROOT, owner). Every JSON file under data/site and frontend/public/data must match one.
GROUPS: list[tuple[str, str, str]] = [
    ("site", "data/site/*.json", B),
    ("site_charts", "data/site/charts/*.json", B),
    ("site_drives", "data/site/drives/*.json", B),
    ("pub_charts", "frontend/public/data/charts/*.json", B),
    ("pub_drives", "frontend/public/data/drives/*.json", B),
    ("stories", "frontend/public/data/stories/*.json", B),
    ("players", "frontend/public/data/players/*.json", B),
    ("fakes_text", "frontend/lib/site/fakesText.json", B),  # fan text for data/site/fakes.json desc
    ("games_index", "frontend/public/data/games/20[0-9][0-9].json", DM),
    ("game_files", "frontend/public/data/games/20[0-9][0-9]_*.json", DM),
    ("coaches", "frontend/public/data/coaches/*.json", DM),
    ("coach_calls", "frontend/public/data/coaches/calls/*.json", DM),
    ("fourth_down", "frontend/public/data/fourth_down/*.json", DM),
    ("packs", "frontend/public/data/packs/*.json", DM),
]
OWNER = {g: o for g, _, o in GROUPS}

# Byte-identical copies: (data/site file or folder, frontend copy). Folders compare every file.
COPIES: list[tuple[str, str]] = [
    ("data/site/charts", "frontend/public/data/charts"),
    ("data/site/drives", "frontend/public/data/drives"),
    *[(f"data/site/{n}.json", f"frontend/public/data/stories/{n}.json")
      for n in ("comebacks", "firstdown", "goalline", "onthisday", "swings", "weather")],
    *[(f"data/site/{n}.json", f"frontend/lib/site/{n}.json")
      for n in ("calib", "era", "fakes", "fg_rates", "gorates", "kickers", "outcomes", "twopoint")],
]

# Nulls allowed at a (group, normalized path). Win-chance fields are handled separately (always allowed in OT).
ALLOWED_NULLS: dict[tuple[str, str], str] = {
    ("site", "$.real_punts[].first_down"): "decoy real punts are not fake attempts; first_down does not apply",
    ("site", "$.weeks.*.round"): "regular-season weeks have no playoff round",
    ("site", "$.top[].round"): "regular-season weeks have no playoff round",
    ("stories", "$.weeks.*.round"): "regular-season weeks have no playoff round",
    ("stories", "$.top[].round"): "regular-season weeks have no playoff round",
    ("site", "$.bands.wind[].mph[]"): "open-ended band bound (e.g. 20+ mph)",
    ("site", "$.bands.temp[].f[]"): "open-ended band bound",
    ("stories", "$.bands.wind[].mph[]"): "open-ended band bound (e.g. 20+ mph)",
    ("stories", "$.bands.temp[].f[]"): "open-ended band bound",
    ("site", "$.per_choice_win_chance.by_try.*"): "twopoint null_reason: OT tries and Q4 tries with 0:01-2:00 left",
    ("players", "$.swings[].down"): "two-point tries have no down",
    ("games_index", "$.games[].wind"): "no weather reading (domes, closed roofs); missing stays missing",
    ("games_index", "$.games[].temp"): "no weather reading (domes, closed roofs); missing stays missing",
    ("game_files", "$.game.wind"): "no weather reading; missing stays missing",
    ("game_files", "$.game.temp"): "no weather reading; missing stays missing",
    **{("game_files", f"$.cols[].{c}"): "non-snap rows (game start, kickoffs, tries, timeouts, ends of quarters)"
       for c in ("penalty_text", "down", "yardline_100", "posteam", "play_type")},
    ("coaches", "$.coaches[].grade"): "documented grade_status: null until calibrated win chance",
    ("fourth_down", "$.cells[]"): "unreachable state (distance longer than the field)",
    ("fourth_down", "$.cells[][]"): "option not available in that state",
}

# Text fields that are raw nflverse source text, not shown to fans (fan text lives elsewhere).
RAW_TEXT: dict[tuple[str, str], str] = {
    ("site", "$.plays[].desc"): "fakes.json raw nflverse desc; fans see frontend/lib/site/fakesText.json (audited)",
    ("site", "$.real_punts[].desc"): "fakes.json raw nflverse desc; fans see frontend/lib/site/fakesText.json (audited)",
}

# Known findings in other lanes' files: (check, group) -> reason. xfail, not strict.
DEFERRED: dict[tuple[str, str], str] = {
    ("banned_keys", "packs"): "NFL Data & Models: packs items carry source.play_id (180 items)",
    ("banned_keys", "game_files"): "NFL Data & Models: per-game files carry cols.play_id, swing_play_ids, "
                                   "wp_fallback_play_ids (every game file)",
    ("ot_win_chance", "game_files"): "NFL Data & Models: cols.home_wp is set on overtime plays (110 OT games)",
    ("nulls", "game_files"): "NFL Data & Models: cols.sec is null on some rows",
    ("doubled_period", "game_files"): "NFL Data & Models: 'Jr..'/'Sr..' in cols.display_text and cols.text; the UI "
                                      "collapses it at render (frontend/lib/gamePlays.ts stopgap) until the next "
                                      "games release carries the play_text.py fix",
    ("doubled_period", "coaches"): "NFL Data & Models: raw nflverse 'Jr..'/'Sr..' in coaches best/worst desc",
    ("initials", "game_files"): "NFL Data & Models: doubled initials in display_text ('A.J. A.J. Brown'), "
                                "glued initials in raw text",
    ("fg_max", "game_files"): "NFL Data & Models: historical 65-70 yard attempts in play rows and text "
                              "(nflverse has 18 FG tries over 64 yards in 2019-2025)",
}

WP_FIELDS = {"wp", "wp_before", "wp_after", "home_wp", "wp_after_chosen", "wp_after_best", "wp_after_actual",
             "low", "values", "spark"}
BANNED_TOKENS = {"epa", "wpa", "xpass", "vegas", "spread", "odds", "bet", "betting", "moneyline", "cpoe"}
BANNED_WORDS = re.compile(r"\b(EPA|WPA|xpass|betting|moneyline|point spread|over/under)\b", re.I)
ID_KEY = re.compile(r"^(\d{4}_\d\d_|\d\d-\d\d$|00-\d|\d{4}-w\d\d$|\d+$|\d+-[a-z]+$|-?\d)|[.|]")
DOUBLED_PERIOD = re.compile(r"(?<!\.)\.\.(?!\.)")
INITIALS = [
    ("doubled initials", re.compile(r"\b((?:[A-Z]\.){2,3}) ?\1")),   # 'A.J. A.J. Brown'
    ("spaced initials", re.compile(r"\b[A-Z]\. [A-Z]\. ?[A-Z][a-z]")),  # 'J. J. Watt'
    ("glued initials", re.compile(r"\b[A-Z]\.[A-Z]\.[A-Z][a-z]")),    # 'C.J.Gardner-Johnson'
]
FG_TEXT = re.compile(r"(\d+)[- ]yards? field goal", re.I)
FG_KINDS = {"field_goal", "fg"}
CHECKS = ["banned_keys", "banned_words", "nulls", "ot_win_chance", "fg_max", "doubled_period", "initials"]


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


@functools.lru_cache(maxsize=None)
def files_by_group() -> dict[str, list[Path]]:
    out: dict[str, list[Path]] = defaultdict(list)
    for g, pat, _ in GROUPS:
        out[g] = sorted(Path(p) for p in glob.glob(str(ROOT / pat)))
    return out


def all_data_files() -> list[Path]:
    return sorted({Path(p) for d in ("data/site", "frontend/public/data")
                   for p in glob.glob(str(ROOT / d / "**/*.json"), recursive=True)})


# ---------- one scan per file ----------

def _rows(d: dict[str, Any]) -> Iterator[tuple[str, Any]]:
    """Yield (key, value) with 'cols'-list rows zipped into dicts so fields have names (dict cols: columns())."""
    cols = d.get("cols")
    zip_ = (lambda r: dict(zip(cols, r)) if isinstance(r, list) and len(r) == len(cols) else r) \
        if isinstance(cols, list) else None
    for k, v in d.items():
        if k == "cols" or not zip_:
            yield k, v
        elif isinstance(v, list) and v and all(isinstance(r, list) for r in v):
            yield k, [zip_(r) for r in v]
        elif isinstance(v, dict) and v and all(isinstance(x, list) for x in v.values()):
            yield k, {kk: ([zip_(r) for r in x] if x and all(isinstance(r, list) for r in x) else zip_(x))
                      for kk, x in v.items()}
        else:
            yield k, v


def _qtr(r: dict[str, Any]) -> Any:
    s = r.get("situation")
    return r.get("qtr", s.get("qtr") if isinstance(s, dict) else None)


@functools.lru_cache(maxsize=4096)
def _key_info(k: str) -> tuple[bool, bool]:
    """(key is a data id such as a game id or date, key name is banned in fan files)."""
    if ID_KEY.search(k):
        return True, False
    toks = set(re.split(r"[^a-z0-9]+|_", k.lower()))
    return False, "play_id" in k.lower() or bool(toks & BANNED_TOKENS) or k == "total_line"


@functools.lru_cache(maxsize=None)
def scan(path: Path, group: str) -> dict[str, list[str]]:
    """All findings in one file: check -> ['<path>: <example>', ...]."""
    found: dict[str, list[str]] = defaultdict(list)
    add = lambda c, p, msg: found[c].append(f"{p}: {msg}")  # noqa: E731

    def text(p: str, s: str) -> None:
        if (group, p) in RAW_TEXT:
            return
        if BANNED_WORDS.search(s):
            add("banned_words", p, s[:90])
        if ".." in s and DOUBLED_PERIOD.search(s):
            add("doubled_period", p, s[:120])
        if "." in s:
            for name, rx in INITIALS:
                m = rx.search(s)
                if m:
                    add("initials", p, f"{name}: ...{s[max(0, m.start() - 30):m.end() + 20]}")
        if "field goal" in s.lower():
            for m in FG_TEXT.finditer(s):
                if int(m.group(1)) > 64:
                    add("fg_max", p, s[:100])

    def record(p: str, r: dict[str, Any]) -> None:
        q = _qtr(r)
        if isinstance(q, int) and q >= 5:
            hot = {k: r[k] for k in WP_FIELDS & set(r) if r[k] is not None}
            if hot:
                add("ot_win_chance", p, f"{r.get('game_id') or r.get('id') or r.get('play_id')} qtr {q} {hot}"[:120])
        if isinstance(r.get("low_qtr"), int) and r["low_qtr"] >= 5:
            add("ot_win_chance", p, f"{r.get('game_id')} low in OT")
        s = r.get("situation") if isinstance(r.get("situation"), dict) else r
        yl = s.get("yardline_100")
        rec = r.get("recommendation") or (r.get("reveal") or {}).get("recommendation")
        kinds = {r.get("play_type"), r.get("kind"), r.get("actual"), r.get("historical_action"), rec}
        if kinds & FG_KINDS and isinstance(yl, (int, float)):
            dist = r.get("kick_distance") or yl + 17
            if dist > 64:
                add("fg_max", p, f"{r.get('game_id') or r.get('id')} field goal from {dist} yards")
        for k in ("maxYards", "maxFgYards"):
            if isinstance(r.get(k), (int, float)) and r[k] > 64:
                add("fg_max", p, f"{k} = {r[k]}")

    def columns(p: str, cols: dict[str, list]) -> None:
        """Column-oriented rows (per-game files): same checks as record()/walk(), one column at a time."""
        qtr = cols.get("qtr") or []
        ot = [isinstance(q, int) and q >= 5 for q in qtr]
        for c, vals in cols.items():
            is_id, banned = _key_info(c)
            if banned:
                add("banned_keys", p, f"column {c}")
            cp = f"{p}[].{c}"
            wp = c in WP_FIELDS
            for i, v in enumerate(vals):
                if v is None:
                    if not (wp and i < len(ot) and ot[i]) and (group, cp) not in ALLOWED_NULLS:
                        add("nulls", cp, f"row {i}")
                elif isinstance(v, str):
                    text(cp, v)
                elif wp and i < len(ot) and ot[i]:
                    add("ot_win_chance", cp, f"row {i} qtr {qtr[i]} {c}={v}")
        for i, (pt, yl) in enumerate(zip(cols.get("play_type") or [], cols.get("yardline_100") or [])):
            if pt in FG_KINDS and isinstance(yl, (int, float)) and yl + 17 > 64:
                add("fg_max", f"{p}[]", f"row {i} field goal from {yl + 17} yards")

    def walk(o: Any, p: str, parent: dict[str, Any] | None, key: str | None) -> None:
        if isinstance(o, dict) and isinstance(o.get("cols"), dict) and o["cols"] \
                and all(isinstance(v, list) for v in o["cols"].values()):
            columns(p + ".cols", o["cols"])
            o = {k: v for k, v in o.items() if k != "cols"}
        if isinstance(o, dict):
            record(p, o)
            for k, v in _rows(o):
                sk = str(k)
                is_id, banned = _key_info(sk)
                if banned:
                    add("banned_keys", p, sk)
                if k == "cols" and isinstance(o.get("cols"), list):
                    for c in o["cols"]:
                        if "play_id" in c or set(c.lower().split("_")) & BANNED_TOKENS:
                            add("banned_keys", p, f"column {c}")
                    continue
                m = "|" in sk and re.match(r"^\d{4}_\d\d_[A-Z]+_[A-Z]+\|(\d+)\|", sk)  # 'game|qtr|clock|team'
                if m and int(m.group(1)) >= 5 and v is not None and p.endswith("by_try"):
                    add("ot_win_chance", p, f"{sk} = {v}")
                walk(v, f"{p}.{'*' if is_id else sk}", o, sk)
        elif isinstance(o, list):
            for v in o:
                walk(v, p + "[]", None, key)
        elif o is None:
            in_ot = parent is not None and key in WP_FIELDS and isinstance(_qtr(parent), int) and _qtr(parent) >= 5
            if not in_ot and (group, p) not in ALLOWED_NULLS:
                add("nulls", p, "null")
        elif isinstance(o, str):
            text(p, o)

    walk(json.loads(path.read_text()), "$", None, None)
    if group == "fourth_down":  # grid cells: options [go, fg, punt]; fg must be null past the 47 (64-yard try)
        g = json.loads(path.read_text())
        if "fg" in g.get("options", []):
            fi = g["options"].index("fg")
            for i, c in enumerate(g.get("cells", [])):
                if c and c[fi] is not None and (i % 99) + 1 + 17 > 64:
                    add("fg_max", "$.cells", f"cell {i} offers a field goal from {(i % 99) + 18} yards")
    return dict(found)


def findings(check: str, group: str) -> list[str]:
    out = []
    for f in files_by_group()[group]:
        for e in scan(f, group).get(check, []):
            out.append(f"{rel(f)} {e}")
    return out


def _params(checks: list[str]) -> list[Any]:
    ps = []
    for c in checks:
        for g, _, owner in GROUPS:
            marks = [pytest.mark.xfail(reason=DEFERRED[(c, g)], strict=False)] if (c, g) in DEFERRED else []
            ps.append(pytest.param(c, g, marks=marks, id=f"{c}-{g}"))
    return ps


def _fmt(items: list[str]) -> str:
    return f"{len(items)} finding(s), e.g.\n  " + "\n  ".join(items[:5])


# ---------- tests ----------

def test_every_data_file_has_one_group():
    member = {g: set(fs) for g, fs in files_by_group().items()}
    for f in all_data_files():
        hits = [g for g in member if f in member[g]]
        assert len(hits) == 1, f"{rel(f)} matches {hits}; add it to GROUPS with its owner"
    assert set(DEFERRED) <= {(c, g) for c in CHECKS for g in OWNER}
    assert all(OWNER[g] == DM for _, g in DEFERRED), "builders-lane findings get fixed, not deferred"
    owners = {n: o for n, o, _ in COUNT_CHECKS}
    assert all(owners[n] == DM for n in DEFERRED_COUNTS), "builders-lane count findings get fixed, not deferred"


@pytest.mark.parametrize("check,group", _params(CHECKS))
def test_audit(check: str, group: str):
    if not files_by_group()[group]:
        pytest.skip(f"no {group} files here (per-game files come from the games release asset)")
    items = findings(check, group)
    assert not items, f"{check} in {group} ({OWNER[group]}): {_fmt(items)}"


@pytest.mark.parametrize("src,copy", COPIES, ids=[c for _, c in COPIES])
def test_frontend_copy_is_byte_identical(src: str, copy: str):
    s, c = ROOT / src, ROOT / copy
    if s.is_dir():
        names = sorted(p.name for p in s.glob("*.json"))
        assert names and names == sorted(p.name for p in c.glob("*.json")), f"{copy} file list differs from {src}"
        bad = [n for n in names if (s / n).read_bytes() != (c / n).read_bytes()]
    else:
        bad = [] if s.read_bytes() == c.read_bytes() else [c.name]
    assert not bad, f"{copy} differs from {src}: {bad}"


def test_every_story_and_lib_site_file_has_a_source():
    paired = {c for _, c in COPIES}
    for d in ("frontend/public/data/stories", "frontend/lib/site"):
        for p in sorted((ROOT / d).glob("*.json")):
            assert rel(p) in paired or p.name == "fakesText.json", f"{rel(p)} has no data/site source in COPIES"


# ---------- nflverse counts ----------

def pbp_dir() -> Path:
    return Path(os.environ.get("NFL_PBP_DIR") or os.environ.get("FOURTH_PBP_DIR")
                or "/workspace/nfl-research/mining/data")


def truth_from_parquets(d: Path) -> dict[str, Any]:
    import pyarrow as pa
    import pyarrow.parquet as pq

    paths = [d / f"pbp_{s}.parquet" for s in SEASONS]
    cols = ["game_id", "season", "week", "season_type", "home_score", "away_score", "qtr", "play_type",
            "two_point_attempt", "extra_point_result"]
    t = pa.concat_tables([pq.read_table(p, columns=cols) for p in paths]).to_pydict()
    games: dict[str, list] = {}
    totals = {str(s): {"punts": 0, "two_point_attempts": 0, "extra_points": 0, "extra_points_good": 0} for s in SEASONS}
    for i, g in enumerate(t["game_id"]):
        row = games.setdefault(g, [g, t["season"][i], t["week"][i], t["season_type"][i], int(t["home_score"][i]),
                                   int(t["away_score"][i]), 0])
        row[6] = max(row[6], int(t["qtr"][i]))
        tot = totals[str(t["season"][i])]
        tot["punts"] += t["play_type"][i] == "punt"
        tot["two_point_attempts"] += t["two_point_attempt"][i] == 1
        tot["extra_points"] += t["play_type"][i] == "extra_point"
        tot["extra_points_good"] += t["play_type"][i] == "extra_point" and t["extra_point_result"][i] == "good"
    return {"source": "nflverse play-by-play 2019-2025 (CC BY 4.0), one row per game; max_qtr >= 5 is overtime",
            "cols": ["game_id", "season", "week", "season_type", "home_score", "away_score", "max_qtr"],
            "games": sorted(games.values()), "totals": totals}


@functools.lru_cache(maxsize=None)
def truth() -> dict[str, Any]:
    t = json.loads(FIXTURE.read_text())
    t["by_id"] = {r[0]: dict(zip(t["cols"], r)) for r in t["games"]}
    return t


def test_truth_fixture_matches_nflverse_parquets():
    d = pbp_dir()
    if not all((d / f"pbp_{s}.parquet").exists() for s in SEASONS):
        pytest.skip(f"nflverse pbp parquets not in {d} (CI); the committed fixture is used")
    assert truth_from_parquets(d) == json.loads(FIXTURE.read_text())


def _site(name: str) -> dict[str, Any]:
    return json.loads((ROOT / "data/site" / name).read_text())


def _zip(d: dict[str, Any], key: str) -> list[dict[str, Any]]:
    return [dict(zip(d["cols"], r)) for r in d[key]]


def _season_ids(s: int) -> set[str]:
    return {g for g, r in truth()["by_id"].items() if r["season"] == s}


def _unknown(ids) -> list[str]:
    return sorted(set(ids) - set(truth()["by_id"]))


def _score_ot(gid: str, home: int, away: int, ot: bool) -> list[str]:
    r = truth()["by_id"][gid]
    bad = [] if (home, away) == (r["home_score"], r["away_score"]) else [f"{gid} score {home}-{away}"]
    return bad + ([] if ot == (r["max_qtr"] >= 5) else [f"{gid} ot={ot}"])


def c_charts() -> list[str]:
    bad = []
    for s in SEASONS:
        games = json.loads((ROOT / f"data/site/charts/{s}.json").read_text())["games"]
        if {g["gameId"] for g in games} != _season_ids(s):
            bad.append(f"charts/{s}: {len(games)} games vs nflverse {len(_season_ids(s))}")
        bad += [e for g in games if g["gameId"] in truth()["by_id"]
                for e in _score_ot(g["gameId"], g["homeScore"], g["awayScore"], g["ot"])]
    return bad


def c_drives() -> list[str]:
    return [f"drives/{s}: game set differs from nflverse" for s in SEASONS
            if set(json.loads((ROOT / f"data/site/drives/{s}.json").read_text())["games"]) != _season_ids(s)]


def c_onthisday() -> list[str]:
    o = _site("onthisday.json")
    rows = [dict(zip(o["cols"], r)) for v in o["days"].values() for r in v]
    bad = [] if len(rows) == len(truth()["by_id"]) and {r["game_id"] for r in rows} == set(truth()["by_id"]) \
        else [f"onthisday: {len(rows)} rows vs nflverse {len(truth()['by_id'])} games"]
    return bad + [e for r in rows if r["game_id"] in truth()["by_id"]
                  for e in _score_ot(r["game_id"], r["home_score"], r["away_score"], r["ot"])]


def c_comebacks() -> list[str]:
    c = _site("comebacks.json")
    decided = sum(r["home_score"] != r["away_score"] for r in truth()["by_id"].values())
    bad = [] if c["decided_games"] == decided == len(c["lows"]) else \
        [f"comebacks: decided_games {c['decided_games']}, lows {len(c['lows'])}, nflverse non-tie games {decided}"]
    for r in _zip(c, "top"):
        t = truth()["by_id"].get(r["game_id"])
        if not t:
            bad.append(f"{r['game_id']} not in nflverse")
            continue
        if sorted([r["winner_score"], r["loser_score"]]) != sorted([t["home_score"], t["away_score"]]) \
                or r["ot"] != (t["max_qtr"] >= 5):
            bad.append(f"{r['game_id']} score/ot")
    return bad


def c_weather() -> list[str]:
    w = _site("weather.json")
    return ([f"weather: unknown {_unknown(list(w['games']) + w['indoors'])[:3]}"] if _unknown(list(w["games"]) + w["indoors"])
            else []) + ([] if not set(w["games"]) & set(w["indoors"]) else ["weather: game both outdoors and indoors"])


def c_swings() -> list[str]:
    sw = _site("swings.json")
    weeks = {f"{r['season']}-w{r['week']:02d}" for r in truth()["by_id"].values()}
    bad = [] if set(sw["weeks"]) == weeks else [f"swings: {len(sw['weeks'])} weeks vs nflverse {len(weeks)}"]
    for k, v in sw["weeks"].items():
        t = truth()["by_id"].get(v["game_id"])
        if not t or f"{t['season']}-w{t['week']:02d}" != k:
            bad.append(f"swings {k}: {v['game_id']} is not a game of that week")
    return bad


def c_fakes() -> list[str]:
    f = _site("fakes.json")
    punts = sum(t["punts"] for t in truth()["totals"].values())
    bad = [] if f["count"] == len(f["plays"]) == sum(f["by_season"].values()) else ["fakes: count/by_season/plays"]
    bad += [] if f["punt_count"] == punts else [f"fakes: punt_count {f['punt_count']} vs nflverse {punts}"]
    return bad + [f"fakes: unknown {g}" for g in _unknown(p["game_id"] for p in f["plays"] + f["real_punts"])]


def c_twopoint() -> list[str]:
    t = _site("twopoint.json")
    n = sum(x["two_point_attempts"] for x in truth()["totals"].values())
    xp = [sum(x[k] for x in truth()["totals"].values()) for k in ("extra_points", "extra_points_good")]
    bad = [] if t["two_point"]["tries"] == len(t["tries"]) == n else \
        [f"twopoint: {t['two_point']['tries']} tries, {len(t['tries'])} rows vs nflverse {n}"]
    mine = [t["extra_point"]["tries"], t["extra_point"]["made"]]
    bad += [] if mine == xp else [f"twopoint: extra points tries/made {mine} vs nflverse {xp}"]
    bad += [] if len(t["per_choice_win_chance"]["by_try"]) == n else ["twopoint: by_try size"]
    return bad + [f"twopoint: unknown {g}" for g in _unknown(r["game_id"] for r in _zip(t, "tries") + _zip(t, "kicks"))]


def c_firstdown() -> list[str]:
    f = _site("firstdown.json")
    bad = [] if f["eligible"] == sum(v["plays"] for v in f["seasons"].values()) else ["firstdown: eligible"]
    return bad + [f"firstdown: unknown {g}" for g in _unknown(r["game_id"] for r in _zip(f, "plays"))]


def c_goalline() -> list[str]:
    g = _site("goalline.json")
    r = g["rates"]
    bad = [] if r["tries"] == r["run"]["tries"] + r["pass"]["tries"] and r["went"] == r["tries"] <= r["chances"] \
        else ["goalline: rates do not add up"]
    return bad + [f"goalline: unknown {x}" for x in _unknown(s["game_id"] for s in _zip(g, "stops"))]


def c_player_names() -> list[str]:
    f, pn = _site("fakes.json"), _site("player_names.json")
    keys = {f"{p['game_id']}|{p['qtr']}|{p['clock']}|{p['team']}" for p in f["plays"] + f["real_punts"]}
    bad = [] if set(pn["plays"]) == keys else [f"player_names: {len(pn['plays'])} plays vs fakes {len(keys)}"]
    ids = {i for m in pn["plays"].values() for i in m.values()}
    bad += [] if ids <= set(pn["names"]) else [f"player_names: {len(ids - set(pn['names']))} ids without a name"]
    return bad + [f"player_names_game: unknown {g}" for g in _unknown(k.split("|")[0] for k in _site("player_names_game.json")["plays"])]


def c_players() -> list[str]:
    bad = []
    for p in sorted((ROOT / "frontend/public/data/players").glob("*.json")):
        bad += [f"{p.name}: unknown {g}" for g in _unknown(s["game_id"] for s in json.loads(p.read_text())["swings"])]
    return bad


def c_aggregates() -> list[str]:
    bad = []
    for n, key in (("calib.json", None), ("era.json", None), ("fg_rates.json", "seasons"), ("comebacks.json", "season_list"),
                   ("onthisday.json", "season_list"), ("goalline.json", "season_list"), ("weather.json", "season_list"),
                   ("fakes.json", "season_list"), ("twopoint.json", "season_list")):
        if key and _site(n)[key] != SEASONS:
            bad.append(f"{n}: {key} {_site(n)[key]}")
    era = [s["season"] for s in _site("era.json")["seasons"]]
    bad += [] if era == SEASONS else [f"era.json seasons {era}"]
    fg = _site("fg_rates.json")
    bad += [] if len(fg["yards"]["all"]) == fg["maxYards"] - fg["minYards"] + 1 else ["fg_rates: yards rows"]
    return bad


def c_games_index() -> list[str]:
    bad = []
    for s in SEASONS:
        games = json.loads((ROOT / f"frontend/public/data/games/{s}.json").read_text())["games"]
        if {g["id"] for g in games} != _season_ids(s):
            bad.append(f"games/{s}.json: {len(games)} games vs nflverse {len(_season_ids(s))}")
        bad += [e for g in games if g["id"] in truth()["by_id"]
                for e in _score_ot(g["id"], g["home_score"], g["away_score"], g["overtime"])]
    return bad


def c_game_files() -> list[str]:
    fs = files_by_group()["game_files"]
    if not fs:
        pytest.skip("per-game files not fetched (scripts/pages/game_files_release.sh fetch)")
    bad = [] if {p.stem for p in fs} == set(truth()["by_id"]) else [f"game files: {len(fs)} vs nflverse {len(truth()['by_id'])}"]
    for p in fs:
        g = json.loads(p.read_text())["game"]
        if g["id"] in truth()["by_id"]:
            bad += _score_ot(g["id"], g["home_score"], g["away_score"], g["overtime"])
    return bad


def c_dm_refs() -> list[str]:
    bad = []
    for p in sorted((ROOT / "frontend/public/data/coaches/calls").glob("*.json")):
        bad += [f"{p.name}: unknown {g}" for g in _unknown(c["game_id"] for c in json.loads(p.read_text())["calls"])]
    for p in sorted((ROOT / "frontend/public/data/packs").glob("*.json")):
        bad += [f"{p.name}: unknown {g}" for g in _unknown(i["source"]["game_id"] for i in json.loads(p.read_text())["items"])]
    return bad


COUNT_CHECKS: list[tuple[str, str, Callable[[], list[str]]]] = [
    ("charts", B, c_charts), ("drives", B, c_drives), ("onthisday", B, c_onthisday), ("comebacks", B, c_comebacks),
    ("weather", B, c_weather), ("swings", B, c_swings), ("fakes", B, c_fakes), ("twopoint", B, c_twopoint),
    ("firstdown", B, c_firstdown), ("goalline", B, c_goalline), ("player_names", B, c_player_names),
    ("players", B, c_players), ("aggregates", B, c_aggregates),
    ("games_index", DM, c_games_index), ("game_files", DM, c_game_files), ("coaches_packs_refs", DM, c_dm_refs),
]


# Known count findings in other lanes' files: name -> reason. xfail, not strict.
DEFERRED_COUNTS: dict[str, str] = {
    "games_index": "NFL Data & Models: 2021_12_LV_DAL has overtime false; nflverse pbp has an OT period (LV won 36-33 in OT)",
    "game_files": "NFL Data & Models: 2021_12_LV_DAL game.overtime is false; nflverse pbp has an OT period",
}


@pytest.mark.parametrize("name,owner,fn", [
    pytest.param(n, o, f, id=n, marks=[pytest.mark.xfail(reason=DEFERRED_COUNTS[n], strict=False)] if n in DEFERRED_COUNTS else [])
    for n, o, f in COUNT_CHECKS])
def test_counts_match_nflverse(name: str, owner: str, fn: Callable[[], list[str]]):
    bad = fn()
    assert not bad, f"{name} ({owner}): {_fmt(bad)}"


# ---------- CLI: findings report / fixture ----------

def main(argv: list[str]) -> int:
    if "--write-fixture" in argv:
        FIXTURE.write_text(json.dumps(truth_from_parquets(pbp_dir()), separators=(",", ":")) + "\n")
        print(f"wrote {FIXTURE}")
        return 0
    for c in CHECKS:
        for g, _, owner in GROUPS:
            items = findings(c, g)
            if items:
                state = "DEFERRED" if (c, g) in DEFERRED else "OPEN"
                print(f"[{state}] {c} / {g} ({owner}): {_fmt(items)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
