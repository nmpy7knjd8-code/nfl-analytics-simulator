"use client";

import { useId, useState } from "react";
import { CLOSE_LABEL } from "../lib/labels";
import {
  FOURTH_DOWN_SCENARIOS,
  getRecommendation,
  type FourthDownChoice,
  type FourthDownScenario,
  type Recommendation,
} from "../lib/fixtures";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function SituationBlock({ scenario }: { scenario: FourthDownScenario }) {
  const s = scenario.situation;
  return (
    <div className="decide-situation">
      <span className="decide-situation-line mono">
        {s.offense} ball · Q{s.quarter} {s.clock} · {s.scoreOffense}–{s.scoreDefense}
      </span>
      <span className="decide-situation-line">
        {s.down}th &amp; {s.distance} from the {s.yardline_100}
      </span>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const title =
    rec.kind === "inconclusive"
      ? CLOSE_LABEL
      : rec.option.label;

  const pickLine =
    rec.kind === "inconclusive"
      ? rec.leaders.map((o) => o.label).join(" or ")
      : null;

  return (
    <aside className="recommend" aria-live="polite">
      <div className="recommend-pick-col">
        <p className="recommend-kicker">Recommendation</p>
        <p className="recommend-pick">{title}</p>
        {pickLine ? <p className="recommend-alt muted">{pickLine}</p> : null}
      </div>
      <div className="recommend-why-col">
        <p className="recommend-why">
          <span className="recommend-why-label">Why</span>
          {rec.why}
        </p>
      </div>
    </aside>
  );
}

function OptionPanel({
  scenario,
  selected,
  onSelect,
  recommendation,
}: {
  scenario: FourthDownScenario;
  selected: FourthDownChoice;
  onSelect: (id: FourthDownChoice) => void;
  recommendation: Recommendation;
}) {
  const groupId = useId();
  const current = scenario.options.find((o) => o.id === selected) ?? scenario.options[0];
  const isRecommended =
    recommendation.kind === "pick"
      ? current.id === recommendation.option.id
      : recommendation.leaders.some((o) => o.id === current.id);

  return (
    <div className="decide-panel">
      <RecommendationCard rec={recommendation} />

      <div
        className="decide-choices"
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
      >
        <p id={`${groupId}-label`} className="sr-only">
          Choose go, kick, or punt
        </p>
        {scenario.options.map((opt) => {
          const active = opt.id === selected;
          const recommended =
            recommendation.kind === "pick"
              ? opt.id === recommendation.option.id
              : recommendation.leaders.some((o) => o.id === opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`decide-choice${active ? " is-active" : ""}${recommended ? " is-recommended" : ""}`}
              onClick={() => onSelect(opt.id)}
            >
              <span className="decide-choice-label">
                {opt.label}
                {recommended ? (
                  <span className="decide-choice-badge">
                    {recommendation.kind === "inconclusive" ? "Close" : "Best"}
                  </span>
                ) : null}
              </span>
              <span className="decide-choice-caption">{scenario.situation.offense} chance of winning</span>
              <span className="decide-choice-pct">{pct(opt.winChance)}</span>
            </button>
          );
        })}
      </div>

      <div className="decide-bars" aria-hidden>
        {scenario.options.map((opt) => (
          <div key={opt.id} className="decide-bar-row">
            <span className="decide-bar-label">{opt.shortLabel}</span>
            <div className="decide-bar-track">
              <div
                className={`decide-bar-fill${opt.id === selected ? " is-selected" : ""}`}
                style={{ width: `${Math.round(opt.winChance * 100)}%` }}
              />
            </div>
            <span className="mono decide-bar-pct">{scenario.situation.offense} {pct(opt.winChance)}</span>
          </div>
        ))}
      </div>

      <div key={current.id} className="decide-explainer truth-crossfade">
        <h3>{current.label}</h3>
        <p className="decide-why-inline">
          <span className="recommend-why-label">Why this call</span>
          {current.why}
        </p>
        <p>{current.plainResult}</p>
        <p className="muted">
          <strong>What usually happens:</strong> {current.whatUsuallyHappens}
        </p>
        {!isRecommended && recommendation.kind === "pick" ? (
          <p className="decide-callout muted">
            The recommendation stays <strong>{recommendation.option.label.toLowerCase()}</strong>{" "}
            — {recommendation.why}
          </p>
        ) : null}
        {!isRecommended && recommendation.kind === "inconclusive" ? (
          <p className="decide-callout muted">
            Still too close between{" "}
            {recommendation.leaders.map((o) => o.label.toLowerCase()).join(" and ")}.{" "}
            {recommendation.why}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const SEGMENT_LABELS: Record<string, string> = {
  "demo-4th-1": "Midfield",
  "demo-4th-2": "Goal line",
  "demo-4th-3": "Coin flip",
};

export function FourthDownLab() {
  const [scenarioId, setScenarioId] = useState(FOURTH_DOWN_SCENARIOS[0].id);
  const [selected, setSelected] = useState<FourthDownChoice>("go");
  const scenario =
    FOURTH_DOWN_SCENARIOS.find((s) => s.id === scenarioId) ?? FOURTH_DOWN_SCENARIOS[0];
  const recommendation = getRecommendation(scenario);

  return (
    <div className="decide-lab">
      <div className="segment segment-3" role="tablist" aria-label="Example situations">
        {FOURTH_DOWN_SCENARIOS.map((s) => {
          const active = s.id === scenario.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`segment-btn${active ? " is-active" : ""}`}
              onClick={() => {
                setScenarioId(s.id);
                setSelected("go");
              }}
            >
              {SEGMENT_LABELS[s.id] ?? s.title}
            </button>
          );
        })}
      </div>

      <header className="section-head decide-head">
        <h2>{scenario.title}</h2>
        <p>{scenario.setup}</p>
        <SituationBlock scenario={scenario} />
      </header>

      <OptionPanel
        scenario={scenario}
        selected={selected}
        onSelect={setSelected}
        recommendation={recommendation}
      />

    </div>
  );
}
