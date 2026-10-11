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


def cmd_baselines(args: argparse.Namespace) -> int:
    """Fit empirical baselines on train; evaluate on validate 2022 only (never 2023)."""
    from nfl_sim.models.baselines import evaluate_baselines_on_val
    from nfl_sim.models.ep_model import ConstantBaseline, EPModel, evaluate_split

    frame = build_modeling_frame((2019, 2020, 2021, 2022))  # no 2023
    splits = split_frames(frame)
    train_df, val_df = splits["train"], splits["val"]
    base = evaluate_baselines_on_val(train_df, val_df)

    # Multinomial model if artifact present (already selected on 2022 — report only)
    model_path = Path(args.model) if args.model else (REPO_ROOT / "reports/ep/artifacts/ep_model.joblib")
    model_metrics = None
    if model_path.exists():
        model = EPModel.load(model_path)
        const = ConstantBaseline().fit(train_df["ep_label"])
        model_metrics = evaluate_split(model, const, val_df, split_name="val")

    # Optional: with-era ablation on 2022 only (production excludes era; does not retune C / touch 2023)
    ablation_with_era = None
    if args.ablate_era:
        from sklearn.compose import ColumnTransformer
        from sklearn.impute import SimpleImputer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import OneHotEncoder, StandardScaler

        from nfl_sim.models.constants import EP_CLASSES, RANDOM_SEED
        from nfl_sim.models.ep_model import _log_loss_fixed_order, multiclass_brier
        from nfl_sim.models.features import build_feature_frame

        tr = train_df.copy()
        va = val_df.copy()
        Xtr = build_feature_frame(tr)
        Xva = build_feature_frame(va)
        # Production drops era; this ablation re-adds era_post_2020 for comparison only.
        num_cols = [c for c in Xtr.columns if c != "roof"]  # includes era_post_2020
        cat_cols = ["roof"]
        tf = ColumnTransformer(
            [
                (
                    "num",
                    Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler())]),
                    num_cols,
                ),
                (
                    "cat",
                    Pipeline(
                        [
                            ("imputer", SimpleImputer(strategy="most_frequent")),
                            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                        ]
                    ),
                    cat_cols,
                ),
            ]
        )
        Xt = tf.fit_transform(Xtr)
        Xv = tf.transform(Xva)
        clf = LogisticRegression(solver="lbfgs", max_iter=2000, C=0.25, random_state=RANDOM_SEED)
        clf.fit(Xt, tr["ep_label"].astype(str))
        proba = clf.predict_proba(Xv)
        col_index = {c: i for i, c in enumerate(clf.classes_)}
        out_p = np.zeros((len(va), len(EP_CLASSES)))
        for j, cls in enumerate(EP_CLASSES):
            if cls in col_index:
                out_p[:, j] = proba[:, col_index[cls]]
        out_p = out_p / np.clip(out_p.sum(axis=1, keepdims=True), 1e-12, None)
        y = va["ep_label"].astype(str)
        y_idx = np.array([list(EP_CLASSES).index(c) for c in y])
        ablation_with_era = {
            "log_loss": _log_loss_fixed_order(y, out_p),
            "brier_multiclass": multiclass_brier(y_idx, out_p, len(EP_CLASSES)),
            "note": (
                "Diagnostic only: C=0.25 fixed; era_post_2020 included. "
                "Production model excludes era. 2023 untouched."
            ),
        }

    payload = {
        "baselines_validate_2022": base,
        "multinomial_model_validate_2022": {
            "log_loss": model_metrics["model"]["log_loss"] if model_metrics else None,
            "brier_multiclass": model_metrics["model"]["brier_multiclass"] if model_metrics else None,
            "artifact": str(model_path) if model_path.exists() else None,
            "era_feature": "excluded_from_production",
        },
        "ablation_with_era_validate_2022": ablation_with_era,
        "ablation_without_era_validate_2022_preserved": {
            "log_loss": 1.3360995567698928,
            "brier_multiclass": 0.6868032767311293,
            "note": (
                "Preserved from pre-decision audit (C=0.25, era removed). "
                "Led to excluding era from production; ΔLL≈0.001 vs with-era."
            ),
        },
        "era_decision": {
            "production": "exclude_era_post_2020",
            "reconsider_when": "meaningful_stable_gain_across_temporal_validation_with_encoding_documented",
        },
        "test_2023_untouched": True,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


def cmd_reconcile(args: argparse.Namespace) -> int:
    from nfl_sim.models.reconcile import run_reconciliation

    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(f"Missing model artifact: {model_path}")
    model = EPModel.load(model_path)
    payload = run_reconciliation(model, out_path=Path(args.out))
    print(
        json.dumps(
            {
                "out": args.out,
                "gate": payload["gate"],
                "identity_pass": payload["accounting_identity_train_sample"]["pass"],
            },
            indent=2,
        )
    )
    return 0


def cmd_wp_train(args: argparse.Namespace) -> int:
    """Path A WP: train 2019–2021, select C on 2022, optional 2023 report-only."""
    from nfl_sim.models.dataset import build_wp_modeling_frame
    from nfl_sim.models.wp_model import train_and_evaluate_wp

    out = Path(args.out)
    cmd = (
        f"python3 -m nfl_sim.models wp-train --out {out}"
        + (" --include-test" if args.include_test else "")
    )
    frame = build_wp_modeling_frame(ALL_MODEL_SEASONS)
    metrics = train_and_evaluate_wp(
        frame,
        out_dir=out,
        include_test=args.include_test,
        command=cmd,
    )
    _write_wp_eval_report(out, metrics, command=cmd)
    print(
        json.dumps(
            {
                "out": str(out),
                "n": metrics["n"],
                "selected_C": metrics["hyperparam_selection"]["selected_C"],
                "validate": {
                    "log_loss": metrics["validate"]["model"]["log_loss"],
                    "brier": metrics["validate"]["model"]["brier"],
                },
            },
            indent=2,
        )
    )
    return 0


def cmd_wp_eval(args: argparse.Namespace) -> int:
    from nfl_sim.models.dataset import build_wp_modeling_frame
    from nfl_sim.models.wp_model import WPModel

    model = WPModel.load(Path(args.model))
    frame = build_wp_modeling_frame(ALL_MODEL_SEASONS)
    splits = split_frames(frame)
    df = splits[args.split]
    p = model.predict_wp(df)
    print(
        json.dumps(
            {
                "split": args.split,
                "n": int(len(df)),
                "mean_wp": float(p.mean()),
                "model": str(args.model),
            },
            indent=2,
        )
    )
    return 0


def cmd_decision_lab(args: argparse.Namespace) -> int:
    """Historical decision lab: freeze a lake 4th-down → reuse FourthDownAnalyzer."""
    import json as _json

    from nfl_sim.models.decision_lab import (
        load_analyzer,
        load_fourth_down_frame,
        run_decision_lab,
        select_play,
        summarize_lab,
    )

    seasons = tuple(int(s.strip()) for s in str(args.seasons).split(",") if s.strip())
    if not seasons:
        raise SystemExit("--seasons must list at least one season")
    frame = load_fourth_down_frame(seasons, season_type=args.season_type or None)
    if args.list:
        n = min(int(args.list_limit), len(frame))
        cols = [
            c
            for c in (
                "season",
                "week",
                "game_id",
                "play_id",
                "posteam",
                "ydstogo",
                "yardline_100",
                "score_differential",
                "game_seconds_remaining",
                "play_type",
            )
            if c in frame.columns
        ]
        rows = frame.loc[: n - 1, cols].copy()
        # JSON-friendly scalars
        payload = {
            "n_total": int(len(frame)),
            "showing": int(n),
            "seasons": list(seasons),
            "plays": rows.to_dict(orient="records"),
        }
        print(_json.dumps(payload, indent=2, default=str))
        return 0

    model_path = Path(args.model)
    try:
        az = load_analyzer(model_path)
    except FileNotFoundError as exc:
        raise SystemExit(str(exc)) from exc

    try:
        row = select_play(
            frame,
            game_id=args.game_id,
            play_id=args.play_id,
            index=args.index,
        )
    except (KeyError, IndexError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc

    result = run_decision_lab(
        az,
        row,
        convert_delta=float(args.convert_delta),
        make_delta=float(args.make_delta),
        include_sensitivity=not args.no_sensitivity,
    )
    payload = result.to_dict()
    payload["summary"] = summarize_lab(result)
    payload["command"] = (
        f"python3 -m nfl_sim.models decision-lab --seasons {args.seasons}"
        + (f" --game-id {args.game_id} --play-id {args.play_id}" if args.game_id else f" --index {args.index}")
        + f" --model {model_path}"
    )

    if args.out:
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        (out / "lab_result.json").write_text(
            _json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n"
        )
        _write_decision_lab_report(out, payload)
        print(
            _json.dumps(
                {
                    "out": str(out),
                    "summary": payload["summary"],
                },
                indent=2,
                default=str,
            )
        )
        return 0

    print(_json.dumps(payload, indent=2, sort_keys=True, default=str))
    return 0


def _write_decision_lab_report(out: Path, payload: dict) -> None:
    play = payload["play"]
    prov = play["provenance"]
    analysis = payload["analysis"]
    actions = analysis["actions"]
    summary = payload["summary"]
    emp = analysis.get("empirics_meta") or {}
    lines = [
        "# Historical fourth-down decision lab",
        "",
        f"**Command:** `{payload.get('command', '')}`",
        "",
        "> **Offline estimate disclaimer:** Values are model counterfactuals from "
        "Path A uncalibrated WP + REG train empirics — **not** historical fact, "
        "live odds, or betting advice. No sportsbook/exchange inputs.",
        "",
        "## Frozen historical play",
        "",
        f"* Season / week: `{prov.get('season')}` / `{prov.get('week')}`",
        f"* game_id / play_id: `{prov.get('game_id')}` / `{prov.get('play_id')}`",
        f"* Possession: `{prov.get('posteam')}` vs `{prov.get('defteam')}` "
        f"(home `{prov.get('home_team')}`)",
        f"* Historical play_type: `{prov.get('play_type')}` "
        f"(mapped action: `{play.get('historical_action')}`)",
        f"* Truth: **historical** observation (not a model recommendation)",
        "",
        "## Game state (frozen)",
        "",
        f"| Field | Value |",
        f"| --- | ---: |",
        f"| score_differential | {summary['score_differential']} |",
        f"| yardline_100 | {summary['yardline_100']} |",
        f"| distance (ydstogo) | {summary['distance']} |",
        f"| game_seconds_remaining | {summary['game_seconds_remaining']} |",
        f"| half_seconds_remaining | {play['situation'].get('half_seconds_remaining')} |",
        f"| qtr | {play['situation'].get('qtr')} |",
        "",
        "## Empirics (visible with values)",
        "",
        f"* Training seasons: `{emp.get('seasons')}` (REG only; **not** 2023+)",
        f"* Sample sizes: n_go={emp.get('n_go')}, n_fg={emp.get('n_fg')}, "
        f"n_punt={emp.get('n_punt')}",
        "",
        "## Model action values (counterfactual)",
        "",
        f"| Action | WP value |",
        f"| --- | ---: |",
        f"| go | {actions['go']['value_wp']:.4f} |",
        f"| fg | {actions['fg']['value_wp']:.4f} |",
        f"| punt | {actions['punt']['value_wp']:.4f} |",
        "",
        f"**Recommendation:** `{analysis['recommendation']}` "
        f"(margin={analysis['margin']:.4f}; inconclusive={analysis['inconclusive']})",
        "",
        "### Assumptions",
        "",
    ]
    for a in analysis.get("assumptions", []):
        lines.append(f"* {a}")
    lines += [
        "",
        "### Limitations (not invented away)",
        "",
        "* Toy clock (−6s per branch); no timeout / OT / onside strategy",
        "* Coarse FG make bins; miss spot ≈ previous LOS; kickoff TB proxy at 75",
        "* Punt → mean opponent yardline only (no return variance / blocked branch)",
        "* Conversion rates are distance bins from 2019–2021 REG only",
        "* Margin < 0.01 WP → inconclusive (do not manufacture confidence)",
    ]
    sens = payload.get("sensitivity")
    if sens:
        b, alt = sens["baseline"], sens["alternate"]
        lines += [
            "",
            "## Sensitivity",
            "",
            f"Convert Δ={sens['convert_delta']:+}, make Δ={sens['make_delta']:+}.",
            "",
            "| | go | FG | punt | recommendation |",
            "| --- | ---: | ---: | ---: | --- |",
            f"| Baseline | {b['actions']['go']['value_wp']:.4f} | "
            f"{b['actions']['fg']['value_wp']:.4f} | "
            f"{b['actions']['punt']['value_wp']:.4f} | {b['recommendation']} |",
            f"| Alternate | {alt['actions']['go']['value_wp']:.4f} | "
            f"{alt['actions']['fg']['value_wp']:.4f} | "
            f"{alt['actions']['punt']['value_wp']:.4f} | {alt['recommendation']} |",
            "",
            f"Recommendation changed: **{sens['recommendation_changed']}**",
        ]
    lines += [
        "",
        "## Notes",
        "",
    ]
    for n in payload.get("notes", []):
        lines.append(f"* {n}")
    lines.append("")
    (out / "REPORT.md").write_text("\n".join(lines))


def cmd_fourth_down(args: argparse.Namespace) -> int:
    """Offline go/FG/punt analysis using Path A WP + train-season empirics."""
    import json as _json

    from nfl_sim.models.fourth_down import (
        FourthDownAnalyzer,
        FourthDownSituation,
        sensitivity_example,
    )
    from nfl_sim.models.fourth_down_empirics import FourthDownEmpirics

    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(
            f"Missing WP artifact: {model_path}. Train Path A WP first "
            "(uncalibrated primary; do not persist isotonic as default)."
        )
    empirics = FourthDownEmpirics.fit_from_seasons()
    az = FourthDownAnalyzer.load(model_path, empirics=empirics)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "empirics.json").write_text(_json.dumps(empirics.to_dict(), indent=2, sort_keys=True) + "\n")

    if args.report:
        examples = [
            FourthDownSituation(55, 1, 0, 360, 360, qtr=4),
            FourthDownSituation(33, 4, -3, 120, 120, qtr=4),
            FourthDownSituation(70, 2, 4, 600, 600, qtr=3),
            FourthDownSituation(20, 8, 0, 90, 90, qtr=4),
        ]
        rows = []
        for sit in examples:
            rows.append(az.analyze(sit).to_dict())
        # Sensitivity: midfield 4th & 1 — lower conversion until recommendation leaves "go"
        sens_sit = FourthDownSituation(55, 1, 0, 360, 360, qtr=4)
        sens = sensitivity_example(az, sens_sit, convert_delta=-0.35, make_delta=0.0)
        # Prefer a decisive action flip (not merely → inconclusive) when possible
        if sens["alternate"]["recommendation"] in {sens["baseline"]["recommendation"], "inconclusive"}:
            sens_try = sensitivity_example(az, sens_sit, convert_delta=-0.50, make_delta=0.0)
            if sens_try["recommendation_changed"] and sens_try["alternate"]["recommendation"] != "inconclusive":
                sens = sens_try
        if not sens["recommendation_changed"]:
            sens_sit = FourthDownSituation(20, 8, 0, 90, 90, qtr=4)
            sens = sensitivity_example(az, sens_sit, convert_delta=0.0, make_delta=-0.25)
        payload = {
            "command": (
                f"python3 -m nfl_sim.models fourth-down --report --model {model_path} --out {out}"
            ),
            "wp_model": str(model_path),
            "wp_note": "Path A uncalibrated primary; isotonic not loaded",
            "empirics_meta": empirics.meta,
            "examples": rows,
            "sensitivity": sens,
        }
        (out / "examples.json").write_text(_json.dumps(payload, indent=2, sort_keys=True) + "\n")
        _write_fourth_down_report(out, payload)
        print(_json.dumps({"out": str(out), "n_examples": len(rows), "sensitivity_changed": sens["recommendation_changed"]}, indent=2))
        return 0

    sit = FourthDownSituation(
        yardline_100=args.yardline_100,
        distance=args.distance,
        score_differential=args.score_diff,
        game_seconds_remaining=args.game_seconds,
        half_seconds_remaining=args.half_seconds,
        qtr=args.qtr,
    )
    res = az.analyze(sit)
    print(_json.dumps(res.to_dict(), indent=2, sort_keys=True))
    return 0


def _write_fourth_down_report(out: Path, payload: dict) -> None:
    lines = [
        "# Offline 4th-down prototype report",
        "",
        f"**Command:** `{payload['command']}`",
        "",
        f"**WP model:** `{payload['wp_model']}` — {payload['wp_note']}",
        "",
        "## Empirics",
        "",
        f"Seasons: `{payload['empirics_meta'].get('seasons')}` "
        f"(REG; n_go={payload['empirics_meta'].get('n_go')}, "
        f"n_fg={payload['empirics_meta'].get('n_fg')}, "
        f"n_punt={payload['empirics_meta'].get('n_punt')}). "
        "**Not fit on 2023+.**",
        "",
        "See `empirics.json` for bin rates and n.",
        "",
        "## Example situations",
        "",
        "| yardline_100 | distance | score_diff | clock | go | FG | punt | rec | margin |",
        "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |",
    ]
    for ex in payload["examples"]:
        s = ex["situation"]
        a = ex["actions"]
        lines.append(
            f"| {s['yardline_100']} | {s['distance']} | {s['score_differential']} | "
            f"{s['game_seconds_remaining']} | {a['go']['value_wp']:.4f} | "
            f"{a['fg']['value_wp']:.4f} | {a['punt']['value_wp']:.4f} | "
            f"{ex['recommendation']} | {ex['margin']:.4f} |"
        )
    sens = payload["sensitivity"]
    b, alt = sens["baseline"], sens["alternate"]
    lines += [
        "",
        "## Sensitivity (recommendation flip check)",
        "",
        f"Convert Δ={sens['convert_delta']:+}, make Δ={sens['make_delta']:+}.",
        "",
        f"| | go | FG | punt | recommendation |",
        f"| --- | ---: | ---: | ---: | --- |",
        f"| Baseline | {b['actions']['go']['value_wp']:.4f} | {b['actions']['fg']['value_wp']:.4f} | "
        f"{b['actions']['punt']['value_wp']:.4f} | {b['recommendation']} |",
        f"| Alternate | {alt['actions']['go']['value_wp']:.4f} | {alt['actions']['fg']['value_wp']:.4f} | "
        f"{alt['actions']['punt']['value_wp']:.4f} | {alt['recommendation']} |",
        "",
        f"Recommendation changed: **{sens['recommendation_changed']}**",
        "",
        "## Limitations",
        "",
        "- Toy clock (−6s); no timeout/OT/onside model",
        "- Single mean punt field position (no return variance / blocks)",
        "- FG miss spot ≈ previous LOS; kickoff always TB at 75",
        "- Conversion/FG probs are coarse bins from 2019–2021 only",
        "- Margin < 0.01 WP → inconclusive (do not manufacture confidence)",
        "",
        "Design: `docs/FOURTH_DOWN_DESIGN.md`",
        "",
    ]
    (out / "REPORT.md").write_text("\n".join(lines))


def cmd_wp_calibrate(args: argparse.Namespace) -> int:
    """OOF Platt calibration on validate 2022; freeze C; never touch 2023."""
    from nfl_sim.models.wp_calibration import run_wp_calibration_eval

    out = Path(args.out)
    cmd = (
        f"python3 -m nfl_sim.models wp-calibrate --out {out} --C {args.C} --folds {args.folds}"
    )
    payload = run_wp_calibration_eval(
        out_dir=out,
        C=float(args.C),
        n_splits=int(args.folds),
        include_isotonic=not args.skip_isotonic,
        command=cmd,
    )
    _append_wp_calibration_section(out, payload)
    print(
        json.dumps(
            {
                "out": str(out),
                "recommendation": payload["recommendation"],
                "uncalibrated": payload["metrics"]["uncalibrated"],
                "platt_oof_primary": payload["metrics"]["platt_oof_primary"],
                "deltas_oof_platt_minus_uncal": payload["deltas_oof_platt_minus_uncal"],
                "isotonic_justified_vs_platt": payload["isotonic_justified_vs_platt"],
            },
            indent=2,
        )
    )
    return 0


def _append_wp_calibration_section(out: Path, payload: dict) -> None:
    """Append calibration results; preserve original EVALUATION.md body if present."""
    path = out / "EVALUATION.md"
    existing = path.read_text() if path.exists() else ""
    marker = "## Calibration (validate 2022, OOF primary)"
    if marker in existing:
        existing = existing.split(marker)[0].rstrip() + "\n\n"
    elif existing and not existing.endswith("\n"):
        existing += "\n"

    u = payload["metrics"]["uncalibrated"]
    p = payload["metrics"]["platt_oof_primary"]
    sec = payload["metrics"]["platt_in_sample_secondary"]
    d = payload["deltas_oof_platt_minus_uncal"]
    lines = [
        marker,
        "",
        f"**Command:** `{payload['command']}`",
        "",
        f"Base WP frozen at **C={payload['base_model']['C_frozen']}** "
        f"(train n={payload['base_model']['train_n']}); "
        f"calibrator cross-fit on validate {payload['base_model']['val_season']} "
        f"only (n={payload['base_model']['val_n']}, "
        f"{payload['n_splits']}-fold stratified OOF). "
        "**2023 not used.** Original uncalibrated eval above is preserved.",
        "",
        "| Estimator | Log loss | Brier | ECE (decile) |",
        "| --- | ---: | ---: | ---: |",
        f"| Uncalibrated | {u['log_loss']:.6f} | {u['brier']:.6f} | {u['ece_decile']:.6f} |",
        f"| Platt OOF (primary) | {p['log_loss']:.6f} | {p['brier']:.6f} | {p['ece_decile']:.6f} |",
        f"| Platt in-sample (secondary) | {sec['log_loss']:.6f} | {sec['brier']:.6f} | {sec['ece_decile']:.6f} |",
    ]
    iso = payload["metrics"].get("isotonic_oof_ablation")
    if iso:
        lines.append(
            f"| Isotonic OOF (ablation) | {iso['log_loss']:.6f} | {iso['brier']:.6f} | {iso['ece_decile']:.6f} |"
        )
    lines += [
        "",
        f"OOF Platt − uncalibrated: ΔLL={d['log_loss']:+.6f}, "
        f"ΔBrier={d['brier']:+.6f}, ΔECE={d['ece_decile']:+.6f}.",
        "",
        f"**Recommendation:** `{payload['recommendation']}` — {payload['rationale']}",
        "",
        f"Isotonic justified vs Platt: `{payload['isotonic_justified_vs_platt']}`. "
        f"Preferred calibrator candidate: `{payload.get('preferred_calibrator_candidate')}`.",
        "",
        "Artifacts: `calibration_eval.json`, `calibration_compare.csv` "
        "(plus original `calibration_val.csv` / `metrics.json`).",
        "",
        f"Packages: `{json.dumps(payload['packages'], sort_keys=True)}`",
        "",
    ]
    path.write_text(existing + "\n".join(lines))


def _write_wp_eval_report(out: Path, metrics: dict, *, command: str) -> None:
    val = metrics["validate"]
    test = metrics.get("test")
    lines = [
        "# WP prototype evaluation",
        "",
        f"**Command:** `{command}`",
        "",
        f"**Spec:** `{metrics['spec']}`",
        f"**Path:** {metrics['path']} (EP joblib not loaded)",
        f"**Selected C:** {metrics['hyperparam_selection']['selected_C']} "
        f"(tuned on validate 2022 only)",
        "",
        "## Packages",
        "",
        "```json",
        json.dumps(metrics["packages"], indent=2),
        "```",
        "",
        "## EP labeled rebuild (not used in Path A)",
        "",
        f"- Verified SHA-256: `{metrics['ep_labeled_rebuild_verified_sha256']}`",
        f"- Note: {metrics['ep_labeled_rebuild_note']}",
        f"- `ep_model_loaded`: `{metrics['ep_model_loaded']}`",
        "",
        "## Counts",
        "",
        "```json",
        json.dumps(metrics["n"], indent=2),
        "```",
        "",
        "## Validate 2022",
        "",
        f"| Estimator | Log loss | Brier |",
        f"| --- | ---: | ---: |",
        f"| WP logistic | {val['model']['log_loss']:.6f} | {val['model']['brier']:.6f} |",
        f"| Constant baseline | {val['baseline_constant']['log_loss']:.6f} | {val['baseline_constant']['brier']:.6f} |",
        f"| Score+time baseline | {val['baseline_score_time']['log_loss']:.6f} | {val['baseline_score_time']['brier']:.6f} |",
        "",
        f"n={val['n']}, empirical win rate={val['win_rate']:.4f}",
        "",
    ]
    if test:
        lines += [
            "## Report-only 2023",
            "",
            f"| Estimator | Log loss | Brier |",
            f"| --- | ---: | ---: |",
            f"| WP logistic | {test['model']['log_loss']:.6f} | {test['model']['brier']:.6f} |",
            f"| Constant baseline | {test['baseline_constant']['log_loss']:.6f} | {test['baseline_constant']['brier']:.6f} |",
            f"| Score+time baseline | {test['baseline_score_time']['log_loss']:.6f} | {test['baseline_score_time']['brier']:.6f} |",
            "",
            f"n={test['n']}. **Not used for selection.**",
            "",
        ]
    lines += [
        "## Target / terminal / end-of-half",
        "",
        "See `docs/WP_MODEL_SPEC.md` §3. Win label = posteam eventual game winner; "
        "ties dropped. Half boundaries do not reset the target. "
        "`receive_2h_ko` encoded 0 outside first half.",
        "",
        "## Artifacts",
        "",
        f"- `artifacts/wp_model.joblib` (gitignored binary)",
        f"- `artifacts/wp_model.meta.json`",
        f"- `metrics.json`",
        f"- `calibration_val.csv`",
        "",
    ]
    (out / "EVALUATION.md").write_text("\n".join(lines))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Stage A EP/EPA + WP tools")
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

    p_base = sub.add_parser("baselines", help="Compare empirical baselines on validate 2022 only")
    p_base.add_argument("--out", type=str, default=str(REPO_ROOT / "reports" / "ep" / "baselines_2022.json"))
    p_base.add_argument("--model", type=str, default="")
    p_base.add_argument(
        "--ablate-era",
        action="store_true",
        help="Also report 2022 metrics with era feature re-added (production excludes era)",
    )
    p_base.set_defaults(func=cmd_baselines)

    p_rec = sub.add_parser(
        "reconcile",
        help="Focused nflverse EPA reconciliation on val 2022 + identity on train seasons",
    )
    p_rec.add_argument("--model", type=str, default=str(REPO_ROOT / "reports/ep/artifacts/ep_model.joblib"))
    p_rec.add_argument(
        "--out",
        type=str,
        default=str(REPO_ROOT / "reports/ep/reconciliation_2022.json"),
    )
    p_rec.set_defaults(func=cmd_reconcile)

    p_wp = sub.add_parser("wp-train", help="Train Path A WP on 2019–2021; select C on 2022")
    p_wp.add_argument("--out", type=str, default=str(REPO_ROOT / "reports" / "wp"))
    p_wp.add_argument("--include-test", action="store_true", help="Score report-only 2023 once")
    p_wp.set_defaults(func=cmd_wp_train)

    p_wpe = sub.add_parser("wp-eval", help="Evaluate a saved WP model on a split")
    p_wpe.add_argument("--model", type=str, required=True)
    p_wpe.add_argument("--split", choices=["train", "val", "test"], default="val")
    p_wpe.set_defaults(func=cmd_wp_eval)

    p_wpc = sub.add_parser(
        "wp-calibrate",
        help="OOF Platt calibration on validate 2022 (freeze C; no 2023)",
    )
    p_wpc.add_argument("--out", type=str, default=str(REPO_ROOT / "reports" / "wp"))
    p_wpc.add_argument("--C", type=float, default=0.25, help="Frozen base WP C (default 0.25)")
    p_wpc.add_argument("--folds", type=int, default=5, help="Stratified OOF folds on val")
    p_wpc.add_argument(
        "--skip-isotonic",
        action="store_true",
        help="Skip isotonic OOF ablation",
    )
    p_wpc.set_defaults(func=cmd_wp_calibrate)

    p_fd = sub.add_parser(
        "fourth-down",
        help="Offline analytical 4th-down go/FG/punt values (Path A WP + train empirics)",
    )
    p_fd.add_argument(
        "--model",
        type=str,
        default=str(REPO_ROOT / "reports" / "wp" / "artifacts" / "wp_model.joblib"),
    )
    p_fd.add_argument("--out", type=str, default=str(REPO_ROOT / "reports" / "fourth_down"))
    p_fd.add_argument("--yardline-100", type=int, default=55)
    p_fd.add_argument("--distance", type=int, default=1)
    p_fd.add_argument("--score-diff", type=int, default=0)
    p_fd.add_argument("--game-seconds", type=int, default=360)
    p_fd.add_argument("--half-seconds", type=int, default=360)
    p_fd.add_argument("--qtr", type=int, default=4)
    p_fd.add_argument("--report", action="store_true", help="Write multi-example report + sensitivity")
    p_fd.set_defaults(func=cmd_fourth_down)

    p_lab = sub.add_parser(
        "decision-lab",
        help="Historical decision lab: freeze a lake 4th-down row → go/FG/punt values",
    )
    p_lab.add_argument(
        "--model",
        type=str,
        default=str(REPO_ROOT / "reports" / "wp" / "artifacts" / "wp_model.joblib"),
    )
    p_lab.add_argument(
        "--seasons",
        type=str,
        default="2022",
        help="Comma-separated lake seasons to search (default 2022)",
    )
    p_lab.add_argument(
        "--season-type",
        type=str,
        default="REG",
        help="Filter season_type (default REG; empty string = all)",
    )
    p_lab.add_argument("--game-id", type=str, default=None)
    p_lab.add_argument("--play-id", type=float, default=None)
    p_lab.add_argument(
        "--index",
        type=int,
        default=0,
        help="Positional index into filtered 4th-down frame when game_id unset",
    )
    p_lab.add_argument("--list", action="store_true", help="List candidate 4th-down plays and exit")
    p_lab.add_argument("--list-limit", type=int, default=20)
    p_lab.add_argument("--convert-delta", type=float, default=-0.10)
    p_lab.add_argument("--make-delta", type=float, default=0.0)
    p_lab.add_argument("--no-sensitivity", action="store_true")
    p_lab.add_argument(
        "--out",
        type=str,
        default=None,
        help="Optional directory for lab_result.json + REPORT.md",
    )
    p_lab.set_defaults(func=cmd_decision_lab)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())