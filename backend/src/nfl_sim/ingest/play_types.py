"""Map nflverse play_type strings → canonical PlayType enum."""

from __future__ import annotations

from nfl_sim.contracts.enums import PlayType

_PLAY_TYPE_MAP: dict[str, PlayType] = {
    "pass": PlayType.PASS,
    "run": PlayType.RUSH,
    "rush": PlayType.RUSH,
    "punt": PlayType.PUNT,
    "field_goal": PlayType.FIELD_GOAL,
    "kickoff": PlayType.KICKOFF,
    "extra_point": PlayType.EXTRA_POINT,
    "xp_kick": PlayType.EXTRA_POINT,
    "two_point_attempt": PlayType.TWO_POINT,
    "no_play": PlayType.NO_PLAY,
    "qb_kneel": PlayType.OTHER,
    "qb_spike": PlayType.OTHER,
}


def map_play_type(raw: str | None) -> PlayType:
    if raw is None or (isinstance(raw, float) and str(raw) == "nan"):
        return PlayType.OTHER
    key = str(raw).strip().lower()
    if not key or key == "none" or key == "nan":
        return PlayType.OTHER
    return _PLAY_TYPE_MAP.get(key, PlayType.OTHER)
