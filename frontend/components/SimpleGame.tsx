"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteMenu } from "./SiteMenu";
import { IosChevron, IosGlyph } from "./IosGlyph";
import { usePlayChrome } from "./usePlayChrome";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RUN_PASS_4TH_1, runPassVerdict, showsRunPassBonus, type Guess } from "../lib/runPass";
import { shieldStreak } from "../lib/shields";
import {
  dateKey, dayNumber, formatScore, loadStreak, recordDaily, saveStreak, scoreCall,
  type DailyItem, type ScoredCall,
} from "../lib/daily";
import { addCoachDay, coachTally, entryFor, loadCoach, saveCoach, type CoachEntry } from "../lib/coachTally";
import { gameFileUrl, isGameFileV2 } from "../lib/gameFileV2";
import type { QuizChoice } from "../lib/quiz";
import {
  CHOICE_LABEL, RESULT_GLYPH, RESULT_TITLE, bestCallText, coachCallText, flagText, isGoalToGo, kickTooFar, optionTags,
  outcomeFromGame, plainShare, situationLine, situationSentence, tappable, type Outcome,
} from "../lib/simpleGame";
import { teamNickname } from "../lib/teams";
import { agreedCount, challengeFor, encodeChallenge, SHORT, type ChallengeStatus } from "../lib/challenge";
import { CardSkeletons, PlayedToday } from "./EmptyState";
import { playedToday, streakLine } from "../lib/emptyState";
import { FieldView } from "./FieldView";
import { ModelLimits } from "./ModelLimits";
import { BreakEvenBar } from "./BreakEvenBar";
import { ScoreBug, teamLogo } from "./ScoreBug";
import { TvScoreBug } from "./TvScoreBug";
import { IosField } from "./IosField";
import themeSchedule from "../lib/themeSchedule.json";
import { hasThemedDay } from "../lib/themeReveal";
import { CONFIDENCE_STEPS, HARD_NEXT_LABEL, calibrationText, gameItems, readConfs, readHard, writeConfs, writeHard } from "../lib/hardMode";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const nick = (a: string) => teamNickname(a);

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; outcomes: (Outcome | null)[] };
export type Pick = { pick: QuizChoice; scored: ScoredCall };

const BACK_ICON = (
  <svg width="12" height="22" viewBox="0 0 12 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 11l8 9" /></svg>
);

export function Header({ right, onBack, backHref, showMenu = true }: { right: string; onBack?: () => void; backHref?: string; showMenu?: boolean }) {
  const playChrome = Boolean(onBack || backHref);
  return (
    <header className={playChrome ? "sg-top sg-top-play" : "sg-top"}>
      <div className="sg-top-l">
        {onBack ? (
          <button type="button" className="sg-back" aria-label="Back" onClick={onBack}>{BACK_ICON}</button>
        ) : backHref ? (
          <Link href={backHref} className="sg-back" aria-label="Back">{BACK_ICON}</Link>
        ) : null}
      </div>
      <Link href="/" className="sg-brand">Fourth{" "}<span>&amp;</span>{" "}Daily</Link>
      {right ? <span className="sg-count">{right}</span> : null}
      <div className="sg-top-r">
        {showMenu ? <SiteMenu /> : null}
      </div>
    </header>
  );
}

function formatHubDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function TodayHub({ dayKey, item, onStart }: { dayKey: string; item: DailyItem; onStart: () => void }) {
  const nick = teamNickname(item.situation.posteam);
  return (
    <div className="sg-app">
      <Header right="" />
      <h1 className="ios-large-title sg-today-title">Today</h1>
      <p className="sg-today-date">{formatHubDate(dayKey)}</p>
      <section className="ios-card sg-today-card" aria-label="Today's 4th downs">
        <p className="sg-today-kicker">Five real 4th downs</p>
        <p className="sg-today-sit">{nick} ball · {flagText(item)}.</p>
        <button type="button" className="sg-today-go" onClick={onStart}>Make the call</button>
      </section>
      <ul className="ios-list sg-today-list">
        <li>
          <Link href="/practice/" className="ios-list-row">
            <IosGlyph name="practice" />
            <span className="ios-list-text"><span className="ios-list-label">Practice</span></span>
            <IosChevron />
          </Link>
        </li>
        <li>
          <Link href="/daily/stats/" className="ios-list-row">
            <IosGlyph name="stats" />
            <span className="ios-list-text"><span className="ios-list-label">Your stats</span></span>
            <IosChevron />
          </Link>
        </li>
      </ul>
      <Trademark />
    </div>
  );
}

export const Trademark = () => <p className="sg-tm-note">Team names and logos are trademarks of the NFL and its teams. Not affiliated.</p>;

/** The daily game (/ and /daily) wears the iOS v2 play screen (app/ios-game.css, scoped to .ios-game); practice is unchanged. */
export function SimpleGame({ mode = "daily" }: { mode?: "daily" | "practice" }) {
  return mode === "daily" ? <div className="ios-game"><SimpleGamePlay mode="daily" /></div> : <SimpleGamePlay mode={mode} />;
}

/** Thin 5-segment progress bar under the play bar (daily only). */
function PlayProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="ig-prog" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} className={i <= step ? "ig-on" : ""} />)}
    </div>
  );
}

function SimpleGamePlay({ mode }: { mode: "daily" | "practice" }) {
  const ios = mode === "daily";
  const router = useRouter();
  const [started, setStarted] = useState(mode !== "daily");
  const [key, setKey] = useState<string | null>(null);
  const [seed, setSeed] = useState("0");
  useEffect(() => { setKey(dateKey()); setSeed(String(Date.now())); }, []);
  const items: DailyItem[] = useMemo(() => gameItems(mode, key, seed), [key, mode, seed]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [idx, setIdx] = useState(0);
  const [bonusSeen, setBonusSeen] = useState<number[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [coach, setCoach] = useState<{ today: CoachEntry[]; season: CoachEntry[] } | null>(null);
  const [dare, setDare] = useState<ChallengeStatus>({ kind: "none" });
  const [dareCopied, setDareCopied] = useState(false);
  useEffect(() => {
    if (mode !== "daily" || key == null) return;
    setDare(challengeFor(window.location.hash, dayNumber(key), items.length));
  }, [key, mode, items.length]);
  // E6 Hard mode: daily only. `hard` is fixed when the day loads; the end-screen
  // toggle only changes the saved setting (`hardNext`), which applies from the next daily.
  const [hard, setHard] = useState(false);
  const [hardNext, setHardNext] = useState(false);
  const [confs, setConfs] = useState<(number | null)[]>([]);
  const [pending, setPending] = useState<QuizChoice | null>(null);
  useEffect(() => {
    if (mode !== "daily") return;
    const v = readHard(typeof window === "undefined" ? null : window.localStorage);
    setHard(v); setHardNext(v);
  }, [mode]);
  useEffect(() => { if (mode === "daily" && key != null) setConfs(readConfs(window.localStorage, key)); }, [mode, key]);
  const toggleHardNext = () => { const v = !hardNext; setHardNext(v); writeHard(window.localStorage, v); };
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
  const inPlay = (mode === "practice" || started) && !done && !(already && picks.length === 0) && load.state === "ready" && items.length > 0;
  usePlayChrome(inPlay);
  useEffect(() => {
    if (!done || key == null) return;
    const credit = picks.reduce((a, p) => a + p.scored.credit, 0);
    if (mode === "daily") {
      const st = window.localStorage;
      const next = recordDaily(loadStreak(st), { date: key, credit, answered: picks.length, results: picks.map((p) => p.scored.result) });
      saveStreak(st, next);
      setStreak(shieldStreak(next.history.map((h) => h.date), key).streak);
      const today = picks.map((p, i) => entryFor(key, items[i], p.pick)).filter((e): e is CoachEntry => e != null);
      const season = addCoachDay(loadCoach(st), key, today);
      saveCoach(st, season);
      setCoach({ today, season });
    }
  }, [done, key, mode, picks, items]);

  const commit = useCallback((c: QuizChoice) => {
    const it = items[idx];
    setPicks((p) => (p.length > idx ? p : [...p, { pick: c, scored: scoreCall(c, it) }]));
  }, [idx, items]);
  const isHard = hard && mode === "daily";
  const choose = useCallback((c: QuizChoice) => { if (isHard) setPending(c); else commit(c); }, [isHard, commit]);
  const lockConfidence = (v: number) => {
    if (pending == null) return;
    setConfs((cs) => { const n = [...cs]; n[idx] = v; if (key != null) writeConfs(window.localStorage, key, n); return n; });
    commit(pending); setPending(null);
  };

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
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${BASE}/daily/`;
    const share = plainShare(dayNo, picks.map((p) => p.scored.result), formatScore(credit), streak, shareUrl);
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
        {(() => {
          const line = isHard ? calibrationText(confs, picks.map((x) => x.scored.credit)) : null;
          return line ? <p className="sg-calib">{line}</p> : null;
        })()}
        {mode === "daily" ? (
          <label className="sg-hard"><input type="checkbox" checked={hardNext} onChange={toggleHardNext} /><span>{HARD_NEXT_LABEL}</span></label>
        ) : null}
        {mode === "daily" && coach && coach.today.length ? <CoachLine today={coach.today} season={coach.season} /> : null}
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
            <div className="ig-rows">
              <button type="button" className="ig-row sg-dare" onClick={async () => {
                const url = `${window.location.origin}${BASE}/daily/#${encodeChallenge(dayNo, picks.map((x) => x.pick))}`;
                const text = `Fourth & Daily #${dayNo}: can you match my calls?\n${url}`;
                try {
                  if (navigator.share) await navigator.share({ text });
                  else { await navigator.clipboard.writeText(text); setDareCopied(true); }
                } catch { /* dismissed */ }
              }}><span>{dareCopied ? "Challenge link copied" : "Challenge a friend"}</span><span className="ig-chev" aria-hidden="true">›</span></button>
              {hasThemedDay(themeSchedule.days as Record<string, { ids: string[] }>, key ?? "") ? (
                <>
                  {/* Plain <a>: a same-page hash change must fire hashchange so DailyOrBonus swaps to the bonus round. */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a href={`${BASE}/daily/#bonus`} className="ig-row sg-bonus"><span>Bonus round</span><span className="ig-chev" aria-hidden="true">›</span></a>
                </>
              ) : null}
            </div>
            <div className="ig-end-btns">
              <button type="button" className="sg-next" onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ text: share });
                  else { await navigator.clipboard.writeText(share); setCopied(true); }
                } catch { /* dismissed */ }
              }}>{copied ? "Copied" : "Share"}</button>
              <Link href="/endless/" className="sg-keep">Keep playing</Link>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="sg-next" onClick={() => { setSeed(String(Date.now())); setIdx(0); setBonusSeen([]); setPicks([]); }}>Practice again</button>
            <Link href="/endless/" className="sg-keep">Keep playing</Link>
          </>
        )}
        <Trademark />
      </div>
    );
  }

  if (mode === "daily" && !started && load.state === "ready") {
    return <TodayHub dayKey={key!} item={items[0]} onStart={() => setStarted(true)} />;
  }

  const it = items[idx];
  const p = picks[idx];
  const counter = mode === "daily" ? `Play ${idx + 1} of ${n}` : `Practice · ${idx + 1} of ${n}`;
  const onPlayBack = mode === "daily" ? () => setStarted(false) : () => router.push("/");
  const playHeader = ios
    ? <><Header right={counter} onBack={onPlayBack} /><PlayProgress step={idx} total={n} /></>
    : <Header right={counter} onBack={onPlayBack} />;
  const banner = dare.kind === "bad" && idx === 0
    ? <p className="sg-dare-bad" role="status">This challenge link doesn&apos;t work. Play today&apos;s five instead.</p>
    : dare.kind === "ok" && idx === 0 ? <p className="sg-dare-ok" role="status">A friend challenged you. Their picks show after you finish.</p> : null;
  if (!p && isHard && pending != null) {
    return (
      <div className="sg-app">
        {playHeader}
        <p className="sg-lbl">Hard mode</p>
        <p className="sg-conf-sit">{situationLine(it)}</p>
        <h1 className="sg-sent sg-conf-q">How sure are you about <b>{CHOICE_LABEL[pending]}</b>?</h1>
        <div className="sg-conf" role="group" aria-label="Your confidence">
          {CONFIDENCE_STEPS.map((c) => <button key={c} type="button" className="sg-btn sg-conf-b" aria-pressed={confs[idx] === c} onClick={() => lockConfidence(c)}>{c}%</button>)}
        </div>
        <button type="button" className="sg-keep" onClick={() => setPending(null)}>Change my pick</button>
        <Trademark />
      </div>
    );
  }
  if (!p) return <QuestionScreen item={it} header={playHeader} extra={banner} onPick={choose} ios={ios} />;
  if (showsRunPassBonus(p.pick, it.situation.distance, isGoalToGo(it)) && !bonusSeen.includes(idx)) {
    return <RunOrPass header={playHeader} onDone={() => setBonusSeen((b) => [...b, idx])} />;
  }
  return (
    <RevealScreen item={it} pick={p} outcome={outcomes[idx]} header={playHeader} ios={ios}
      nextLabel={idx + 1 < n ? "Next play" : "See your score"} onNext={() => setIdx(idx + 1)} />
  );
}

/** iOS v2 short question: "Browns ball. Go for it or kick?" (kick = field goal; "or punt?" when no kick is offered). */
export function shortQuestion(it: DailyItem): string {
  const kick = tappable(it).some((o) => o.id === "fg");
  return `${nick(it.situation.posteam)} ball. Go for it or ${kick ? "kick" : "punt"}?`;
}

/** iOS v2 choice subtitles. Display only; never feeds scoring. */
export function choiceSubtitle(it: DailyItem, id: QuizChoice): string {
  const s = it.situation;
  if (id === "go") return isGoalToGo(it) ? "Goal to go" : `${s.distance} yd${s.distance === 1 ? "" : "s"} to go`;
  if (id === "fg") return `${Math.round(s.yardline_100 + 18)} yds`;
  return "Kick it away";
}

export function QuestionScreen({ item: it, header, onPick, extra, ios = false }: { item: DailyItem; header: React.ReactNode; onPick: (c: QuizChoice) => void; extra?: React.ReactNode; ios?: boolean }) {
  return (
    <div className="sg-app">
      {header}
      {extra}
      {ios ? <TvScoreBug item={it} /> : <ScoreBug item={it} />}
      <p className={ios ? "sg-sent ig-qs" : "sg-sent"}>{ios ? shortQuestion(it) : situationSentence(it, nick)}</p>
      {ios ? <IosField item={it} /> : <FieldView item={it} />}
      <div className="sg-btns">
        {tappable(it).map((o) => {
          const d = ios ? choiceSubtitle(it, o.id) : o.detail;
          return (
            <button key={o.id} type="button" className="sg-btn" onClick={() => onPick(o.id)}>
              {CHOICE_LABEL[o.id]}{d ? <small>{d}</small> : null}
            </button>
          );
        })}
        {kickTooFar(it) ? <p className="sg-note">Too far to kick (65+ yards)</p> : null}
      </div>
      <Trademark />
    </div>
  );
}

export function RevealScreen({ item: it, pick: p, outcome: out, header, nextLabel, onNext, extra, ios = false }: {
  item: DailyItem; pick: Pick; outcome: Outcome | null | undefined; header: React.ReactNode; nextLabel: string; onNext: () => void; extra?: React.ReactNode; ios?: boolean;
}) {
  const shown = out ?? { endYardline100: it.situation.yardline_100, label: coachCallText(it).replace(/\.$/, ""), text: null, finalText: null };
  const tags = optionTags(it, p.scored);
  const mine = tags.find((t) => t.id === p.pick)?.tag;
  const cls = { right: "sg-ok", close: "sg-half", wrong: "sg-no" }[p.scored.result];
  return (
    <div className={`sg-app sg-rv ${cls}`}>
      {header}
      {extra}
      {ios ? <TvScoreBug item={it} /> : <ScoreBug item={it} />}
      <h1 className="sg-verdict" aria-live="polite"><span className="sg-glyph" aria-hidden="true">{RESULT_GLYPH[p.scored.result]}</span>{RESULT_TITLE[p.scored.result]}</h1>
      <div className="sg-res">
        <div className="sg-ln"><div className="sg-lbl">You picked</div><div className="sg-v">{CHOICE_LABEL[p.pick]} {mine && !(ios && mine !== "Best") ? <span className={`sg-tag ${mine === "Best" ? "sg-best" : "sg-close"}`}>{mine}</span> : null}</div></div>
        <div className="sg-ln"><div className="sg-lbl">The {nick(it.situation.posteam)} coach</div><div className="sg-v">{coachCallText(it)} {out?.text ?? ""} {out?.penalty ? `${out.penalty} ` : ""}{out?.finalText ? <span className="sg-final">{out.finalText}</span> : null}</div></div>
        <div className="sg-ln"><div className="sg-lbl">Best call</div><div className="sg-v">{bestCallText(tags)}</div></div>
        <BreakEvenBar distance={it.situation.distance} yardline100={it.situation.yardline_100} reveal={it.reveal} />
      </div>
      {ios ? <IosField item={it} outcome={shown} /> : <FieldView item={it} outcome={shown} />}
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

/** A2: one line on the end screen; the full record is on the stats page. */
function CoachLine({ today, season }: { today: CoachEntry[]; season: CoachEntry[] }) {
  const t = coachTally(today), s = coachTally(season);
  return (
    <Link href="/daily/stats/#coach" className="sg-coach">
      <span>Same call as the coach: <b>{t.agreed} of {today.length}</b></span>
      <span className="sg-c" aria-label={`All time: agreed ${s.agreed}, didn't ${s.differed}`}>{s.agreed}–{s.differed} ›</span>
    </Link>
  );
}
