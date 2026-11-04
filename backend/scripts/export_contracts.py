#!/usr/bin/env python3
"""Write JSON Schemas for the API contracts to frontend/contracts/schema/.

Run: python backend/scripts/export_contracts.py   (tests fail if these drift)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from nfl_sim.contracts import (  # noqa: E402
    CanonicalPlay,
    GameSituation,
    GameSummary,
    Provenance,
    WinProbabilitySeries,
)

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "frontend" / "contracts" / "schema"
MODELS = {
    "GameSummary": GameSummary,
    "CanonicalPlay": CanonicalPlay,
    "GameSituation": GameSituation,
    "Provenance": Provenance,
    "WinProbabilitySeries": WinProbabilitySeries,
}


def render() -> dict[str, str]:
    return {
        f"{name}.schema.json": json.dumps(m.model_json_schema(), indent=2, sort_keys=True) + "\n"
        for name, m in MODELS.items()
    }


def main() -> int:
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    for fname, text in render().items():
        (SCHEMA_DIR / fname).write_text(text)
        print(SCHEMA_DIR / fname)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
