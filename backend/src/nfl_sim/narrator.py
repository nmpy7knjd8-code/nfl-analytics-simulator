"""Deterministic Game Story narrator: one sentence (≤25 words) per swing play.

`facts(row)` derives every value a sentence may use from ONE play row of
games/{id}.json (plus the game's home/away ids carried on the row). Templates only
interpolate those facts, so a sentence can never cite anything outside the row.
No model text, no randomness.
"""
from __future__ import annotations

import re
from typing import Any

MAX_WORDS = 25
QTR = {1: "the first quarter", 2: "the second quarter", 3: "the third quarter", 4: "the fourth quarter"}


def facts(row: dict[str, Any]) -> dict[str, str]:
    team = row.get("posteam") or ""
    home, away = row["home"], row["away"]
    before, after = row["home_wp"], row["home_wp_after"]
    gainer = home if after >= before else away
    q = int(row["qtr"])
    return {
        "team": team,
        "opp": (away if team == home else home) if team else "",
        "gainer": gainer,
        "clock": row.get("clock") or "",
        "period": QTR.get(q, "overtime"),
        "swing": str(round(abs(after - before) * 100)),
        "gainer_wp": str(round((after if gainer == home else 1 - after) * 100)),
        "togo": str(row.get("ydstogo") or ""),
        "score": f"{row['home_score']}-{row['away_score']}" if row.get("home_score") is not None else "",
    }


def _kind(row: dict[str, Any]) -> str:
    t = (row.get("text") or "").upper()
    pt = row.get("play_type")
    if "INTERCEPTED" in t:
        return "interception"
    if "FUMBLES" in t and "RECOVERED BY" in t and pt in ("pass", "run"):
        return "fumble"
    if "TOUCHDOWN" in t and pt in ("pass", "run"):
        return "td"
    if pt == "field_goal":
        return "fg_good" if "IS GOOD" in t else "fg_miss"
    if pt == "punt":
        return "punt"
    if row.get("down") == 4 and pt in ("pass", "run"):
        return "fourth_go"
    return "play"


TEMPLATES = {
    "td": "{team} scored a touchdown with {clock} left in {period}, a {swing}-point swing toward {gainer}.",
    "interception": "{opp} intercepted {team} with {clock} left in {period}, a {swing}-point swing toward {gainer}.",
    "fumble": "A {team} fumble with {clock} left in {period} swung win chances {swing} points toward {gainer}.",
    "fg_good": "{team}'s field goal with {clock} left in {period} moved {gainer} to {gainer_wp}% to win.",
    "fg_miss": "{team} came away empty on a field goal try with {clock} left in {period}; {gainer} rose to {gainer_wp}%.",
    "punt": "A {team} punt with {clock} left in {period} swung win chances {swing} points toward {gainer}.",
    "fourth_go": "{team} went for it on fourth and {togo} with {clock} left in {period}; {gainer} moved to {gainer_wp}%.",
    "play": "With {clock} left in {period}, one {team} play swung win chances {swing} points toward {gainer}.",
}


def sentence(row: dict[str, Any]) -> str:
    return TEMPLATES[_kind(row)].format(**facts(row))


def story(rows: list[dict[str, Any]], *, min_sentences: int = 3, max_sentences: int = 5) -> list[str]:
    """3–5 sentences: the biggest swings, told in game order."""
    swings = [r for r in rows if r.get("swing") and r.get("home_wp") is not None and r.get("home_wp_after") is not None]
    if len(swings) < min_sentences:
        extra = sorted((r for r in rows if r not in swings and r.get("home_wp") is not None
                        and r.get("home_wp_after") is not None and r.get("posteam")),
                       key=lambda r: -abs(r["home_wp_after"] - r["home_wp"]))
        swings += extra[: min_sentences - len(swings)]
    top = sorted(swings, key=lambda r: (-abs(r["home_wp_after"] - r["home_wp"]), r["play_id"]))[:max_sentences]
    order = {id(r): i for i, r in enumerate(rows)}
    return [sentence(r) for r in sorted(top, key=lambda r: order[id(r)])]


def words(s: str) -> int:
    return len(re.findall(r"\S+", s))
