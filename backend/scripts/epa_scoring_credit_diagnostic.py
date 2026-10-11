#!/usr/bin/env python3
"""Task A diagnostic: Convention A vs B on 2019–2022 only. Never loads 2023."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))

from nfl_sim.models.dataset import data_hash_for_seasons, load_raw_seasons, raw_season_path
from nfl_sim.models.scoring_credit import (
    DIAGNOSTIC_SEASONS,
    HOLDOUT_SEASON,
    forbid_holdout,
    outcome_table,
    score_conventions_from_ep_surface,
    score_credit_identity_residuals,
)


def _artifact_status() -> dict:
    joblib = ROOT / "reports" / "ep" / "artifacts" / "ep_model.joblib"
    meta = ROOT / "reports" / "ep" / "artifacts" / "ep_model.meta.json"
    out: dict = {
        "joblib_path": str(joblib),
        "joblib_exists": joblib.exists(),
        "meta_path": str(meta),
        "meta_exists": meta.exists(),
    }
    if joblib.exists():
        out["joblib_sha256"] = hashlib.sha256(joblib.read_bytes()).hexdigest()
    if meta.exists():
        out["meta"] = json.loads(meta.read_text())
    return out


def main() -> int:
    forbid_holdout(DIAGNOSTIC_SEASONS, context="diagnostic_seasons_constant")
    for s in DIAGNOSTIC_SEASONS:
        if not raw_season_path(s).exists():
            raise SystemExit(f"BLOCKER: missing raw season {s}")
    if raw_season_path(HOLDOUT_SEASON).exists():
        # Present on disk is OK; we must not load it.
        pass

    art = _artifact_status()
    seasons = list(DIAGNOSTIC_SEASONS)
    forbid_holdout(seasons, context="load_raw_seasons")
    raw = load_raw_seasons(seasons)
    loaded = sorted(int(x) for x in raw["season"].dropna().unique())
    forbid_holdout(loaded, context="after_load_unique_seasons")
    if loaded != seasons:
        raise SystemExit(f"Unexpected seasons loaded: {loaded}")

    out_dir = ROOT / "reports" / "ep" / "scoring_credit"
    out_dir.mkdir(parents=True, exist_ok=True)
    cache = out_dir / "scored_conventions_2019_2022.parquet"
    scored = score_conventions_from_ep_surface(raw, ep_col="ep")
    forbid_holdout(
        scored["season"].dropna().unique().tolist(),
        context="after_score_conventions",
    )
    # Persist for inspection; string-heavy cols may need conversion
    keep = [
        c
        for c in scored.columns
        if c
        in {
            "game_id",
            "play_id",
            "season",
            "qtr",
            "down",
            "play_type",
            "posteam",
            "defteam",
            "td_team",
            "touchdown",
            "safety",
            "field_goal_result",
            "interception",
            "fumble_lost",
            "punt_attempt",
            "fourth_down_failed",
            "ep_before_surface",
            "ep_after_surface",
            "realized_r",
            "convention_a_epa",
            "convention_b_epa",
            "reference_epa",
            "epa_is_terminal",
            "epa_possession_change",
            "epa_is_timeout",
            "epa_next_posteam",
        }
    ]
    scored[keep].to_parquet(cache, index=False)
    table = outcome_table(scored)
    identity = score_credit_identity_residuals(scored, atol=1e-9)

    # Compact per-bucket CSV-friendly summary
    rows = []
    for bucket, payload in table.get("buckets", {}).items():
        for conv in ("convention_a", "convention_b"):
            st = payload[conv]
            rows.append(
                {
                    "bucket": bucket,
                    "convention": conv,
                    **{k: st[k] for k in st},
                }
            )
    pd.DataFrame(rows).to_csv(out_dir / "outcome_table_2019_2022.csv", index=False)

    payload = {
        "task": "A_scoring_credit",
        "seasons": seasons,
        "holdout_2023_loaded": False,
        "data_hash": data_hash_for_seasons(seasons),
        "artifact": art,
        "ep_surface": "nflverse_ep",
        "ep_surface_note": (
            "Project ep_model.joblib missing; diagnostics use nflverse ep as EP surface "
            "to isolate EPA transition convention. Not a substitute project model."
        ),
        "outcome_table": table,
        "accounting_identity": identity,
        "blocker_project_model_epa": not art["joblib_exists"],
    }
    (out_dir / "diagnostic_results.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n"
    )
    print(
        json.dumps(
            {
                "wrote": str(out_dir / "diagnostic_results.json"),
                "n_eligible": table.get("n_eligible"),
                "identity_epoch_pass": identity["epoch_form"]["pass"],
                "identity_fail": identity["epoch_form"]["fail"],
                "joblib_exists": art["joblib_exists"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
