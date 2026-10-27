"use client";

import { useMemo, useState } from "react";
import { QuizNightField } from "./QuizNightField";
import { QuizSituationCard } from "./QuizSituationCard";
import {
  CHOICE_LABELS,
  QUIZ_ITEMS,
  availableChoices,
  emptySession,
  pct,
  scoreQuizChoice,
  updateSession,
  type QuizChoice,
  type QuizPhase,
  type QuizResult,
  type SessionStats,
} from "../lib/quiz";
import { CLOSE_LABEL } from "../lib/labels";
import { ALL_CHOICES, FG_OUT_OF_RANGE, closeCallWhy } from "../lib/closeCall";

const DOING_WORD: Record<QuizChoice, string> = { go: "going for it", fg: "field goal", punt: "punting" };

function resultLabel(result: QuizResult): string {
  if (result === "correct") return "Correct";
  if (result === "near_tie") return CLOSE_LABEL;
  return "Incorrect";
}

export function QuizGame() {
  const items = QUIZ_ITEMS;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>("situation");
  const [selected, setSelected] = useState<QuizChoice | null>(null);
  const [session, setSession] = useState<SessionStats>(emptySession);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [finished, setFinished] = useState(false);

  // Auto-start: first curated item is index 0 — no start gate.
  const item = items[index] ?? items[0];
  const scored = useMemo(() => {
    if (!selected || phase !== "reveal") return null;
    return scoreQuizChoice(selected, item.reveal, item.situation);
  }, [selected, phase, item]);

  function pick(choice: QuizChoice) {
    if (phase === "reveal") return;
    setSelected(choice);
    setPhase("confirm");
  }

  function lockIn() {
    if (!selected) return;
    const result = scoreQuizChoice(selected, item.reveal, item.situation);
    setSession((s) => updateSession(s, result));
    setShowAssumptions(false);
    setPhase("reveal");
  }

  function next() {
    if (index + 1 >= items.length) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setShowAssumptions(false);
    setPhase("situation");
  }

  function playAgain() {
    setSession(emptySession);
    setIndex(0);
    setSelected(null);
    setShowAssumptions(false);
    setPhase("situation");
    setFinished(false);
  }

  const sourceLine =
    item.source.season && item.source.week
      ? `${item.situation.away_team} @ ${item.situation.home_team} · ${item.source.season} Week ${item.source.week}`
      : "";

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

        {finished ? (
          <article className="quiz-play-card quiz-end" aria-live="polite">
            <h2>Practice done</h2>
            <p className="quiz-result">
              {session.exact} right · {session.near_tie} close · {session.incorrect} wrong
            </p>
            <p className="quiz-why">
              Score {pct(session.accuracy)} over {session.answered} calls. Best streak: {session.best_streak}.
            </p>
            <div className="quiz-reveal-actions">
              <button type="button" className="quiz-lock" onClick={playAgain}>
                Play again
              </button>
            </div>
          </article>
        ) : (
        /* One card: scoreboard + track + choices on first paint */
        <article className="quiz-play-card">
          <QuizSituationCard situation={item.situation} />

          {phase !== "reveal" ? (
            <div className="quiz-card-actions">
              <div
                className="quiz-choices"
                role="radiogroup"
                aria-label={`Choose ${availableChoices(item).map((c) => CHOICE_LABELS[c].toLowerCase()).join(" or ")}`}
              >
                {ALL_CHOICES.map((id) => {
                  const active = selected === id;
                  const off = !availableChoices(item).includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-disabled={off || undefined}
                      tabIndex={off ? -1 : undefined}
                      className={`quiz-choice${active ? " is-selected" : ""}${off ? " is-off" : ""}`}
                      onClick={off ? undefined : () => pick(id)}
                    >
                      {off ? `${CHOICE_LABELS[id]} · ${FG_OUT_OF_RANGE}` : CHOICE_LABELS[id]}
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
                {ALL_CHOICES.map((id) => {
                  const v = scored.values[id];
                  const off = !availableChoices(item).includes(id);
                  const close = scored.result === "near_tie" && !off && selected !== id && closeCallWhy(item).toLowerCase().includes(DOING_WORD[id]);
                  const rec =
                    !scored.inconclusive && scored.recommendation === id;
                  const isPicked = selected === id;
                  return (
                    <li
                      key={id}
                      className={`quiz-value${rec ? " is-rec" : ""}${isPicked ? " is-picked" : ""}${off ? " is-off" : ""}${close ? " is-close" : ""}`}
                    >
                      <span>{CHOICE_LABELS[id]}</span>
                      <span className="quiz-value-pct">{off ? "Out of range" : `${item.situation.posteam} ${pct(v)}`}</span>
                    </li>
                  );
                })}
              </ul>
              {scored.result === "near_tie" ? <p className="quiz-score-note">A close call is worth ½.</p> : null}
              <p className="quiz-why">{scored.result === "near_tie" ? closeCallWhy(item) : scored.layman_why}</p>
              {item.historical_action ? (
                <p className="quiz-hist">
                  What the team did:{" "}
                  {CHOICE_LABELS[item.historical_action as QuizChoice] ??
                    item.historical_action}
                </p>
              ) : null}
              <div className="quiz-reveal-actions">
                <button type="button" className="quiz-lock" onClick={next}>
                  {index + 1 >= items.length ? "See results" : "Next situation"}
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
        )}

        <p className="quiz-source">{sourceLine}</p>
      </div>
    </div>
  );
}
