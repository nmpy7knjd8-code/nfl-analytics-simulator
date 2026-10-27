#!/usr/bin/env python3
"""C7 acceptance tests (redesign brief): what the site shows must be true.

  python3 scripts/acceptance/check.py SITE_JSON [BUILT_SITE_DIR]

SITE_JSON comes from dump_site_data.ts. Checks:
  1. schedule truth: every game's teams/week/date/score == nflverse schedule
  2. every game id referenced anywhere exists in nflverse
  3. no FG offered/valued past 64 yd (yardline_100 + 18, as in the engine since #64)
  4. every clock is a 0:00-15:00 quarter clock
  5. every team code is a real NFL code
  6. built HTML has no developer text; /quiz/ and /demo/games/ are redirect pages
  7. QA2 guards on text the user sees (quiz + 4th-down copy, and the visible text of
     every built page): no placeholder teams (OFF/DEF/HOME/AWAY, Team A, "Offense vs
     Defense"), no play ids / game ids, no bare "WP" label, no "Offline curated", no
     model jargon. JSON keys and URLs are not shown, so they are not scanned.
Prints every failure, exits 1 if any.
"""
import csv, io, json, os, re, sys, urllib.request

SCHEDULE_URL = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
MAX_FG = 64
DEV_TEXT = ["POST ", "play_id", "yardline_100", "isotonic", "apiHook", "not on main",
            "sibling API", "localhost:", "TODO", "Path A", "uncalibrated"]
fails: list[str] = []

# QA2 guards. Case-sensitive on purpose: "home team" / "the offense" are fine copy,
# but an all-caps OFF/HOME token or "Team A" is a placeholder.
PLACEHOLDER_RES = [
    (re.compile(r"(?<![A-Za-z])(OFF|DEF|HOME|AWAY|OPP|POS)(?![A-Za-z])"), "placeholder team code"),
    (re.compile(r"\bTeam [A-Z12]\b"), "placeholder team name"),
    (re.compile(r"\b(Offense|Home|Away) vs\.? (Defense|Away|Home)\b"), "placeholder matchup"),
]
SHOWN_DEV_RES = [
    (re.compile(r"\bWP\b"), "bare 'WP' label"),
    (re.compile(r"Offline curated", re.I), "'Offline curated'"),
    (re.compile(r"\bplay(?:_id)? ?#?\d{2,}\b"), "play id"),
    (re.compile(r"\b\d{4}_\d{2}_[A-Z]{2,3}_[A-Z]{2,3}\b"), "raw game id"),
    (re.compile(r"\b(isotonic|uncalibrated|Path A|yardline_100|empirics|mode=)", re.I), "model jargon"),
    (re.compile(r"edge ≈"), "raw edge value"),
]
# Fields the quiz / 4th-down UI renders as text.
QUIZ_SHOWN = [("label",), ("source", "note"), ("reveal", "layman_why"), ("reveal", "assumptions")]
SCENARIO_SKIP_KEYS = {"id", "offense", "defense", "clock", "href", "image", "game_id", "play_id"}


_shown: dict[tuple[str, str], list[str]] = {}


def shown_text_checks(text: str, where: str, group: str | None = None) -> None:
    """Collect hits grouped by (where-kind, rule) so 365 quiz items give one line, not 365."""
    for rx, what in PLACEHOLDER_RES + SHOWN_DEV_RES:
        m = rx.search(text)
        if m:
            s = max(0, m.start() - 30)
            ctx = " ".join(text[s:m.end() + 30].split())
            _shown.setdefault((group or where, what), []).append(f"{where}: {m.group(0)!r} in \"…{ctx}…\"")


def flush_shown() -> None:
    for (group, what), hits in _shown.items():
        more = f" (+{len(hits) - 3} more)" if len(hits) > 3 else ""
        fail(f"shown text: {group} has {what} in {len(hits)} place(s): " + " | ".join(hits[:3]) + more)


def strings(obj, skip=frozenset()):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v, skip)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k not in skip:
                yield from strings(v, skip)


def visible_text(page: str) -> str:
    import html as _html
    page = re.sub(r"<(script|style|noscript|template)\b.*?</\1>", " ", page, flags=re.S | re.I)
    page = re.sub(r"<head\b.*?</head>", " ", page, flags=re.S | re.I)
    return _html.unescape(re.sub(r"<[^>]+>", " ", page))


def fail(msg: str) -> None:
    fails.append(msg)


def schedule() -> dict[str, dict]:
    raw = urllib.request.urlopen(SCHEDULE_URL, timeout=60).read().decode()
    return {r["game_id"]: r for r in csv.DictReader(io.StringIO(raw))}


def clock_ok(secs, label: str) -> None:
    if secs is None:
        return
    if not 0 <= secs <= 900:
        fail(f"clock: {label} shows {int(secs)//60}:{int(secs)%60:02d} ({secs}s into a quarter clock, must be 0:00-15:00)")


def qsec_from_game(q, gsr):
    return None if gsr is None or not q or q > 4 else gsr - (4 - q) * 900


def qsec_from_half(q, hsr):
    return None if hsr is None or not q or q > 4 else (hsr - 900 if q % 2 else hsr)


def main() -> int:
    data = json.load(open(sys.argv[1]))
    site = sys.argv[2] if len(sys.argv) > 2 else None
    sched = schedule()
    teams = {r["home_team"] for r in sched.values()} | {r["away_team"] for r in sched.values()}

    def team(code, where):
        if code not in teams:
            fail(f"team code: {where} uses {code!r}, not an NFL team code")

    for g in data["games"]:
        gid = g["game_id"]
        s = sched.get(gid)
        if not s:
            fail(f"schedule: game {gid} does not exist in nflverse")
            continue
        for ours, theirs in [("season", "season"), ("week", "week"), ("game_date", "gameday"),
                             ("home_team_id", "home_team"), ("away_team_id", "away_team"),
                             ("home_score", "home_score"), ("away_score", "away_score")]:
            if str(g.get(ours)) != str(s[theirs]):
                fail(f"schedule: {gid} {ours}={g.get(ours)!r}, nflverse says {s[theirs]!r}")
    for gid in set(data["wpGameIds"]) | {p["game_id"] for p in data["plays"]}:
        if gid not in sched:
            fail(f"schedule: chart/plays reference game {gid}, which does not exist in nflverse")

    for p in data["plays"]:
        clock_ok(qsec_from_half(p.get("quarter"), p.get("half_seconds_remaining")), f"play {p['game_id']}#{p['play_index']}")
        team(p.get("possession_team_id"), f"play {p['game_id']}#{p['play_index']}")
    for p in data["wpPoints"]:
        clock_ok(qsec_from_game(p.get("quarter"), p.get("game_seconds_remaining")), f"chart point {p['game_id']}#{p['play_index']}")

    # House rule: no overtime win chance ships (lines stop at the end of regulation).
    for p in data["wpPoints"]:
        if p.get("is_overtime") or (p.get("quarter") or 0) > 4:
            fail(f"overtime: chart point {p['game_id']}#{p['play_index']} ships an OT win chance")

    for sc in data["scenarios"]:
        s = sc["situation"]
        for t in (s["offense"], s["defense"]):
            team(t, f"4th-down scenario {sc['id']}")
        m = re.fullmatch(r"(\d+):(\d\d)", s.get("clock", ""))
        clock_ok(int(m[1]) * 60 + int(m[2]) if m else -1, f"4th-down scenario {sc['id']}")
        if any(o["id"] == "fg" for o in sc["options"]) and s["yardline_100"] + 18 > MAX_FG:
            fail(f"FG: 4th-down scenario {sc['id']} offers a {s['yardline_100'] + 18}-yd FG")

    for it in data["quiz"]["items"]:
        s, label = it["situation"], f"quiz item {it['id']}"
        for k in ("posteam", "defteam", "home_team", "away_team"):
            if k in s:
                team(s[k], label)
        q = s.get("qtr")
        qs = s.get("quarter_seconds_remaining")
        clock_ok(qs if qs is not None else qsec_from_game(q, s.get("game_seconds_remaining")), label)
        fg = (it.get("reveal") or {}).get("values", {}).get("fg")
        if fg is not None and s["yardline_100"] + 18 > MAX_FG:
            fail(f"FG: {label} values a {s['yardline_100'] + 18}-yd FG (FG win chance {fg:.3f})")
        gid = (it.get("source") or {}).get("game_id")
        if gid and gid not in sched:
            fail(f"schedule: {label} cites game {gid}, which does not exist in nflverse")

    for it in data["quiz"]["items"]:
        for keys in QUIZ_SHOWN:
            v = it
            for k in keys:
                v = v.get(k) if isinstance(v, dict) else None
            for s in strings(v):
                shown_text_checks(s, f"quiz item {it['id']}", f"quiz {'.'.join(keys)}")
    for sc in data["scenarios"]:
        for s in strings(sc, SCENARIO_SKIP_KEYS):
            shown_text_checks(s, f"4th-down scenario {sc['id']}")

    if site:
        for root, _, files in os.walk(site):
            for f in files:
                if not f.endswith(".html"):
                    continue
                path = os.path.join(root, f)
                page = open(path, encoding="utf-8", errors="replace").read()
                if 'http-equiv="refresh"' in page:
                    continue  # redirect stubs only show the target URL
                shown_text_checks(visible_text(page), f"page /{os.path.relpath(path, site)}")
        for root, _, files in os.walk(site):
            for f in files:
                if not f.endswith(".html"):
                    continue
                path = os.path.join(root, f)
                text = open(path, encoding="utf-8", errors="replace").read()
                if re.search(r'is_overtime\\?":true[^}]*home_wp|home_wp[^}]*is_overtime\\?":true', text):
                    fail(f"overtime: {os.path.relpath(path, site)} embeds an OT win-chance point")
                for needle in DEV_TEXT:
                    if needle in text:
                        fail(f"dev text: {os.path.relpath(path, site)} contains {needle!r}")
        for rel in ("quiz/index.html", "demo/games/index.html", "demo/index.html"):
            p = os.path.join(site, rel)
            if not os.path.exists(p) or 'http-equiv="refresh"' not in open(p).read():
                fail(f"redirect: /{rel.removesuffix('index.html')} is not a redirect page")

    flush_shown()
    for f in fails:
        print("FAIL", f)
    print(f"{len(fails)} acceptance failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
