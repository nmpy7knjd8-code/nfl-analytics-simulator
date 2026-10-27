#!/usr/bin/env bash
# Rebuild gitignored model binaries from pinned nflverse data.
#   reports/ep/artifacts/ep_model.joblib
#   reports/wp/artifacts/wp_model.joblib
#   reports/wp/artifacts/wp_model_calibrated.joblib (+ .meta.json)
# Fits only on 2019–2021, selects/calibrates on 2022. Never fits on 2023+.
# Usage (from repo root or backend/): bash backend/scripts/build_model_artifacts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python3}"
"$PY" -m nfl_sim.ingest --seasons 2019,2020,2021,2022
"$PY" -m nfl_sim.models train
"$PY" -m nfl_sim.models wp-train
"$PY" -m nfl_sim.models wp-calibrate
ls -l ../reports/ep/artifacts ../reports/wp/artifacts
