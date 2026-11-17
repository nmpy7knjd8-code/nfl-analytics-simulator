"use client";

import { useCallback, useEffect, useState } from "react";
import { periodName } from "../../../lib/clock";
import { PlayPenalty } from "../../../components/PlayText";
import { feedRowsFromGameV2, gameFileUrl, isGameFileV2, type FeedRow } from "../../../lib/gameFileV2";
import { TeamLogo } from "../../../components/TeamLogo";
import { teamNickname } from "../../../lib/teams";
import {
  driveAria,
  drivesUrl,
  gameDrives,
  isDrivesFile,
  playsLabel,
  qtrLabel,
  resultLabel,
  seasonNote,
  yardsLabel,
  type Drive,
} from "../../../lib/drives";

const ORD = ["", "1st", "2nd", "3rd", "4th"];
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PLAY_PREVIEW = 8;
const DRIVE_PREVIEW = 6;

function clock(sec: number | null): string {
  if (sec == null) return "—";
  const s = Math.max(0, Math.min(900, Math.floor(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type PlayState =
  | { kind: "loading" }
  | { kind: "ready"; rows: FeedRow[] }
  | { kind: "error" };

type DriveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; drives: Drive[]; dataThrough: string }
  | { kind: "error" };

function GamesPlayList({
  gameId,
  fallback,
  swingRanks,
  otWinner,
}: {
  gameId: string;
  fallback: FeedRow[];
  swingRanks: [string, number][];
  otWinner: string | null;
}) {
  const [state, setState] = useState<PlayState>({ kind: "loading" });
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    setState({ kind: "loading" });
    const ctrl = new AbortController();
    fetch(gameFileUrl(gameId, BASE), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((doc: unknown) => {
        if (!isGameFileV2(doc)) throw new Error("not game.v2");
        const fan = new Map(fallback.map((r) => [r.id, r.text]));
        const pen = new Map(fallback.map((r) => [r.id, r.penalty_text ?? null]));
        setState({ kind: "ready", rows: feedRowsFromGameV2(doc, fan, pen) });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [gameId, fallback]);
  useEffect(() => load(), [load]);

  const rows = state.kind === "ready" ? state.rows : fallback;
  const rank = new Map(swingRanks);
  const shown = open || rows.length <= PLAY_PREVIEW ? rows : rows.slice(0, PLAY_PREVIEW);
  const lastOtId = [...rows].reverse().find((p) => p.quarter > 4)?.id;

  useEffect(() => {
    const playHash = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (id.startsWith("play-") && rows.some((p) => `play-${p.id}` === id)) setOpen(true);
    };
    playHash();
    window.addEventListener("hashchange", playHash);
    return () => window.removeEventListener("hashchange", playHash);
  }, [rows]);

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!id.startsWith("play-") || !rows.some((p) => `play-${p.id}` === id)) return;
    if (!open && rows.length > PLAY_PREVIEW) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [open, rows]);
  const quarters: { q: number; items: FeedRow[] }[] = [];
  for (const p of shown) {
    const last = quarters.at(-1);
    if (last && last.q === p.quarter) last.items.push(p);
    else quarters.push({ q: p.quarter, items: [p] });
  }

  return (
    <div aria-busy={state.kind === "loading"}>
      <p className="ios-games-status" aria-live="polite">
        {state.kind === "loading" && !rows.length ? "Loading plays…" : `${rows.length} plays`}
      </p>
      {state.kind === "error" ? (
        <div className={rows.length ? "ios-games-note" : "ios-games-error"} role={rows.length ? undefined : "alert"}>
          {rows.length ? "Couldn’t reach the full play file, so this is the saved play list." : "Couldn’t load the plays for this game."}
          <button type="button" className="ios-show-all" onClick={() => load()}>
            Try again
          </button>
        </div>
      ) : null}
      {state.kind === "ready" && !rows.length ? <p className="ios-games-empty">No plays for this game yet.</p> : null}
      {quarters.map(({ q, items }) => (
        <section key={q} aria-label={periodName(q)}>
          <h3 className="ios-group-head">{periodName(q)}</h3>
          <ol className="ios-list ios-play-list">
            {items.map((p) => {
              const r = rank.get(p.id);
              return (
                <li className={`ios-list-row ios-play-row${r ? " is-swing" : ""}`} key={p.id} id={`play-${p.id}`}>
                  <span className="ios-play-meta">
                    {otWinner && p.id === lastOtId ? `${otWinner} wins it · ` : ""}
                    {periodName(p.quarter)} · {clock(p.clock_seconds)}
                    {p.down ? ` · ${ORD[p.down]} & ${p.distance}` : ""}
                    {r ? ` · Swing ${r}` : ""}
                  </span>
                  <span className="ios-play-text">
                    {p.text}
                    <PlayPenalty text={p.penalty_text} />
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {rows.length > PLAY_PREVIEW && !open ? (
        <button type="button" className="ios-show-all" onClick={() => setOpen(true)}>
          Show all {rows.length} plays
        </button>
      ) : null}
    </div>
  );
}

function GamesDriveList({ gameId }: { gameId: string }) {
  const [state, setState] = useState<DriveState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ kind: "loading" });
    fetch(drivesUrl(Number(gameId.slice(0, 4)), BASE), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((doc: unknown) => {
        if (!isDrivesFile(doc)) throw new Error("bad file");
        setState({ kind: "ready", drives: gameDrives(doc, gameId), dataThrough: doc.dataThrough });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [gameId]);

  if (state.kind === "loading" || state.kind === "idle") return <p className="ios-games-status" aria-live="polite">Loading drives…</p>;
  if (state.kind === "error" || !state.drives.length) {
    return (
      <div className="ios-games-empty" role="alert">
        <p>No drives for this game.</p>
      </div>
    );
  }
  const shown = open || state.drives.length <= DRIVE_PREVIEW ? state.drives : state.drives.slice(0, DRIVE_PREVIEW);
  return (
    <div>
      <p className="ios-games-status">{state.drives.length} drives</p>
      <ol className="ios-list ios-drive-list">
        {shown.map((d, i) => (
          <li key={i} className="ios-list-row ios-drive-row" aria-label={driveAria(d, teamNickname)}>
            <span className="ios-drive-top">
              <TeamLogo abbr={d.team} size={20} />
              <span className="ios-game-abbr">{teamNickname(d.team)}</span>
              <span className="ios-play-meta">
                {qtrLabel(d.qtr)} {d.clock}
              </span>
            </span>
            <span className="ios-play-text">{resultLabel(d.result, d.qtr, d.tiles[d.tiles.length - 1], d.ret)}</span>
            <span className="ios-play-meta">
              {playsLabel(d.tiles.length)} · {yardsLabel(d.yards)}
            </span>
          </li>
        ))}
      </ol>
      {state.drives.length > DRIVE_PREVIEW && !open ? (
        <button type="button" className="ios-show-all" onClick={() => setOpen(true)}>
          Show all {state.drives.length} drives
        </button>
      ) : null}
      <p className="ios-games-src">{seasonNote(state.dataThrough)}</p>
    </div>
  );
}

export function GameDetail({
  gameId,
  fallback,
  swingRanks,
  otWinner = null,
}: {
  gameId: string;
  fallback: FeedRow[];
  swingRanks: [string, number][];
  /** Team that won in overtime, named on the last OT play. No win-chance number. */
  otWinner?: string | null;
}) {
  const [tab, setTab] = useState<"plays" | "drives">("plays");
  return (
    <section className="ios-detail-feed">
      <div className="ios-seg" role="tablist" aria-label="Plays or drives">
        <button type="button" role="tab" className="ios-seg-btn" aria-selected={tab === "plays"} onClick={() => setTab("plays")}>
          Plays
        </button>
        <button type="button" role="tab" className="ios-seg-btn" aria-selected={tab === "drives"} onClick={() => setTab("drives")}>
          Drives
        </button>
      </div>
      <div role="tabpanel">
        {tab === "plays" ? (
          <GamesPlayList gameId={gameId} fallback={fallback} swingRanks={swingRanks} otWinner={otWinner} />
        ) : (
          <GamesDriveList gameId={gameId} />
        )}
      </div>
    </section>
  );
}
