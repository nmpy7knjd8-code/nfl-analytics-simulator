"""Quiz credit from existing scorer summary fields — no WP / transition math."""

from __future__ import annotations

from typing import Any, Literal

QuizResult = Literal["correct", "incorrect", "near_tie"]
QuizChoice = Literal["go", "fg", "punt"]

FULL_CREDIT = 1.0
PARTIAL_CREDIT = 0.5
NO_CREDIT = 0.0


def score_quiz_choice(choice: str, reveal: dict[str, Any]) -> dict[str, Any]:
    """Compare a user choice to a baked/live scorer reveal.

    Uses ``recommendation`` / ``inconclusive`` from Situation Lab /
    ``compare_transition_modes`` / ``FourthDownAnalyzer`` output only.
    Does not recompute margins or invent a second near-tie threshold.
    """
    choice_n = str(choice).strip().lower()
    if choice_n not in {"go", "fg", "punt"}:
        raise ValueError(f"choice must be go|fg|punt, got {choice!r}")

    rec = reveal.get("recommendation")
    inconclusive = bool(reveal.get("inconclusive")) or rec == "inconclusive"
    values = dict(reveal.get("values") or {})
    margin = reveal.get("margin")
    why = reveal.get("layman_why") or ""

    if inconclusive:
        result: QuizResult = "near_tie"
        credit = PARTIAL_CREDIT
    elif choice_n == str(rec):
        result = "correct"
        credit = FULL_CREDIT
    else:
        result = "incorrect"
        credit = NO_CREDIT

    return {
        "choice": choice_n,
        "result": result,
        "credit": credit,
        "recommendation": rec,
        "inconclusive": inconclusive,
        "margin": margin,
        "values": values,
        "layman_why": why,
        "historical_action": reveal.get("historical_action"),
        "assumptions": list(reveal.get("assumptions") or []),
        "transition_mode": reveal.get("transition_mode"),
        "empirics_mode": reveal.get("empirics_mode"),
    }


def update_session_stats(
    stats: dict[str, Any] | None,
    scored: dict[str, Any],
) -> dict[str, Any]:
    """Track streak + accuracy over a quiz session."""
    prev = dict(stats or {})
    answered = int(prev.get("answered") or 0) + 1
    credit_total = float(prev.get("credit_total") or 0.0) + float(scored["credit"])
    exact = int(prev.get("exact") or 0) + (1 if scored["result"] == "correct" else 0)
    near = int(prev.get("near_tie") or 0) + (1 if scored["result"] == "near_tie" else 0)
    wrong = int(prev.get("incorrect") or 0) + (1 if scored["result"] == "incorrect" else 0)

    if scored["result"] == "correct":
        streak = int(prev.get("streak") or 0) + 1
    else:
        streak = 0
    best = max(int(prev.get("best_streak") or 0), streak)

    return {
        "answered": answered,
        "credit_total": credit_total,
        "accuracy": (credit_total / answered) if answered else 0.0,
        "exact": exact,
        "near_tie": near,
        "incorrect": wrong,
        "streak": streak,
        "best_streak": best,
    }
