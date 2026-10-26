"""Situation Lab — offline read-only UI + API over decision-lab compare_transitions.

Separate from the fan-facing Next.js UI. Reuses compare_transition_modes; no
duplicated go/FG/punt scoring logic. Trusted WP artifact path only.

Pre-snap fixture/demo path shares the same payload shape; never claims a live feed.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse

from nfl_sim.config import REPO_ROOT

WP_MODEL_ARTIFACT = REPO_ROOT / "reports" / "wp" / "artifacts" / "wp_model.joblib"
STATIC_HTML = Path(__file__).resolve().parent / "static" / "situation_lab.html"

PRE_SNAP_DISCLAIMER = (
    "Offline estimate from a pre-snap snapshot fixture — not a live feed, "
    "not live odds or betting advice. Path A uncalibrated WP + REG train empirics only."
)

RECORDED_DEMO_DISCLAIMER = (
    "Offline estimate from a recorded demo frame — not a live feed, "
    "not live odds or betting advice. Path A uncalibrated WP + REG train empirics only."
)

OFFLINE_MAPPER_DISCLAIMER = (
    "Offline estimate from an offline provider-frame mapper — not a live feed, "
    "not live odds or betting advice. Path A uncalibrated WP + REG train empirics only."
)


def _join_or_and(parts: list[str], word: str) -> str:
    if len(parts) <= 2:
        return f" {word} ".join(parts)
    return ", ".join(parts[:-1]) + f", {word} " + parts[-1]


def layman_why_from_config(cfg: dict[str, Any]) -> str:
    """One-line plain-English why from existing summary fields only (no rescoring)."""
    rec = cfg.get("recommendation")
    values = cfg.get("values") or {}
    margin = cfg.get("margin")
    inconclusive = bool(cfg.get("inconclusive")) or rec == "inconclusive"
    try:
        m = float(margin) if margin is not None else None
    except (TypeError, ValueError):
        m = None
    margin_txt = f" (edge ≈ {m:.3f} WP)" if m is not None else ""

    labels_short = {"go": "going for it", "fg": "a field goal", "punt": "punting"}
    if inconclusive:
        return (
            "Too close to call — "
            + _join_or_and([labels_short[a] for a in ("go", "fg", "punt") if not values or a in values], "and")
            + " win chances are nearly tied"
            f"{margin_txt}."
        )
    labels = {"go": "going for it", "fg": "a field goal", "punt": "punting"}
    action = labels.get(str(rec), str(rec))
    others = [a for a in ("go", "fg", "punt") if a != rec and (not values or a in values)]
    try:
        ranked = sorted(
            ((k, float(values[k])) for k in ("go", "fg", "punt") if k in values),
            key=lambda kv: kv[1],
            reverse=True,
        )
        best_wp = ranked[0][1] if ranked else None
    except (TypeError, ValueError):
        best_wp = None
    wp_txt = f" (~{best_wp:.1%} win chance)" if best_wp is not None else ""
    alt = _join_or_and([labels.get(a, a) for a in others], "or")
    return (
        f"{action[0].upper() + action[1:]} looks best here{wp_txt} — "
        f"higher modeled win chance than {alt}{margin_txt}."
    )

# Long 4th down from own side is default (FG out of range); anchor included for contrast.
PRESETS: list[dict[str, Any]] = [
    {
        "id": "flip-lac-den",
        "label": "LAC@DEN 2022 W18 — 4th & 14 from their own 36 (punt)",
        "season": 2022,
        "game_id": "2022_18_LAC_DEN",
        "play_id": 3897,
        "note": "81-yard field goal is out of range, so the choice is go or punt",
        "default": True,
    },
    {
        "id": "anchor-bal-nyj",
        "label": "Anchor: BAL@NYJ 2022 W1 — 4th & 1 (rec stable)",
        "season": 2022,
        "game_id": "2022_01_BAL_NYJ",
        "play_id": 368,
        "note": "Early-game anchor; values barely move",
        "default": False,
    },
]


@lru_cache(maxsize=1)
def _load_analyzer():
    from nfl_sim.models.decision_lab import load_analyzer

    if not WP_MODEL_ARTIFACT.exists():
        return None
    return load_analyzer(WP_MODEL_ARTIFACT)


def _summarize_config(block: dict[str, Any]) -> dict[str, Any]:
    summary = block.get("summary") or {}
    analysis = block.get("analysis") or {}
    actions = analysis.get("actions") or {}
    assumptions = analysis.get("assumptions") or []
    punt = (actions.get("punt") or {}).get("components") or {}
    return {
        "recommendation": summary.get("recommendation"),
        "inconclusive": summary.get("inconclusive"),
        "margin": summary.get("margin"),
        "values": summary.get("values"),
        "p_convert": summary.get("p_convert"),
        "p_make": summary.get("p_make"),
        "empirics_mode": summary.get("empirics_mode"),
        "transition_mode": summary.get("transition_mode"),
        "clock_deltas_used": summary.get("clock_deltas_used"),
        "empirics_seasons": summary.get("empirics_seasons"),
        "empirics_n": summary.get("empirics_n"),
        "assumptions": assumptions,
        "punt_method": punt.get("method"),
        "punt_buckets": punt.get("buckets"),
        "opp_yardline_100_mean": punt.get("opp_yardline_100_mean", punt.get("opp_yardline_100")),
    }


def _payload_from_compare(cmp: dict[str, Any], *, truth_play: str, disclaimer: str) -> dict[str, Any]:
    play = dict(cmp["play"])
    play["truth"] = truth_play
    configs = {
        "pooled_legacy": _summarize_config(cmp["pooled_legacy"]),
        "season_aware_legacy": _summarize_config(cmp["season_aware_legacy"]),
        "pooled_improved": _summarize_config(cmp["pooled_improved"]),
    }
    # Primary “why” uses improved config (same scorer output; no new math).
    why = layman_why_from_config(configs["pooled_improved"])
    return {
        "truth_labels": {
            "play": truth_play,
            "action_values": "model_counterfactual",
            "disclaimer": disclaimer,
        },
        "play": play,
        "configs": configs,
        "layman_why": why,
        "recommendation_changed_legacy_to_improved": cmp[
            "recommendation_changed_legacy_to_improved"
        ],
        "value_deltas_legacy_to_improved": cmp["value_deltas_legacy_to_improved"],
        "clock_deltas_improved": cmp.get("clock_deltas_improved"),
        "wp_model": str(WP_MODEL_ARTIFACT),
        "offline": True,
        "live_feed": False,
    }


def build_situation_lab_payload(
    *,
    season: int,
    game_id: str,
    play_id: float,
) -> dict[str, Any]:
    """Freeze a lake play and run compare_transition_modes (reuse harness)."""
    from nfl_sim.models.decision_lab import (
        compare_transition_modes,
        load_fourth_down_frame,
        select_play,
    )

    analyzer = _load_analyzer()
    if analyzer is None:
        raise FileNotFoundError(
            f"Missing WP artifact: {WP_MODEL_ARTIFACT}. "
            "Train Path A WP first (uncalibrated primary; do not persist isotonic as default)."
        )
    frame = load_fourth_down_frame([int(season)], season_type="REG")
    row = select_play(frame, game_id=str(game_id), play_id=float(play_id))
    cmp = compare_transition_modes(analyzer, row, empirics_mode="pooled")
    return _payload_from_compare(
        cmp,
        truth_play="historical",
        disclaimer=(
            "Offline estimate — not live odds or betting advice. "
            "Path A uncalibrated WP + REG train empirics only."
        ),
    )


def build_situation_lab_payload_from_snapshot(
    raw: dict[str, Any],
) -> dict[str, Any]:
    """Validate pre-snap snapshot → same Situation Lab payload shape (fixture/demo).

    Never opens the lake to fill fields. Never claims live_feed.
    """
    from nfl_sim.models.decision_lab import compare_transition_modes
    from nfl_sim.providers.pre_snap import (
        PreSnapAdapterError,
        parse_pre_snap_snapshot,
        snapshot_to_decision_row,
        source_dict,
    )

    analyzer = _load_analyzer()
    if analyzer is None:
        raise FileNotFoundError(
            f"Missing WP artifact: {WP_MODEL_ARTIFACT}. "
            "Train Path A WP first (uncalibrated primary; do not persist isotonic as default)."
        )
    try:
        snap = parse_pre_snap_snapshot(raw)
        row = snapshot_to_decision_row(snap)
    except PreSnapAdapterError:
        raise
    cmp = compare_transition_modes(analyzer, row, empirics_mode="pooled")
    payload = _payload_from_compare(
        cmp,
        truth_play="pre_snap_fixture",
        disclaimer=PRE_SNAP_DISCLAIMER,
    )
    payload["source"] = source_dict(snap)
    payload["field_sources"] = dict(snap.field_sources)
    return payload


def create_situation_lab_router() -> APIRouter:
    router = APIRouter(tags=["situation-lab"])

    @router.get("/situation-lab", response_class=HTMLResponse)
    def situation_lab_page() -> FileResponse:
        if not STATIC_HTML.exists():
            raise HTTPException(status_code=500, detail="Situation Lab HTML missing")
        return FileResponse(STATIC_HTML, media_type="text/html; charset=utf-8")

    @router.get("/situation-lab/api/presets")
    def presets() -> dict[str, Any]:
        return {
            "items": PRESETS,
            "default_id": next(p["id"] for p in PRESETS if p.get("default")),
            "scope": "offline_read_only",
            "fan_ui": False,
        }

    @router.get("/situation-lab/api/compare")
    def compare(
        season: int = Query(default=2022, ge=2019, le=2022),
        game_id: str = Query(...),
        play_id: float = Query(...),
    ) -> dict[str, Any]:
        try:
            return build_situation_lab_payload(
                season=season, game_id=game_id, play_id=play_id
            )
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except (ValueError, IndexError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"situation lab compare failed: {exc}"
            ) from exc

    @router.get("/situation-lab/api/fixtures")
    def pre_snap_fixtures() -> dict[str, Any]:
        from nfl_sim.providers.pre_snap import list_fixtures

        return {
            "items": list_fixtures(),
            "scope": "offline_pre_snap_fixture",
            "live_feed": False,
            "fan_ui": False,
        }

    @router.get("/situation-lab/api/compare-pre-snap")
    def compare_pre_snap_fixture(
        fixture_id: str = Query(..., min_length=1),
    ) -> dict[str, Any]:
        from nfl_sim.providers.pre_snap import PreSnapAdapterError, load_fixture

        try:
            raw = load_fixture(fixture_id)
            return build_situation_lab_payload_from_snapshot(raw)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except PreSnapAdapterError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"pre-snap compare failed: {exc}"
            ) from exc

    @router.post("/situation-lab/api/compare-pre-snap")
    def compare_pre_snap_body(body: dict[str, Any]) -> dict[str, Any]:
        from nfl_sim.providers.pre_snap import PreSnapAdapterError

        try:
            return build_situation_lab_payload_from_snapshot(body)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PreSnapAdapterError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"pre-snap compare failed: {exc}"
            ) from exc

    @router.get("/situation-lab/api/recorded-demo/sequences")
    def recorded_demo_sequences() -> dict[str, Any]:
        from nfl_sim.providers.recorded_demo import list_sequences

        return {
            "items": list_sequences(),
            "scope": "offline_recorded_demo",
            "live_feed": False,
            "fan_ui": False,
            "mode": "recorded_demo",
        }

    @router.get("/situation-lab/api/recorded-demo/{sequence_id}")
    def recorded_demo_sequence(sequence_id: str) -> dict[str, Any]:
        from nfl_sim.providers.pre_snap import PreSnapAdapterError
        from nfl_sim.providers.recorded_demo import sequence_summary

        try:
            return sequence_summary(sequence_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PreSnapAdapterError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/situation-lab/api/recorded-demo/{sequence_id}/frame/{index}")
    def recorded_demo_frame_get(
        sequence_id: str,
        index: int,
        apply_suggested_fallback: bool = Query(default=False),
    ) -> dict[str, Any]:
        """Score one recorded frame. Rejected frames return 400 — no prior decision reuse."""
        from nfl_sim.providers.pre_snap import PreSnapAdapterError
        from nfl_sim.providers.recorded_demo import (
            get_frame,
            missing_allowlist_fields,
            prepare_snapshot_for_score,
        )

        try:
            frame = get_frame(sequence_id, index)
            snap = frame["snapshot"]
            missing = missing_allowlist_fields(snap)
            fb = None
            if missing and apply_suggested_fallback:
                fb = frame.get("suggested_user_fallback")
            raw = prepare_snapshot_for_score(frame, user_fallback=fb)
            payload = build_situation_lab_payload_from_snapshot(raw)
            # Relabel as recorded demo (not live).
            payload["truth_labels"]["play"] = "recorded_demo"
            payload["truth_labels"]["disclaimer"] = RECORDED_DEMO_DISCLAIMER
            payload["play"]["truth"] = "recorded_demo"
            payload["demo"] = {
                "sequence_id": sequence_id,
                "frame_index": index,
                "note": frame.get("note"),
                "expected": frame.get("expected"),
                "missing_allowlist": missing,
                "applied_suggested_fallback": bool(fb),
                "provider": "demo",
                "live_feed": False,
                "mode": "recorded_demo",
            }
            return payload
        except IndexError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PreSnapAdapterError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"recorded demo frame failed: {exc}"
            ) from exc

    @router.post("/situation-lab/api/recorded-demo/{sequence_id}/frame/{index}")
    def recorded_demo_frame_post(
        sequence_id: str,
        index: int,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Score frame with optional explicit user_fallback (allowlist only)."""
        from nfl_sim.providers.pre_snap import PreSnapAdapterError
        from nfl_sim.providers.recorded_demo import (
            get_frame,
            missing_allowlist_fields,
            prepare_snapshot_for_score,
        )

        body = body or {}
        try:
            frame = get_frame(sequence_id, index)
            fb = body.get("user_fallback")
            apply_suggested = bool(body.get("apply_suggested_fallback"))
            missing = missing_allowlist_fields(frame["snapshot"])
            if missing and fb is None and apply_suggested:
                fb = frame.get("suggested_user_fallback")
            raw = prepare_snapshot_for_score(frame, user_fallback=fb)
            payload = build_situation_lab_payload_from_snapshot(raw)
            payload["truth_labels"]["play"] = "recorded_demo"
            payload["truth_labels"]["disclaimer"] = RECORDED_DEMO_DISCLAIMER
            payload["play"]["truth"] = "recorded_demo"
            payload["demo"] = {
                "sequence_id": sequence_id,
                "frame_index": index,
                "note": frame.get("note"),
                "expected": frame.get("expected"),
                "missing_allowlist": missing,
                "applied_user_fallback": bool(fb),
                "provider": "demo",
                "live_feed": False,
                "mode": "recorded_demo",
            }
            return payload
        except IndexError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PreSnapAdapterError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"recorded demo frame failed: {exc}"
            ) from exc

    @router.get("/situation-lab/api/offline-mapper/frames")
    def offline_mapper_frames() -> dict[str, Any]:
        from nfl_sim.providers.offline_mapper import list_frames

        return {
            "items": list_frames(),
            "scope": "offline_provider_mapper",
            "live_feed": False,
            "fan_ui": False,
            "mode": "offline_mapper",
            "provider_enum": ["fixture", "demo"],
        }

    @router.get("/situation-lab/api/offline-mapper/map/{frame_id}")
    def offline_mapper_map_only(frame_id: str) -> dict[str, Any]:
        """Map bundled offline frame → snapshot only (no Lab score)."""
        from nfl_sim.providers.offline_mapper import (
            FRAME_REGISTRY,
            OfflineMapperError,
            map_frame_id,
        )
        from nfl_sim.providers.pre_snap import PreSnapAdapterError

        try:
            snap = map_frame_id(frame_id)
            return {
                "snapshot": snap,
                "frame_id": frame_id,
                "live_feed": False,
                "mode": "offline_mapper",
                "provider": snap["source"]["provider"],
                "note": FRAME_REGISTRY.get(frame_id, {}).get("note"),
            }
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except (OfflineMapperError, PreSnapAdapterError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/situation-lab/api/offline-mapper/compare/{frame_id}")
    def offline_mapper_compare(frame_id: str) -> dict[str, Any]:
        """Map bundled frame → existing adapter → Situation Lab. Rejects have no configs."""
        from nfl_sim.providers.offline_mapper import (
            FRAME_REGISTRY,
            OfflineMapperError,
            map_frame_id,
        )
        from nfl_sim.providers.pre_snap import PreSnapAdapterError

        try:
            snap = map_frame_id(frame_id)
            payload = build_situation_lab_payload_from_snapshot(snap)
            payload["truth_labels"]["play"] = "offline_mapper"
            payload["truth_labels"]["disclaimer"] = OFFLINE_MAPPER_DISCLAIMER
            payload["play"]["truth"] = "offline_mapper"
            payload["offline_mapper"] = {
                "frame_id": frame_id,
                "note": FRAME_REGISTRY.get(frame_id, {}).get("note"),
                "provider": snap["source"]["provider"],
                "live_feed": False,
                "mode": "offline_mapper",
                "yardline_100": snap["situation"]["yardline_100"],
            }
            return payload
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except (OfflineMapperError, PreSnapAdapterError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"offline mapper compare failed: {exc}"
            ) from exc

    @router.post("/situation-lab/api/offline-mapper/compare")
    def offline_mapper_compare_body(body: dict[str, Any]) -> dict[str, Any]:
        """POST offline_provider_frame.v1 → map → adapter → Lab."""
        from nfl_sim.providers.offline_mapper import OfflineMapperError, map_offline_frame
        from nfl_sim.providers.pre_snap import PreSnapAdapterError

        try:
            snap = map_offline_frame(body)
            payload = build_situation_lab_payload_from_snapshot(snap)
            payload["truth_labels"]["play"] = "offline_mapper"
            payload["truth_labels"]["disclaimer"] = OFFLINE_MAPPER_DISCLAIMER
            payload["play"]["truth"] = "offline_mapper"
            payload["offline_mapper"] = {
                "provider": snap["source"]["provider"],
                "live_feed": False,
                "mode": "offline_mapper",
                "yardline_100": snap["situation"]["yardline_100"],
            }
            return payload
        except (OfflineMapperError, PreSnapAdapterError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"offline mapper compare failed: {exc}"
            ) from exc

    # --- Fourth-down quiz (offline; reuses freeze + compare; no live feed) ---

    @router.get("/situation-lab/api/quiz/pack")
    def quiz_pack() -> dict[str, Any]:
        """Curated situations without model reveal (hide until lock-in)."""
        from nfl_sim.quiz.pack import public_pack

        try:
            return public_pack()
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @router.get("/situation-lab/api/quiz/pack/full")
    def quiz_pack_full() -> dict[str, Any]:
        """Full pack including reveal (for static Pages export / offline client).

        Clients must still hide ``reveal`` until lock-in. Not a live feed.
        """
        from nfl_sim.quiz.pack import load_curated_pack

        try:
            data = load_curated_pack()
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return {
            **data,
            "offline": True,
            "live_feed": False,
            "hide_reveal_until_lock_in": True,
        }

    @router.post("/situation-lab/api/quiz/score")
    def quiz_score(body: dict[str, Any]) -> dict[str, Any]:
        """Score a choice against baked reveal (or optional live freeze rematerialize).

        Body: ``{situation_id, choice, session?}``. Does not recompute WP math.
        """
        from nfl_sim.quiz.pack import get_pack_item, reveal_for_item
        from nfl_sim.quiz.scoring import score_quiz_choice, update_session_stats

        situation_id = body.get("situation_id")
        choice = body.get("choice")
        if not situation_id or not choice:
            raise HTTPException(
                status_code=400, detail="situation_id and choice are required"
            )
        try:
            item = get_pack_item(str(situation_id))
            scored = score_quiz_choice(str(choice), reveal_for_item(item))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        session = update_session_stats(body.get("session"), scored)
        return {
            "situation_id": situation_id,
            "offline": True,
            "live_feed": False,
            "scored": scored,
            "session": session,
            "label": item.get("label"),
            "situation": item.get("situation"),
            "source": item.get("source"),
        }

    return router
