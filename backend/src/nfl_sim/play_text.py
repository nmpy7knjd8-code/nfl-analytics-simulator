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


def _two_point(r: dict[str, Any]) -> str | None:
    res, pt = r.get("two_point_conv_result"), r.get("play_type")
    ok = {"success": True, "failure": False}.get(res or "")
    if ok is None:
        return None
    end = "and it's good" if ok else "and it fails"
    qb, wr, rb = _name(r, "passer"), _name(r, "receiver"), _name(r, "rusher")
    if pt == "pass" and qb and wr:
        return f"Two-point try: {qb} passes to {wr}, {end}."
    if pt == "pass" and qb:
        return f"Two-point try: {qb} throws, {end}."
    if pt == "run" and rb:
        return f"Two-point try: {rb} runs, {end}."
    return "Two-point try is good." if ok else "Two-point try fails."


def _safety(r: dict[str, Any]) -> str | None:
    if _t(r.get("sack")) and _name(r, "passer"):
        return f"{_name(r, 'passer')} is sacked in the end zone for a safety."
    who = _name(r, "rusher") or _name(r, "passer")
    return f"{who} is tackled in the end zone for a safety." if who else None


def _kept_fumble(r: dict[str, Any], main: str) -> str | None:
    """Fumble the offense recovered (nflverse fumble=1, fumble_lost=0)."""
    f = _name(r, "fumbled_1")
    if not f:
        return None
    subj = "He" if main.startswith(f) else f
    rec, team = _name(r, "fumble_recovery_1"), r.get("posteam")
    if rec and rec == f:
        return f"{subj} fumbles but recovers."
    if rec:
        return f"{subj} fumbles, and {rec} recovers."
    if "out of bounds" in (r.get("desc") or ""):
        return f"{subj} fumbles out of bounds; {team} keeps the ball." if team else f"{subj} fumbles out of bounds."
    return f"{subj} fumbles, but {team} keeps the ball." if team else None


def _templated(r: dict[str, Any]) -> str | None:
    s = _templated_main(r)
    if s and _t(r.get("fumble")) and not _t(r.get("fumble_lost")) and r.get("play_type") in ("run", "pass"):
        extra = _kept_fumble(r, s)
        if extra:
            s = f"{s} {extra}"
    return s


def _templated_main(r: dict[str, Any]) -> str | None:
    pt, td = r.get("play_type"), _t(r.get("touchdown"))
    yg = r.get("yards_gained")
    if r.get("two_point_conv_result"):
        return _two_point(r)
    if _t(r.get("safety")) and pt in ("run", "pass"):
        return _safety(r)
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


def no_play_text(desc: str, r: dict[str, Any] | None = None) -> str | None:
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


_PEN_CLAUSE = re.compile(
    r"PENALTY on ([A-Z]{2,3})(?:-(\d{1,2})-([\w.'\-]+))?,\s*([^,]+),\s*(\d+ yards?|declined|offsetting)", re.I)
_FOUL_WORDS = {"offside on free kick": "offside on kickoff"}


_COUNT = {2: "Two", 3: "Three", 4: "Four"}


def _and(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def penalty_clauses(r: dict[str, Any], skip_first: bool = False) -> list[tuple[str, str | None, str, str]]:
    """(team, full name or None, foul in plain words, '5 yards' | 'declined' | 'offsetting') per feed penalty."""
    names = (r.get("names") or {}).get("penalties") or {}
    out = []
    for i, (team, num, _short, foul, res) in enumerate(_PEN_CLAUSE.findall(r.get("desc") or "")):
        if skip_first and i == 0:
            continue
        foul = foul.strip().lower()
        full = names.get(f"{team}-{num}") if num else None
        if not full and i == 0 and num:
            full = (r.get("names") or {}).get("penalty")
        out.append((team.upper(), full, _FOUL_WORDS.get(foul, foul), res.lower()))
    return out


def _whom(team: str, full: str | None) -> str:
    return f"{full} ({team})" if full else team


def penalty_sentences(clauses: list[tuple[str, str | None, str, str]]) -> str | None:
    """Plain sentences for penalties after a play (UI Critic P2-J / P3-H / P3-I)."""
    if not clauses:
        return None
    if len(clauses) >= 2 and all(c[3] == "offsetting" for c in clauses):
        fouls = {c[2] for c in clauses}
        if len(fouls) == 1:
            body = f"{clauses[0][2]} on " + _and([_whom(t, n) for t, n, _, _ in clauses])
        else:
            body = _and([f"{f} on {_whom(t, n)}" for t, n, f, _ in clauses])
        return f"Offsetting penalties: {body}. The down is replayed."
    out: list[str] = []
    declined: dict[str, list] = {}
    for t, n, f, res in clauses:
        if res == "declined":
            declined.setdefault(t, []).append((n, f))
        elif res == "offsetting":
            out.append(f"Penalty on {_whom(t, n)}: {f}, offsetting.")
        else:
            out.append(f"Penalty on {_whom(t, n)}: {f}, {res} against {t}.")
    for t, flags in declined.items():
        if len(flags) == 1:
            n, f = flags[0]
            out.append(f"Flag on {_whom(t, n)} for {f}, declined.")
        else:
            items = [f"{f} ({n})" if n else f for n, f in flags]
            out.append(f"{_COUNT.get(len(flags), str(len(flags)))} {t} flags declined: {_and(items)}.")
    return " ".join(out)


def penalty_text(r: dict[str, Any]) -> str | None:
    """Separate penalty field for plays that happened (None on 'No play' rows: the flag is in display_text)."""
    if marker_text(r.get("desc") or "") is not None or _is_no_play(r):
        return None
    if re.search(r"(?i)penalty", _main_text(r)):  # fallback text already carries it
        return None
    return penalty_sentences(penalty_clauses(r))


def _is_no_play(r: dict[str, Any]) -> bool:
    return r.get("play_type") == "no_play" and no_play_text(r.get("desc") or "", r) is not None


def _main_text(r: dict[str, Any]) -> str:
    return plain_english(_fit(_templated(r) or clean_desc(r.get("desc") or ""))) or "Play details unavailable."


_END_Q = re.compile(r"^END QUARTER (\d)", re.I)
_TIMEOUT = re.compile(r"^Timeout #\d by ([A-Z]{2,3})", re.I)


def marker_text(desc: str) -> str | None:
    """Game-flow rows that aren't plays (game files keep them; play lists drop them)."""
    d = desc.strip()
    if d.upper() == "GAME":
        return "Start of game."
    if d.upper().startswith("END GAME"):
        return "End of game."
    if m := _END_Q.match(d):
        return "End of overtime." if int(m.group(1)) >= 5 else f"End of quarter {m.group(1)}."
    if "Two-Minute Warning" in d:
        return "Two-minute warning."
    if m := _TIMEOUT.match(d):
        return f"Timeout by {m.group(1).upper()}."
    return None


def display_text(r: dict[str, Any]) -> str:
    """Main sentence (<= MAX_WORDS). Penalties after a play go in penalty_text(); 'No play' rows keep theirs here."""
    if (mk := marker_text(r.get("desc") or "")) is not None:
        return mk
    if _is_no_play(r):
        rest = penalty_sentences(penalty_clauses(r, skip_first=True))
        return " ".join(x for x in (_fit(no_play_text(r.get("desc") or "", r)), rest) if x)
    return _main_text(r)
