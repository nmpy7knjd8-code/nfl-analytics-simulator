"""Re-export of nfl_sim.seasons (backend/src/nfl_sim/seasons.py), the one season list, for the mining scripts.

Mining modules reach nfl_sim the same way build_fakes_text.py does: backend/src on sys.path. Edit the season
list and size caps in backend/src/nfl_sim/seasons.py, not here.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend/src"))
from nfl_sim.seasons import (  # noqa: E402,F401
    CLOSED,
    CLOSED_SPAN,
    CLOSED_THROUGH,
    FIRST,
    OPEN,
    SEASONS,
    SIZE_CAPS,
    pbp_paths,
    season_keys,
    size_cap,
    span,
)
