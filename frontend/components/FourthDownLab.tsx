"use client";

import { useId, useState } from "react";
import {
  FOURTH_DOWN_SCENARIOS,
  type FourthDownChoice,
  type FourthDownScenario,
} from "../lib/fixtures";
import { TruthChip } from "./TruthChip";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function SituationLine({ scenario }: { scenario: FourthDownScenario }) {
  const s = scenario.situation;
  return (
    <p className="decide-situation">
      <span className="mono">
        {s.offense} ball · Q{s.quarter} {s.clock} · {s.scoreOffense}–{s.scoreDefense}
      </span>
      <span className="decide-situation-sep" aria-hidden>
        ·
      </span>
      <span>
        {s.down}th &amp; {s.distance} from the {s.yardline_100}
      </span>
    </p>
  );
}

function OptionPanel({
  scenario,
  selected,
  onSelect,
}: {
  scenario: FourthDownScenario;
  selected: FourthDownChoice;
  onSelect: (id: FourthDownChoice) => void;
}) {
  const groupId = useId();
  const best = scenario.options.reduce((a, b) =>
    a.winChance >= b.winChance ? a : b,
  );
  const current = scenario.options.find((o) => o.id === selected) ?? scenario.options[0];

  return (
    <div className="decide-panel">
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
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`decide-choice${active ? " is-active" : ""}`}
              onClick={() => onSelect(opt.id)}
            >
              <span className="decide-choice-label">{opt.label}</span>
              <span className="decide-choice-pct mono">{pct(opt.winChance)}</span>
              <span className="decide-choice-caption">chance of winning</span>
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
            <span className="mono decide-bar-pct">{pct(opt.winChance)}</span>
          </div>
        ))}
      </div>

      <div key={current.id} className="decide-explainer truth-crossfade">
        <h3>{current.label}</h3>
        <p>{current.plainResult}</p>
        <p className="muted">
          <strong>What usually happens:</strong> {current.whatUsuallyHappens}
        </p>
        {current.id === best.id ? (
          <p className="decide-callout">
            In this example, <strong>{current.label.toLowerCase()}</strong> leaves your
            team with the highest estimated chance of winning.
          </p>
        ) : (
          <p className="decide-callout muted">
            Compared with <strong>{best.label.toLowerCase()}</strong>, this looks like a
            lower win chance in the example numbers.
          </p>
        )}
      </div>
    </div>
  );
}

export function FourthDownLab() {
  const [scenarioId, setScenarioId] = useState(FOURTH_DOWN_SCENARIOS[0].id);
  const [selected, setSelected] = useState<FourthDownChoice>("go");
  const scenario =
    FOURTH_DOWN_SCENARIOS.find((s) => s.id === scenarioId) ?? FOURTH_DOWN_SCENARIOS[0];

  return (
    <div className="decide-lab">
      <div className="decide-scenario-tabs" role="tablist" aria-label="Example situations">
        {FOURTH_DOWN_SCENARIOS.map((s) => {
          const active = s.id === scenario.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`decide-tab${active ? " is-active" : ""}`}
              onClick={() => {
                setScenarioId(s.id);
                setSelected("go");
              }}
            >
              {s.title}
            </button>
          );
        })}
      </div>

      <header className="section-head decide-head">
        <div className="overline">
          <TruthChip kind="simulated" />
          <span className="muted">Example · not live</span>
        </div>
        <h2>{scenario.title}</h2>
        <p>{scenario.setup}</p>
        <SituationLine scenario={scenario} />
      </header>

      <OptionPanel
        scenario={scenario}
        selected={selected}
        onSelect={setSelected}
      />

      <p className="decide-footnote muted">{scenario.footnote}</p>
      <p className="decide-api-hook mono muted" title="Placeholder for sibling 4th-down API">
        Hook: {scenario.apiHook}
      </p>
    </div>
  );
}
