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
import { revealRow } from "../lib/revealRow";
import { ALL_CHOICES, closeCallNote, nearTieOptions, fgButton, formatPercents, fgTooFarButton, fgTooFarReveal } from "../lib/closeCall";


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
  const rowPct = useMemo(() => {
    const ids = availableChoices(item);
    const f = formatPercents(ids.map((c) => item.reveal.values[c] as number));
    return Object.fromEntries(ids.map((c, i) => [c, f[i]])) as Partial<Record<QuizChoice, string>>;
  }, [item]);
  const nearTie = useMemo(() => nearTieOptions(item).map((r) => r.c), [item]);

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
                      {off ? fgTooFarButton(item.situation) : id === "fg" ? fgButton(item.situation) : CHOICE_LABELS[id]}
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
                {scored.result === "near_tie" ? (
                  <span className="quiz-half"><span className="quiz-half-chip">½</span> point</span>
                ) : null}
              </p>
              <ul className="quiz-values">
                {ALL_CHOICES.map((id) => {
                  const v = scored.values[id];
                  const off = !availableChoices(item).includes(id);
                  // 2236 P1-E/P2-H: row state and text tag (see lib/revealRow.ts).
                  const { rec, picked: isPicked, close, tag } = revealRow(id, { inconclusive: scored.inconclusive, result: scored.result, recommendation: scored.recommendation, selected, nearTie, off });
                  return (
                    <li
                      key={id}
                      className={`quiz-value${rec ? " is-rec" : ""}${isPicked ? " is-picked" : ""}${off ? " is-off" : ""}${close ? " is-close" : ""}`}
                    >
                      <span>{CHOICE_LABELS[id]}</span>
                      <span className="quiz-value-right">{tag ? <span className="quiz-tag">{tag}</span> : null}{off ? <span className="quiz-value-off">{fgTooFarReveal(item.situation)}</span> : <span className="quiz-value-pct">{`${item.situation.posteam} ${rowPct[id] ?? pct(v)}`}</span>}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="quiz-why">{(scored.inconclusive && selected && scored.result !== "incorrect" ? closeCallNote(item, selected, scored.result) : null) ?? scored.layman_why}</p>
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
