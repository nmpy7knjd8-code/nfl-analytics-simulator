"use client";

import { useMemo, useState } from "react";
import { QuizNightField } from "./QuizNightField";
import { QuizSituationCard } from "./QuizSituationCard";
import {
  CHOICE_LABELS,
  QUIZ_ITEMS,
  emptySession,
  pct,
  scoreQuizChoice,
  updateSession,
  type QuizChoice,
  type QuizItem,
  type QuizPhase,
  type QuizResult,
  type SessionStats,
} from "../lib/quiz";

const CHOICES: QuizChoice[] = ["go", "fg", "punt"];

function resultLabel(result: QuizResult): string {
  if (result === "correct") return "Correct";
  if (result === "near_tie") return "Near-tie";
  return "Incorrect";
}

export type QuizGameProps = {
  /** Defaults to the full practice pack. */
  items?: QuizItem[];
  /** Fires once when the last item in `items` is locked in. */
  onSetComplete?: (session: SessionStats) => void;
  /** Fires on every lock-in with that situation's outcome. */
  onAnswer?: (result: QuizResult, item: QuizItem) => void;
  /** Optional crowd pick shares per item id. Shown with `crowdLabel` (e.g. "Example data"). */
  crowd?: Record<string, Partial<Record<QuizChoice, number>>>;
  crowdLabel?: string;
};

export function QuizGame({
  items = QUIZ_ITEMS,
  onSetComplete,
  onAnswer,
  crowd,
  crowdLabel,
}: QuizGameProps = {}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>("situation");
  const [selected, setSelected] = useState<QuizChoice | null>(null);
  const [session, setSession] = useState<SessionStats>(emptySession);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Auto-start: first curated item is index 0 — no start gate.
  const item = items[index] ?? items[0];
  const scored = useMemo(() => {
    if (!selected || phase !== "reveal") return null;
    return scoreQuizChoice(selected, item.reveal);
  }, [selected, phase, item]);

  function pick(choice: QuizChoice) {
    if (phase === "reveal") return;
    setSelected(choice);
    setPhase("confirm");
  }

  function lockIn() {
    if (!selected) return;
    const result = scoreQuizChoice(selected, item.reveal);
    const nextSession = updateSession(session, result);
    setSession(nextSession);
    onAnswer?.(result.result, item);
    if (index + 1 >= items.length) onSetComplete?.(nextSession);
    setShowAssumptions(false);
    setPhase("reveal");
  }

  function next() {
    setIndex(index + 1 >= items.length ? 0 : index + 1);
    setSelected(null);
    setShowAssumptions(false);
    setPhase("situation");
  }

  const sourceLine = item.source.game_id
    ? `${item.source.game_id} · play ${item.source.play_id}`
    : "Offline curated situation";

  return (
    <div className="quiz-shell">
      <QuizNightField />

      <div className="quiz-stage">
        <div className="quiz-progress-chip" aria-live="polite">
          {index + 1}/{items.length}
          {session.answered > 0
            ? ` · ${pct(session.accuracy)} · ${session.streak} streak`
            : ""}
        </div>

        {/* One card: scoreboard + track + choices on first paint */}
        <article className="quiz-play-card">
          <QuizSituationCard situation={item.situation} />

          {phase !== "reveal" ? (
            <div className="quiz-card-actions">
              <div
                className="quiz-choices"
                role="radiogroup"
                aria-label="Choose go, field goal, or punt"
              >
                {CHOICES.map((id) => {
                  const active = selected === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`quiz-choice${active ? " is-selected" : ""}`}
                      onClick={() => pick(id)}
                    >
                      {CHOICE_LABELS[id]}
                    </button>
                  );
                })}
              </div>

              {phase === "confirm" && selected ? (
                <button type="button" className="quiz-lock" onClick={lockIn}>
                  Lock in {CHOICE_LABELS[selected]}
                </button>
              ) : null}
            </div>
          ) : scored ? (
            <div className="quiz-card-actions quiz-reveal">
              <p className={`quiz-result is-${scored.result}`}>
                {resultLabel(scored.result)}
              </p>
              <ul className="quiz-values">
                {CHOICES.map((id) => {
                  const raw = scored.values[id];
                  const v = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
                  const rec =
                    !scored.inconclusive && scored.recommendation === id;
                  const picked = selected === id;
                  return (
                    <li
                      key={id}
                      className={`quiz-value${rec ? " is-rec" : ""}${picked ? " is-picked" : ""}`}
                    >
                      <span>{CHOICE_LABELS[id]}</span>
                      <span className="quiz-value-pct">{v == null ? "—" : pct(v)}</span>
                      {v != null ? (
                        <span className="quiz-value-bar" aria-hidden="true">
                          <span style={{ width: `${Math.round(v * 100)}%` }} />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="quiz-why">
                <strong>Why:</strong> {scored.layman_why}
              </p>
              {crowd?.[item.id] ? (
                <p className="quiz-crowd">
                  {crowdLabel ? <span className="quiz-crowd-label">{crowdLabel}</span> : null}{" "}
                  {CHOICES.map((id) => {
                    const share = crowd[item.id]?.[id];
                    return share == null ? null : `${pct(share)} ${CHOICE_LABELS[id].toLowerCase()}`;
                  })
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {item.historical_action ? (
                <p className="quiz-hist">
                  What the team did:{" "}
                  {CHOICE_LABELS[item.historical_action as QuizChoice] ??
                    item.historical_action}
                </p>
              ) : null}
              <div className="quiz-reveal-actions">
                <button type="button" className="quiz-lock" onClick={next}>
                  {index + 1 >= items.length ? "Play again" : "Next situation"}
                </button>
                <button
                  type="button"
                  className="quiz-ghost"
                  onClick={() => setShowAssumptions((v) => !v)}
                >
                  {showAssumptions ? "Hide assumptions" : "Review assumptions"}
                </button>
              </div>
              {showAssumptions && item.reveal.assumptions?.length ? (
                <ul className="quiz-assumptions">
                  {item.reveal.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </article>

        <p className="quiz-source">{sourceLine}</p>
      </div>
    </div>
  );
}
