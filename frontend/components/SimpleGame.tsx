"use client";

import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RUN_PASS_4TH_1, runPassVerdict, showsRunPassBonus, type Guess } from "../lib/runPass";
import { shieldStreak } from "../lib/shields";
import {
  dailySet, dateKey, dayNumber, formatScore, loadStreak, practiceSet, recordDaily, saveStreak, scoreCall,
  type DailyItem, type ScoredCall,
} from "../lib/daily";
import { gameFileUrl, isGameFileV2 } from "../lib/gameFileV2";
import type { QuizChoice } from "../lib/quiz";
import {
  CHOICE_LABEL, RESULT_GLYPH, RESULT_TITLE, bestCallText, coachCallText, isGoalToGo, kickTooFar, optionTags,
  outcomeFromGame, plainShare, situationSentence, tappable, type Outcome,
} from "../lib/simpleGame";
import { teamNickname } from "../lib/teams";
import { agreedCount, challengeFor, encodeChallenge, SHORT, type ChallengeStatus } from "../lib/challenge";
import { CardSkeletons, PlayedToday } from "./EmptyState";
import { playedToday, streakLine } from "../lib/emptyState";
import { FieldView } from "./FieldView";
import { ModelLimits } from "./ModelLimits";
import { ScoreBug, teamLogo } from "./ScoreBug";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const nick = (a: string) => teamNickname(a);

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; outcomes: (Outcome | null)[] };
export type Pick = { pick: QuizChoice; scored: ScoredCall };

export function Header({ right }: { right: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sg-top">
      <Link href="/" className="sg-brand">Fourth <span>&amp;</span> Daily</Link>
      <div className="sg-top-r">
        <span className="sg-count">{right}</span>
        <button type="button" className="sg-menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>☰</button>
        {open ? (
          <nav className="sg-menu-list" aria-label="Menu">
            <Link href="/practice/">Practice</Link>
            <Link href="/endless/">Keep playing</Link>
            <Link href="/feed/">Play feed</Link>
            <Link href="/games/">Games</Link>
            <Link href="/daily/stats/">Stats</Link>
            <Link href="/about/">About</Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

export const Trademark = () => <p className="sg-tm-note">Team names and logos are trademarks of the NFL and its teams. Not affiliated.</p>;

export function SimpleGame({ mode = "daily" }: { mode?: "daily" | "practice" }) {
  const [key, setKey] = useState<string | null>(null);
  const [seed, setSeed] = useState("0");
  useEffect(() => { setKey(dateKey()); setSeed(String(Date.now())); }, []);
  const items: DailyItem[] = useMemo(() => (key == null ? [] : mode === "daily" ? dailySet(key) : practiceSet(seed)), [key, mode, seed]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [idx, setIdx] = useState(0);
  const [bonusSeen, setBonusSeen] = useState<number[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dare, setDare] = useState<ChallengeStatus>({ kind: "none" });
  const [dareCopied, setDareCopied] = useState(false);
  useEffect(() => {
    if (mode !== "daily" || key == null) return;
    setDare(challengeFor(window.location.hash, dayNumber(key), items.length));
  }, [key, mode, items.length]);
  const [already, setAlready] = useState<{ score: string; answered: number } | null>(null);
  useEffect(() => {
    if (mode !== "daily" || key == null) return;
    try { setAlready(playedToday(loadStreak(window.localStorage), key)); } catch { setAlready(null); }
  }, [key, mode]);

  useEffect(() => {
    if (key == null || items.length === 0) return;
    let live = true;
    setLoad({ state: "loading" });
    Promise.all(items.map(async (it) => {
      const r = await fetch(gameFileUrl(it.source.game_id ?? it.id.replace(/-\d+$/, ""), BASE));
      if (!r.ok) throw new Error(String(r.status));
      const doc: unknown = await r.json();
      if (!isGameFileV2(doc)) throw new Error("schema");
      return outcomeFromGame(doc, it, nick);
    }))
      .then((outcomes) => live && setLoad({ state: "ready", outcomes }))
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [key, items, attempt]);

  const done = items.length > 0 && picks.length === items.length && idx >= items.length;
  useEffect(() => {
    if (!done || key == null) return;
    const credit = picks.reduce((a, p) => a + p.scored.credit, 0);
    if (mode === "daily") {
      const st = window.localStorage;
      const next = recordDaily(loadStreak(st), { date: key, credit, answered: picks.length, results: picks.map((p) => p.scored.result) });
      saveStreak(st, next);
      setStreak(shieldStreak(next.history.map((h) => h.date), key).streak);
    }
  }, [done, key, mode, picks]);

  const choose = useCallback((c: QuizChoice) => {
    const it = items[idx];
    setPicks((p) => (p.length > idx ? p : [...p, { pick: c, scored: scoreCall(c, it) }]));
  }, [idx, items]);

  const dayNo = key ? dayNumber(key) : 0;
  const n = items.length;

  if (key != null && already && picks.length === 0) {
    return (
      <div className="sg-app">
        <Header right={`#${dayNo}`} />
        <PlayedToday score={already.score} answered={already.answered} />
        <Trademark />
      </div>
    );
  }
  if (key == null || (load.state === "loading" && n > 0)) {
    return (
      <div className="sg-app">
        <Header right="" />
        <CardSkeletons label={mode === "daily" ? "Loading today\u2019s plays…" : "Loading plays…"} />
        <Trademark />
      </div>
    );
  }
  if (n === 0) {
    return (
      <div className="sg-app">
        <Header right="" />
        <div className="sg-status" role="status">No plays today. Check back tomorrow.</div>
        <Trademark />
      </div>
    );
  }
  if (load.state === "error") {
    return (
      <div className="sg-app">
        <Header right="" />
        <div className="sg-status" role="alert">
          <p>{mode === "daily" ? "Couldn\u2019t load today\u2019s plays. Try again." : "Couldn\u2019t load plays. Try again."}</p>
          <button type="button" className="sg-next" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
        <Trademark />
      </div>
    );
  }
  const outcomes = load.state === "ready" ? load.outcomes : [];

  if (done) {
    const credit = picks.reduce((a, p) => a + p.scored.credit, 0);
    const share = plainShare(dayNo, picks.map((p) => p.scored.result), formatScore(credit), streak);
    return (
      <div className={`sg-app sg-end${dare.kind === "ok" ? " sg-vs" : ""}`}>
        <Header right={mode === "daily" ? `#${dayNo}` : "Practice"} />
        <div className="sg-lbl sg-center">{mode === "daily" ? `Fourth & Daily #${dayNo}` : "Practice"}</div>
        <div className="sg-big">{formatScore(credit)}/{n}</div>
        <div className="sg-marks" aria-label="Your results">
          {picks.map((p, i) => <span key={i} className={p.scored.result === "wrong" ? "sg-n" : "sg-y"}>{RESULT_GLYPH[p.scored.result]}</span>)}
        </div>
        {mode === "daily" && dare.kind === "ok"
          ? <div className="sg-streak">Same pick as your friend: {agreedCount(picks.map((x) => x.pick), dare.picks)} of {n}</div>
          : mode === "daily" ? <div className="sg-streak">{streakLine(streak)}</div> : null}
        <div className="sg-recap">
          {mode === "daily" && dare.kind === "ok" ? (
            <div className="sg-recap-key" aria-hidden="true"><span>Right call?</span><span className="sg-c">You · Friend</span></div>
          ) : null}
          {items.map((it, i) => (
            <div key={it.id} className={picks[i].scored.result === "wrong" ? "sg-n" : "sg-y"}>
              <b aria-label={RESULT_TITLE[picks[i].scored.result]}>{RESULT_GLYPH[picks[i].scored.result]}</b>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={teamLogo(it.situation.posteam)} alt="" width={22} height={22} className="sg-plate" />
              <span><strong>{it.situation.posteam}</strong> · 4th &amp; {isGoalToGo(it) ? "Goal" : it.situation.distance}</span>
              {dare.kind === "ok"
                ? <span className="sg-c" aria-label={`You ${SHORT[picks[i].pick]}, friend ${SHORT[dare.picks[i]]}, ${dare.picks[i] === picks[i].pick ? "same pick" : "different pick"}`}>{SHORT[picks[i].pick]} · <span className={dare.picks[i] === picks[i].pick ? "sg-same" : "sg-diff"}>{SHORT[dare.picks[i]]}</span> <span className="sg-agree" aria-hidden="true">{dare.picks[i] === picks[i].pick ? "=" : "≠"}</span></span>
                : <span className="sg-c">You: {CHOICE_LABEL[picks[i].pick]}</span>}
            </div>
          ))}
        </div>
        {mode === "daily" ? (
          <>
            <pre className="sg-share">{share}</pre>
            <div className="sg-pair">
              <button type="button" className="sg-next" onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ text: share });
                  else { await navigator.clipboard.writeText(share); setCopied(true); }
                } catch { /* dismissed */ }
              }}>{copied ? "Copied" : "Share"}</button>
              <button type="button" className="sg-keep sg-dare" onClick={async () => {
                const url = `${window.location.origin}${BASE}/daily/#${encodeChallenge(dayNo, picks.map((x) => x.pick))}`;
                const text = `Fourth & Daily #${dayNo}: can you match my calls?\n${url}`;
                try {
                  if (navigator.share) await navigator.share({ text });
                  else { await navigator.clipboard.writeText(text); setDareCopied(true); }
                } catch { /* dismissed */ }
              }}>{dareCopied ? "Link copied" : "Challenge"}</button>
            </div>
          </>
        ) : (
          <button type="button" className="sg-next" onClick={() => { setSeed(String(Date.now())); setIdx(0); setBonusSeen([]); setPicks([]); }}>Practice again</button>
        )}
        <Link href="/endless/" className="sg-keep">Keep playing</Link>
        <Trademark />
      </div>
    );
  }

  const it = items[idx];
  const p = picks[idx];
  const counter = mode === "daily" ? `Play ${idx + 1} of ${n}` : `Practice · ${idx + 1} of ${n}`;
  const banner = dare.kind === "bad" && idx === 0
    ? <p className="sg-dare-bad" role="status">This challenge link doesn&apos;t work. Play today&apos;s five instead.</p>
    : dare.kind === "ok" && idx === 0 ? <p className="sg-dare-ok" role="status">A friend challenged you. Their picks show after you finish.</p> : null;
  if (!p) return <QuestionScreen item={it} header={<Header right={counter} />} extra={banner} onPick={choose} />;
  if (showsRunPassBonus(p.pick, it.situation.distance, isGoalToGo(it)) && !bonusSeen.includes(idx)) {
    return <RunOrPass header={<Header right={counter} />} onDone={() => setBonusSeen((b) => [...b, idx])} />;
  }
  return (
    <RevealScreen item={it} pick={p} outcome={outcomes[idx]} header={<Header right={counter} />}
      nextLabel={idx + 1 < n ? "Next play" : "See your score"} onNext={() => setIdx(idx + 1)} />
  );
}

export function QuestionScreen({ item: it, header, onPick, extra }: { item: DailyItem; header: React.ReactNode; onPick: (c: QuizChoice) => void; extra?: React.ReactNode }) {
  return (
    <div className="sg-app">
      {header}
      {extra}
      <ScoreBug item={it} />
      <p className="sg-sent">{situationSentence(it, nick)}</p>
      <FieldView item={it} />
      <div className="sg-btns">
        {tappable(it).map((o) => (
          <button key={o.id} type="button" className="sg-btn" onClick={() => onPick(o.id)}>
            {CHOICE_LABEL[o.id]}{o.detail ? <small>{o.detail}</small> : null}
          </button>
        ))}
        {kickTooFar(it) ? <p className="sg-note">Too far to kick (65+ yards)</p> : null}
      </div>
      <Trademark />
    </div>
  );
}

export function RevealScreen({ item: it, pick: p, outcome: out, header, nextLabel, onNext, extra }: {
  item: DailyItem; pick: Pick; outcome: Outcome | null | undefined; header: React.ReactNode; nextLabel: string; onNext: () => void; extra?: React.ReactNode;
}) {
  const tags = optionTags(it, p.scored);
  const mine = tags.find((t) => t.id === p.pick)?.tag;
  const cls = { right: "sg-ok", close: "sg-half", wrong: "sg-no" }[p.scored.result];
  return (
    <div className={`sg-app sg-rv ${cls}`}>
      {header}
      {extra}
      <ScoreBug item={it} />
      <h1 className="sg-verdict" aria-live="polite"><span className="sg-glyph" aria-hidden="true">{RESULT_GLYPH[p.scored.result]}</span>{RESULT_TITLE[p.scored.result]}</h1>
      <div className="sg-res">
        <div className="sg-ln"><div className="sg-lbl">You picked</div><div className="sg-v">{CHOICE_LABEL[p.pick]} {mine ? <span className={`sg-tag ${mine === "Best" ? "sg-best" : "sg-close"}`}>{mine}</span> : null}</div></div>
        <div className="sg-ln"><div className="sg-lbl">The {nick(it.situation.posteam)} coach</div><div className="sg-v">{coachCallText(it)} {out?.text ?? ""} {out?.penalty ? `${out.penalty} ` : ""}{out?.finalText ? <span className="sg-final">{out.finalText}</span> : null}</div></div>
        <div className="sg-ln"><div className="sg-lbl">Best call</div><div className="sg-v">{bestCallText(tags)}</div></div>
      </div>
      <FieldView item={it} outcome={out ?? { endYardline100: it.situation.yardline_100, label: coachCallText(it).replace(/\.$/, ""), text: null, finalText: null }} />
      <div className="sg-btns">
        <button type="button" className="sg-next" onClick={onNext}>{nextLabel}</button>
      </div>
      <ModelLimits item={it} />
      <Trademark />
    </div>
  );
}

/** A3: optional bonus after Go on 4th-and-1. Real nflverse rates; never changes the score. */
function RunOrPass({ header, onDone }: { header: React.ReactNode; onDone: () => void }) {
  const [g, setG] = useState<Guess | null>(null);
  const { run, pass, seasons } = RUN_PASS_4TH_1;
  return (
    <div className="sg-app rp">
      {header}
      <p className="rp-tag">Bonus · not scored</p>
      <h1 className="rp-q">You went for it on 4th &amp; 1. Run or pass?</h1>
      {g == null ? (
        <div className="sg-btns rp-btns">
          <button type="button" className="sg-btn" onClick={() => setG("run")}>Run it</button>
          <button type="button" className="sg-btn" onClick={() => setG("pass")}>Throw it</button>
          <button type="button" className="sg-next rp-skip" onClick={onDone}>Skip</button>
        </div>
      ) : (
        <>
          <div className="rp-res" aria-live="polite">
            <p className="rp-v">{runPassVerdict(g)}</p>
            <div className="rp-row"><span>Run</span><span className="rp-bar"><i style={{ width: `${run.pct}%` }} /></span><b>{run.pct}%</b></div>
            <div className="rp-row"><span>Pass</span><span className="rp-bar"><i style={{ width: `${pass.pct}%` }} /></span><b>{pass.pct}%</b></div>
            <p className="rp-src">All NFL 4th-and-1 tries, {seasons}: {run.tries.toLocaleString()} runs, {pass.tries} passes.</p>
          </div>
          <div className="sg-btns"><button type="button" className="sg-next" onClick={onDone}>See the result</button></div>
        </>
      )}
      <Trademark />
    </div>
  );
}
