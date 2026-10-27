#!/usr/bin/env python3
"""Acceptance checks from creative-builds.md "House rules" that apply to features already
on the site (daily quiz, 4th-down page, Game Story / games).

  python3 scripts/acceptance/house_rules.py SITE_JSON BUILT_SITE_DIR

  1. Words: no "EPA", "WPA" or "xpass" on fan screens.
  2. No betting: no odds formats, lines or stakes language.
  3. Data filter: the bad 2019_03_CIN_BUF game never ships in site data.
  4. No team logos in the built site, except the self-hosted team logos/wordmarks listed in
     teams/manifest.json (teams/<ABBR>/logo.png, wordmark.png) and <img> tags pointing at /teams/.
     Any external image (img src/srcset, SVG <image href>, CSS url() over http(s): or //) fails.
  5. Daily-game FG cap: no kick offered over 64 yd (quiz + 4th-down scenarios;
     kick distance = yardline_100 + 18, as in the engine since #64).
Prints every failure, exits 1 if any.
"""
import html, json, os, re, sys

FAN_JARGON = re.compile(r"\b(EPA|WPA|xpass|xPass|CPOE)\b")
# Odds-style numbers only: a signed whole number >= 100 (no decimals) next to an
# odds/line/ML/spread word, or a moneyline pair like "-150 / +130". Plain signed
# coach values (+293.5, -136 in "coach value" text) are not odds.
_ODDS_NUM = r"(?<![\w.])[+\-\u2212]\d{3,}(?![\d.,]|\s*(?:yd|yards|%))"
_ODDS_WORD = r"(?:odds|line|ML|spread)"
BETTING = re.compile(
    r"\b(moneyline|money line|point spread|parlay|sportsbook|wager\w*|bet(s|ting|tor)?|bookie|"
    r"over/under|vig|juice|stakes?|odds-on)\b"
    rf"|\b{_ODDS_WORD}\b(?:\s+(?:is|was|at|of))?\W{{0,3}}{_ODDS_NUM}"
    rf"|{_ODDS_NUM}\s*\(?{_ODDS_WORD}\b"
    rf"|{_ODDS_NUM}\s*/\s*{_ODDS_NUM}",
    re.I,
)
BAD_GAME = "2019_03_CIN_BUF"
MAX_FG = 64
FG_SNAP_YARDS = 18  # mirrors nfl_sim.models.fourth_down_empirics.FG_SNAP_YARDS (standalone script)
fails: list[str] = []


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
    page = re.sub(r"<(script|style|noscript|template)\b.*?</\1>", " ", page, flags=re.S | re.I)
    page = re.sub(r"<head\b.*?</head>", " ", page, flags=re.S | re.I)
    return html.unescape(re.sub(r"<[^>]+>", " ", page))


def scan(text: str, where: str) -> None:
    for rx, what in ((FAN_JARGON, "stat jargon"), (BETTING, "betting language")):
        m = rx.search(text)
        if m:
            s = max(0, m.start() - 30)
            fail_ctx = " ".join(text[s:m.end() + 30].split())
            fails.append(f"{what}: {where} shows {m.group(0)!r} in \"…{fail_ctx}…\"")


# Logo ban exception (approved by Garrett, 2026-10-27, PR #125): the self-hosted team logos and
# wordmarks under teams/<ABBR>/ that are listed in teams/manifest.json may ship, and <img> tags may
# point at a same-site /teams/ path. Every other logo file or logo <img> in the built site still fails.
TEAM_FILE = re.compile(r"^teams/[A-Z]{2,3}/(logo|wordmark)\.png$")
LOGO_IMG = re.compile(r"<img[^>]+(logo|teamlogo)[^>]*>", re.I)
# Same-site path only: no scheme, no protocol-relative //. An optional basePath prefix
# (e.g. /nfl-analytics-simulator/teams/KC/logo.png) is fine.
TEAMS_IMG_SRC = re.compile(
    r"""\ssrc=["'](?:/[A-Za-z0-9._-]+)*/teams/[A-Z]{2,3}/(logo|wordmark)\.png["']""")

# No external images at all: <img src/srcset>, <source srcset>, SVG <image href/xlink:href>,
# and CSS url() pointing at http(s): or protocol-relative //. (Fonts in CSS url() are not images.)
_EXT = r"""\s*(?:https?:)?//"""
EXT_IMG_ATTR = re.compile(rf"""<img\b[^>]*?\ssrc\s*=\s*["']?{_EXT}[^>]*>""", re.I)
EXT_SRCSET = re.compile(r"""<(?:img|source)\b[^>]*?\ssrcset\s*=\s*["']([^"']*)["'][^>]*>""", re.I)
EXT_SVG_IMAGE = re.compile(rf"""<image\b[^>]*?\s(?:xlink:)?href\s*=\s*["']?{_EXT}[^>]*>""", re.I)
EXT_CSS_URL = re.compile(rf"""url\(\s*["']?{_EXT}([^)"']*)["']?\s*\)""", re.I)
FONT_EXT = re.compile(r"\.(woff2?|ttf|otf|eot)(?:[?#][^)]*)?$", re.I)


def manifest_files(site: str) -> set[str]:
    p = os.path.join(site, "teams", "manifest.json")
    if not os.path.exists(p):
        return set()
    teams = json.load(open(p)).get("teams", {})
    return {e[k]["path"].lstrip("/") for e in teams.values() for k in ("logo", "wordmark") if k in e}


def logo_file_allowed(rel: str, allowed: set[str]) -> bool:
    rel = rel.replace(os.sep, "/")
    return bool(TEAM_FILE.match(rel)) and rel in allowed


def bad_logo_imgs(page: str) -> list[str]:
    return [m.group(0) for m in LOGO_IMG.finditer(page) if not TEAMS_IMG_SRC.search(m.group(0))]


def external_images(text: str) -> list[str]:
    """Every external image reference in an HTML page or CSS file."""
    out = [m.group(0) for m in EXT_IMG_ATTR.finditer(text)]
    out += [m.group(0) for m in EXT_SVG_IMAGE.finditer(text)]
    for m in EXT_SRCSET.finditer(text):
        if any(re.match(_EXT, c.strip().split(" ")[0] if c.strip() else "x") for c in m.group(1).split(",")):
            out.append(m.group(0))
    out += [m.group(0) for m in EXT_CSS_URL.finditer(text) if not FONT_EXT.search(m.group(1))]
    return out


def main() -> int:
    data = json.load(open(sys.argv[1]))
    site = sys.argv[2]
    skip = {"id", "game_id", "play_id", "home_team", "away_team", "posteam", "defteam",
            "possession_team_id", "home_team_id", "away_team_id", "transition_mode", "empirics_mode"}

    # Text the UI renders from data.
    for it in data["quiz"]["items"]:
        for s in strings({k: it.get(k) for k in ("label", "reveal")}, skip | {"values"}):
            scan(s, f"quiz item {it['id']}")
    for sc in data["scenarios"]:
        for s in strings(sc, skip):
            scan(s, f"4th-down scenario {sc['id']}")
    for p in data["plays"] + data["wpPoints"]:
        if p.get("description"):
            scan(p["description"], f"play {p['game_id']}#{p.get('play_index')}")

    # Built pages (visible text only; redirect stubs skipped).
    allowed = manifest_files(site)
    for root, _, files in os.walk(site):
        for f in files:
            path, rel = os.path.join(root, f), os.path.relpath(os.path.join(root, f), site)
            if re.search(r"logo", f, re.I) and not logo_file_allowed(rel, allowed):
                fails.append(f"logo: built site ships {rel}")
            if not f.endswith((".html", ".css")):
                continue
            page = open(path, encoding="utf-8", errors="replace").read()
            for ref in external_images(page)[:3]:
                fails.append(f"external image: /{rel} loads {ref[:120]!r}")
            if not f.endswith(".html"):
                continue
            if bad_logo_imgs(page):
                fails.append(f"logo: /{rel} renders a logo image")
            if 'http-equiv="refresh"' not in page:
                scan(visible_text(page), f"page /{rel}")

    # Bad CIN@BUF game never ships.
    blob = json.dumps(data)
    if BAD_GAME in blob:
        fails.append(f"data filter: site data contains {BAD_GAME} (bad 'End of half' row)")

    # Daily game never offers a kick over 64 yd.
    for it in data["quiz"]["items"]:
        if "fg" in (it.get("reveal") or {}).get("values", {}) and it["situation"]["yardline_100"] + FG_SNAP_YARDS > MAX_FG:
            fails.append(f"FG cap: quiz item {it['id']} offers a {it['situation']['yardline_100'] + FG_SNAP_YARDS}-yd kick")
    for sc in data["scenarios"]:
        if any(o["id"] == "fg" for o in sc["options"]) and sc["situation"]["yardline_100"] + FG_SNAP_YARDS > MAX_FG:
            fails.append(f"FG cap: 4th-down scenario {sc['id']} offers a {sc['situation']['yardline_100'] + FG_SNAP_YARDS}-yd kick")

    for f in fails:
        print("FAIL", f)
    print(f"{len(fails)} house-rule failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
