"""Fan-facing one-line play text built from nflverse pbp rows (UI Critic P1-A).

Rules: no clock, formation tags, jersey numbers, tackler/pressure brackets; sentence case;
full names from row["names"] (resolved from nflverse player ids) else nflverse short names;
<= 20 words; only facts present in the row.
"""
from __future__ import annotations

import re
from typing import Any

MAX_WORDS = 20
EVENTS = ("turnover_on_downs", "interception", "fumble_lost", "touchdown", "field_goal", "punt", "other")


def _t(v: Any) -> bool:
    return bool(v) and v == v  # truthy, not NaN


def event_tag(r: dict[str, Any]) -> str:
    if _t(r.get("fourth_down_failed")) and r.get("play_type") in ("pass", "run"):
        if not _t(r.get("interception")) and not _t(r.get("fumble_lost")):
            return "turnover_on_downs"
    if _t(r.get("interception")):
        return "interception"
    if _t(r.get("fumble_lost")):
        return "fumble_lost"
    if _t(r.get("touchdown")):
        return "touchdown"
    if r.get("play_type") == "field_goal":
        return "field_goal"
    if r.get("play_type") == "punt":
        return "punt"
    return "other"


def _name(r: dict[str, Any], role: str) -> str | None:
    full = (r.get("names") or {}).get(role)
    return full or r.get(f"{role}_player_name")


def _yds(n: Any) -> str:
    n = int(n)
    return f"{n} yard" if abs(n) == 1 else f"{n} yards"


_CLOCK = re.compile(r"^\s*\(\s*\d*:\d\d\s*\)\s*")
_LEAD_TAGS = re.compile(r"^\s*\((?:[^()]*?(?:Shotgun|No Huddle|Punt formation|Field Goal formation|Run formation|Kick formation)[^()]*?)\)\s*", re.I)
_JERSEY = re.compile(r"\b\d{1,2}-(?=[A-Z])")
_PARENS = re.compile(r"\s*\([^()]*\)")
_BRACKETS = re.compile(r"\s*\[[^\]]*\]")
_CAPS = re.compile(r"\b[A-Z]{4,}\b")  # 2-3 letter team codes stay upper-case
_PENALTY = re.compile(r"PENALTY on (?:([A-Z]{2,3})-)?(?:\d{1,2}-)?([A-Z][\w.'\- ]*?)?,\s*([^,]+),\s*(\d+) yards", re.I)


def clean_desc(desc: str) -> str:
    s = _CLOCK.sub("", desc)
    while True:
        t = _LEAD_TAGS.sub("", s)
        if t == s:
            break
        s = t
    s = _JERSEY.sub("", s)
    s = re.sub(r",?\s*(Center|Holder)-[^,.]*", "", s)
    s = _BRACKETS.sub("", s)
    s = _PARENS.sub("", s)
    s = _CAPS.sub(lambda m: m.group(0).lower() if m.group(0) not in {"NFL"} else m.group(0), s)
    s = re.sub(r"\s+", " ", s).strip(" .")
    return (s[:1].upper() + s[1:] + ".") if s else s


def _fit(s: str) -> str:
    words = s.split()
    if len(words) <= MAX_WORDS:
        return s
    # Prefer whole sentences; else cut at 20 words (drops trailing detail, never adds any).
    out = ""
    for sent in re.split(r"(?<=\.)\s+", s):
        cand = (out + " " + sent).strip()
        if len(cand.split()) > MAX_WORDS:
            break
        out = cand
    if out:
        return out
    return " ".join(words[:MAX_WORDS]).rstrip(",;") + "…"


def _kickoff(r: dict[str, Any]) -> str | None:
    k = _name(r, "kicker")
    if not k:
        return None
    if _t(r.get("touchback")):
        return f"{k} kicks off for a touchback."
    ret, ry, dist = _name(r, "kickoff_returner"), r.get("return_yards"), r.get("kick_distance")
    s = f"{k} kicks off" + (f" {_yds(dist)}" if dist else "")
    if ret and ry is not None and _t(r.get("touchdown")):
        return s + f", and {ret} returns it {_yds(ry)} for a touchdown."
    if ret and ry is not None:
        return s + f", and {ret} returns it {_yds(ry)}."
    return None


def _kneel_or_spike(r: dict[str, Any]) -> str | None:
    if r.get("play_type") == "qb_spike":
        qb = _name(r, "passer")
        return f"{qb} spikes the ball to stop the clock." if qb else None
    qb, yg = _name(r, "rusher"), r.get("yards_gained")
    if not qb:
        return None
    if yg is not None and yg < 0:
        return f"{qb} kneels for a loss of {_yds(-yg)}."
    return f"{qb} kneels to run out the clock."


def _templated(r: dict[str, Any]) -> str | None:
    pt, td = r.get("play_type"), _t(r.get("touchdown"))
    yg = r.get("yards_gained")
    if pt == "kickoff":
        return _kickoff(r)
    if pt in ("qb_kneel", "qb_spike"):
        return _kneel_or_spike(r)
    if r.get("play_type") == "no_play" or _t(r.get("penalty")) and pt not in ("pass", "run"):
        return None
    if _t(r.get("interception")):
        who, qb = _name(r, "interception"), _name(r, "passer")
        if not who or not qb:
            return None
        s = f"{who} intercepts {qb}"
        ry = r.get("return_yards")
        if td and ry is not None:
            s += f" and returns it {_yds(ry)} for a touchdown"
        elif ry:
            s += f" and returns it {_yds(ry)}"
        return s + "."
    if _t(r.get("fumble_lost")):
        f, rec = _name(r, "fumbled_1"), _name(r, "fumble_recovery_1")
        if not f or not rec:
            return None
        if rec == f:
            return f"{f} fumbles and the defense recovers."
        return f"{f} fumbles and {rec} recovers."
    if pt == "pass":
        qb, wr = _name(r, "passer"), _name(r, "receiver")
        if not qb:
            return None
        if _t(r.get("sack")):
            by = _name(r, "sack")
            s = f"{qb} is sacked" + (f" by {by}" if by else "") + (f" for a loss of {_yds(-yg)}" if yg and yg < 0 else "")
        elif _t(r.get("incomplete_pass")):
            s = f"{qb} pass incomplete" + (f", intended for {wr}" if wr else "")
        elif wr and yg is not None and td:
            s = f"{qb} throws a {int(yg)}-yard touchdown pass to {wr}"
            td = False
        elif wr and yg is not None and yg < 0:
            s = f"{qb} completes a pass to {wr} for a loss of {_yds(-yg)}"
        elif wr and yg == 0:
            s = f"{qb} completes a pass to {wr} for no gain"
        elif wr and yg is not None:
            s = f"{qb} completes a pass to {wr} for {_yds(yg)}"
        else:
            return None
    elif pt == "run":
        rb = _name(r, "rusher")
        if not rb or yg is None:
            return None
        if td and yg > 0:
            s, td = f"{rb} runs {_yds(yg)} for a touchdown", False
        elif yg > 0:
            s = f"{rb} runs for {_yds(yg)}"
        elif yg < 0:
            s = f"{rb} is stopped for a loss of {_yds(-yg)}"
        else:
            s = f"{rb} is stopped for no gain"
    elif pt == "extra_point":
        k, res = _name(r, "kicker"), r.get("extra_point_result")
        word = {"good": "is good", "failed": "is no good", "blocked": "is blocked"}.get(res or "")
        return f"{k}'s extra point {word}." if k and word else None
    elif pt == "field_goal":
        k, res, dist = _name(r, "kicker"), r.get("field_goal_result"), r.get("kick_distance")
        if not k or not res or dist is None:
            return None
        word = {"made": "is good", "missed": "is no good", "blocked": "is blocked"}.get(res)
        if not word:
            return None
        return f"{k}'s {int(dist)}-yard field goal {word}."
    elif pt == "punt":
        p, dist = _name(r, "punter"), r.get("kick_distance")
        if not p or dist is None:
            return None
        s = f"{p} punts {_yds(dist)}"
        ret, ry = _name(r, "punt_returner"), r.get("return_yards")
        if ret and td and ry is not None:
            s += f", and {ret} returns it {_yds(ry)} for a touchdown"
            td = False
        elif ret and ry:
            s += f", returned {_yds(ry)} by {ret}"
    else:
        return None
    if td:
        s += " for a touchdown" if pt == "run" or pt == "pass" else ""
    if event_tag(r) == "turnover_on_downs":
        return f"Fourth down: {s}. Turnover on downs."
    return s + "."


def penalty_text(desc: str, r: dict[str, Any] | None = None) -> str | None:
    m = _PENALTY.search(desc)
    if not m:
        return None
    team, who, foul, yds = m.groups()
    full = ((r or {}).get("names") or {}).get("penalty")
    if full and who:
        who = full
    whom = f"{who} ({team})" if who and team else (who or team)
    if not whom:
        return None
    n = int(yds)
    return f"Penalty on {whom}: {foul.strip().lower()}, {n} {'yard' if n == 1 else 'yards'}. No play."


_SHORTHAND = (
    (re.compile(r"\bfor -(\d+) yards?"), lambda m: f"for a loss of {_yds(int(m.group(1)))}"),
    (re.compile(r"\bfor 0 yards?"), lambda m: "for no gain"),
    (re.compile(r"\byds?\b\.?"), lambda m: "yards"),
    (re.compile(r"\bob\b"), lambda m: "out of bounds"),
    (re.compile(r"\bTouchback\b"), lambda m: "touchback"),
    (re.compile(r"\bend zone, touchback"), lambda m: "the end zone for a touchback"),
)


def plain_english(s: str) -> str:
    """Last pass: rewrite any feed shorthand left in fallback text."""
    for pat, fn in _SHORTHAND:
        s = pat.sub(fn, s)
    return s


def display_text(r: dict[str, Any]) -> str:
    if r.get("play_type") == "no_play":
        pen = penalty_text(r.get("desc") or "", r)
        if pen:
            return _fit(pen)
    s = _fit(_templated(r) or clean_desc(r.get("desc") or ""))
    return plain_english(s) or "Play details unavailable."
