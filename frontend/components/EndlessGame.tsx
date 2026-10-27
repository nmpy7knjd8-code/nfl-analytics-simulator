"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scoreCall, type DailyItem } from "../lib/daily";
import { accuracyText, addEndless, emptyEndless, loadEndless, nextEndless, resetEndless, saveEndless, tallyText, type EndlessScore } from "../lib/endless";
import { gameFileUrl, isGameFileV2 } from "../lib/gameFileV2";
import type { QuizChoice } from "../lib/quiz";
import { outcomeFromGame, type Outcome } from "../lib/simpleGame";
import { teamNickname } from "../lib/teams";
import { Header, QuestionScreen, RevealScreen, Trademark, type Pick } from "./SimpleGame";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Load = { state: "loading" } | { state: "error" } | { state: "empty" } | { state: "ready"; item: DailyItem; outcome: Outcome | null };

/** Endless play: random real 4th downs, no limit, running accuracy saved on this device. */
export function EndlessGame() {
  const seen = useRef(new Set<string>());
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [pending, setPending] = useState<DailyItem | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [score, setScore] = useState<EndlessScore>(emptyEndless());
  const [confirm, setConfirm] = useState(false);

  const fetchItem = useCallback(async (item: DailyItem) => {
    setLoad({ state: "loading" });
    setPending(item);
    try {
      const r = await fetch(gameFileUrl(item.source.game_id ?? item.id.replace(/-\d+$/, ""), BASE));
      if (!r.ok) throw new Error(String(r.status));
      const doc: unknown = await r.json();
      if (!isGameFileV2(doc)) throw new Error("schema");
      seen.current.add(item.id);
      setLoad({ state: "ready", item, outcome: outcomeFromGame(doc, item, teamNickname) });
    } catch {
      setLoad({ state: "error" });
    }
  }, []);

  const next = useCallback((last?: string) => {
    setPick(null);
    const item = nextEndless(seen.current, Math.random, undefined, last);
    if (!item) { setLoad({ state: "empty" }); return; }
    void fetchItem(item);
  }, [fetchItem]);

  useEffect(() => { setScore(loadEndless(window.localStorage)); next(); }, [next]);

  const onPick = (c: QuizChoice) => {
    if (load.state !== "ready" || pick) return;
    const scored = scoreCall(c, load.item);
    setPick({ pick: c, scored });
    setScore((s) => { const n = addEndless(s, scored); saveEndless(window.localStorage, n); return n; });
  };

  const header = <Header right="Keep playing" />;
  const bar = (
    <div className="sg-score" aria-live="polite">
      <span><b>{accuracyText(score)}</b> right</span>
      <span className="sg-score-n">{tallyText(score)}</span>
      <button type="button" className="sg-reset" onClick={() => setConfirm(true)} disabled={score.total === 0}>Reset</button>
    </div>
  );

  if (confirm) {
    return (
      <div className="sg-app">
        {header}
        <div className="sg-status" role="alertdialog" aria-labelledby="sg-reset-q">
          <p id="sg-reset-q">Reset your score? Your {tallyText(score)} ({accuracyText(score)}) will be cleared.</p>
          <button type="button" className="sg-next" onClick={() => { setScore(resetEndless(window.localStorage)); setConfirm(false); }}>Reset score</button>
          <button type="button" className="sg-btn sg-btn-c" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
        <Trademark />
      </div>
    );
  }
  if (load.state === "loading") {
    return (
      <div className="sg-app">{header}{bar}
        <div className="sg-status" role="status"><span className="sg-spin" aria-hidden="true" />Loading a play…</div>
        <Trademark /></div>
    );
  }
  if (load.state === "empty") {
    return (
      <div className="sg-app">{header}{bar}
        <div className="sg-status" role="status">No plays to show right now. Check back soon.</div>
        <Trademark /></div>
    );
  }
  if (load.state === "error") {
    return (
      <div className="sg-app">{header}{bar}
        <div className="sg-status" role="alert">
          <p>Couldn&apos;t load this play. Try again.</p>
          <button type="button" className="sg-next" onClick={() => pending && fetchItem(pending)}>Try again</button>
        </div>
        <Trademark /></div>
    );
  }
  if (!pick) return <QuestionScreen item={load.item} header={header} extra={bar} onPick={onPick} />;
  return <RevealScreen item={load.item} pick={pick} outcome={load.outcome} header={header} extra={bar} nextLabel="Next play" onNext={() => next(load.item.id)} />;
}
