"""Snapshot the engine inputs grid.json was built from, so CI can check grid-vs-engine parity.

The real WP artifact is gitignored and the 4th-down empirics are fitted from nflverse
play-by-play, so neither exists in CI. This copies the (small) WP model and pickles the
fitted FourthDownEmpirics into backend/tests/fixtures/grid_engine/. Re-run whenever
grid.json is regenerated:

    PYTHONPATH=src python scripts/build_grid_test_fixture.py
"""
from __future__ import annotations

import pickle
import shutil
from pathlib import Path

from nfl_sim.api.situation_lab import WP_MODEL_ARTIFACT
from nfl_sim.models.fourth_down_empirics import FourthDownEmpirics

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "grid_engine"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy(WP_MODEL_ARTIFACT, OUT / "wp_model.joblib")
    meta = WP_MODEL_ARTIFACT.with_suffix(".meta.json")
    if meta.exists():
        shutil.copy(meta, OUT / "wp_model.meta.json")
    emp = FourthDownEmpirics.fit_from_seasons()
    (OUT / "empirics.pkl").write_bytes(pickle.dumps(emp, protocol=4))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
