"""Derived canonical fields (not present as observed columns in nflverse Parquet)."""

from __future__ import annotations

import pandas as pd


def derive_is_home_possession(posteam: pd.Series, home_team: pd.Series) -> pd.Series:
    """True when posteam == home_team; null when either side is missing."""
    both = posteam.notna() & home_team.notna()
    out = pd.Series(pd.NA, index=posteam.index, dtype="boolean")
    out.loc[both] = posteam.loc[both].astype(str) == home_team.loc[both].astype(str)
    return out


def derive_receive_2h_ko(df: pd.DataFrame) -> pd.Series:
    """nflfastR-compatible receive_2h_ko for qtr <= 2.

    Within each game_id, for first-half rows (qtr <= 2): 1 when posteam equals
    the first non-null defteam in the first half (team that will receive 2H KO),
    else 0. Outside first half → null.
    """
    out = pd.Series(pd.NA, index=df.index, dtype="Int64")
    if df.empty:
        return out

    for _, g in df.groupby("game_id", sort=False):
        first_half = g["qtr"].notna() & (g["qtr"] <= 2)
        fh = g.loc[first_half]
        if fh.empty:
            continue
        defteams = fh["defteam"].dropna()
        if defteams.empty:
            out.loc[fh.index] = 0
            continue
        receiver = str(defteams.iloc[0])
        posteam = fh["posteam"]
        flags = posteam.notna() & (posteam.astype(str) == receiver)
        out.loc[fh.index] = flags.astype("int64")
    return out
