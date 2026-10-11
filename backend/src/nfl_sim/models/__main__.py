"""CLI: python -m nfl_sim.models train|eval|score."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from nfl_sim.config import REPO_ROOT
from nfl_sim.models.dataset import build_modeling_frame, load_raw_seasons, split_frames
from nfl_sim.models.epa import compute_epa, score_model_epa
from nfl_sim.models.ep_model import EPModel, train_and_evaluate
from nfl_sim.models.split import ALL_MODEL_SEASONS


def cmd_train(args: argparse.Namespace) -> int:
    out = Path(args.out)
    frame = build_modeling_frame(ALL_MODEL_SEASONS)
    metrics = train_and_evaluate(frame, out_dir=out, include_test=args.include_test)

    # EPA reference agreement on validate (and test if requested)
    model = EPModel.load(out / "artifacts" / "ep_model.joblib")
    splits = split_frames(frame)
    for name in ("val", "test") if args.include_test else ("val",):
        raw = load_raw_seasons(sorted(int(x) for x in splits[name]["season"].unique()))
        # Restrict to same game_ids as split for EPA scoring cost control: use modeling rows' games
        games = set(splits[name]["game_id"].unique())
        raw = raw[raw["game_id"].isin(games)].copy()
        scored = score_model_epa(model, raw)
        # Join to eligible modeling keys
        key = splits[name][["game_id", "play_id", "epa"]].copy() if "epa" in splits[name].columns else splits[name][["game_id", "play_id"]].copy()
        merged = key.merge(
            scored[["game_id", "play_id", "model_ep", "model_epa"]],
            on=["game_id", "play_id"],
            how="left",
        )
        if "epa" in merged.columns:
            ref = pd.to_numeric(merged["epa"], errors="coerce")
            valid = ref.notna() & merged["model_epa"].notna()
            mae = float(np.mean(np.abs(merged.loc[valid, "model_epa"] - ref.loc[valid])))
            metrics.setdefault(name if name != "val" else "validate", {})
            target = metrics["validate"] if name == "val" else metrics["test"]
            target.setdefault("reference_agreement_only", {})
            target["reference_agreement_only"]["mae_vs_reference_epa"] = mae
            target["reference_agreement_only"]["epa_n"] = int(valid.sum())

    (out / "metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n")
    targets = out / "TARGETS.md"
    targets.write_text(
        "\n".join(
            [
                "# EP Stage A targets",
                "",
                "See [`docs/EP_MODEL_SPEC.md`](../../docs/EP_MODEL_SPEC.md).",
                "",
                "- Target: next score in half (7 classes)",
                "- Values: +7,+3,+2,0,−2,−3,−7",
                "- Split: train 2019–2021 / val 2022 / test 2023",
                "- nflverse `ep`/`epa`: reference agreement only",
                "",
            ]
        )
    )
    print(json.dumps({"out": str(out), "n": metrics["n"], "selected_C": metrics["hyperparam_selection"]["selected_C"]}, indent=2))
    return 0


def cmd_eval(args: argparse.Namespace) -> int:
    model = EPModel.load(Path(args.model))
    frame = build_modeling_frame(ALL_MODEL_SEASONS)
    splits = split_frames(frame)
    df = splits[args.split]
    proba = model.predict_proba(df)
    ep = model.predict_ep(df)
    print(
        json.dumps(
            {
                "split": args.split,
                "n": int(len(df)),
                "mean_ep": float(ep.mean()),
                "proba_sum_mean": float(proba.sum(axis=1).mean()),
            },
            indent=2,
        )
    )
    return 0


def cmd_score(args: argparse.Namespace) -> int:
    model = EPModel.load(Path(args.model))
    row = pd.DataFrame(
        [
            {
                "down": args.down,
                "ydstogo": args.distance,
                "yardline_100": args.yardline_100,
                "half_seconds_remaining": args.half_seconds,
                "posteam_timeouts_remaining": args.posteam_timeouts,
                "defteam_timeouts_remaining": args.defteam_timeouts,
                "posteam": "HOME" if args.home else "AWAY",
                "home_team": "HOME",
                "season": args.season,
                "roof": args.roof,
            }
        ]
    )
    ep = float(model.predict_ep(row)[0])
    proba = model.predict_proba(row)[0]
    from nfl_sim.models.constants import EP_CLASSES

    print(
        json.dumps(
            {
                "model_ep": ep,
                "proba": {c: float(p) for c, p in zip(EP_CLASSES, proba)},
            },
            indent=2,
        )
    )
    return 0


def cmd_epa_demo(_: argparse.Namespace) -> int:
    r = compute_epa(1.5, ep_after_raw=2.0, possession_change=False, is_timeout=False, is_terminal=False)
    print(json.dumps({"case": r.case, "model_epa": r.model_epa}, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Stage A EP/EPA tools")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_train = sub.add_parser("train", help="Train EP on 2019–2021; select C on 2022")
    p_train.add_argument("--out", type=str, default=str(REPO_ROOT / "reports" / "ep"))
    p_train.add_argument("--include-test", action="store_true", help="Score held-out 2023 once")
    p_train.set_defaults(func=cmd_train)

    p_eval = sub.add_parser("eval", help="Evaluate a saved model on a split")
    p_eval.add_argument("--model", type=str, required=True)
    p_eval.add_argument("--split", choices=["train", "val", "test"], default="val")
    p_eval.set_defaults(func=cmd_eval)

    p_score = sub.add_parser("score", help="Score a single situation")
    p_score.add_argument("--model", type=str, required=True)
    p_score.add_argument("--down", type=int, default=1)
    p_score.add_argument("--distance", type=int, default=10)
    p_score.add_argument("--yardline-100", type=int, default=75)
    p_score.add_argument("--half-seconds", type=int, default=1800)
    p_score.add_argument("--posteam-timeouts", type=int, default=3)
    p_score.add_argument("--defteam-timeouts", type=int, default=3)
    p_score.add_argument("--home", action="store_true")
    p_score.add_argument("--season", type=int, default=2022)
    p_score.add_argument("--roof", type=str, default="outdoors")
    p_score.set_defaults(func=cmd_score)

    p_epa = sub.add_parser("epa-demo", help="Show EPA identity example")
    p_epa.set_defaults(func=cmd_epa_demo)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
