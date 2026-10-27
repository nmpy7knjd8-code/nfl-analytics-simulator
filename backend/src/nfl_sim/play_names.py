"""Full player names for play_text: nflverse player ids -> players.csv display_name, and
penalized players (feed text "TEAM-JERSEY-F.Last") -> that week's nflverse weekly roster."""
from __future__ import annotations

import re
from typing import Any

PLAYERS_CSV = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"
ROSTERS = "https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_{season}.parquet"
NAME_ROLES = ("passer", "receiver", "rusher", "interception", "kicker", "punter", "punt_returner",
              "kickoff_returner", "fumbled_1", "fumble_recovery_1", "sack", "penalty")
ID_COLS = [f"{role}_player_id" for role in NAME_ROLES]
# pbp columns play_text reads (beyond desc/play_type), plus the id columns above
TEXT_COLUMNS = [
    "desc", "play_type", "yards_gained", "touchdown", "interception", "fumble_lost", "fourth_down_failed",
    "field_goal_result", "kick_distance", "return_yards", "incomplete_pass", "sack", "penalty",
    "extra_point_result", "touchback", "qb_kneel", "qb_spike", "down",
    "passer_player_name", "receiver_player_name", "rusher_player_name", "interception_player_name",
    "kicker_player_name", "punter_player_name", "punt_returner_player_name", "kickoff_returner_player_name",
    "fumbled_1_player_name", "fumble_recovery_1_player_name", "sack_player_name", "penalty_player_name",
]
_PEN = re.compile(r"PENALTY on ([A-Z]{2,3})-(\d{1,2})-[A-Za-z]+\.([\w'\-]+)", re.I)


def load_players(src: str = PLAYERS_CSV) -> dict[str, str]:
    import pandas as pd
    return pd.read_csv(src, usecols=["gsis_id", "display_name"]).dropna().set_index("gsis_id").display_name.to_dict()


def load_roster(season: int, src: str | None = None) -> dict[tuple[int, str, int], str]:
    import pandas as pd
    ros = pd.read_parquet(src or ROSTERS.format(season=season), columns=["week", "team", "jersey_number", "full_name"]).dropna()
    return {(int(w), t, int(j)): n for w, t, j, n in ros.itertuples(index=False)}


def penalty_names(r: dict[str, Any], roster: dict) -> dict[str, str]:
    """'TEAM-JERSEY' -> full name for every penalized player (last name must match the feed text)."""
    out: dict[str, str] = {}
    parts = str(r.get("game_id") or "").split("_")
    if len(parts) < 2 or not parts[1].isdigit():
        return out
    week = int(parts[1])
    for team, num, last in _PEN.findall(r.get("desc") or ""):
        full = roster.get((week, team, int(num)))
        if full and full.split()[-1].lower().startswith(last.lower()[:4]):
            out[f"{team}-{num}"] = full
    return out


def attach_names(r: dict[str, Any], players: dict[str, str], roster: dict) -> dict[str, Any]:
    """Set r["names"] and drop the *_player_id columns (in place)."""
    r["names"] = {role: players[r[f"{role}_player_id"]] for role in NAME_ROLES if r.get(f"{role}_player_id") in players}
    if pen := penalty_names(r, roster):
        r["names"]["penalties"] = pen
    for c in ID_COLS:
        r.pop(c, None)
    return r
