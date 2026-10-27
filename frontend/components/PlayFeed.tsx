"use client";

import { useCallback, useEffect, useState } from "react";
import { periodName } from "../lib/clock";
import { feedRowsFromGameV2, gameFileUrl, isGameFileV2, type FeedRow } from "../lib/gameFileV2";

const ORD = ["", "1st", "2nd", "3rd", "4th"];
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function clock(sec: number | null): string {
  if (sec == null) return "—";
  const s = Math.max(0, Math.min(900, Math.floor(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; rows: FeedRow[] }
  | { kind: "error" };

/**
 * Game Story play-by-play from the live per-game file (/data/games/<id>.json, game.v2).
 * The static HTML ships `fallback` (the committed lib/plays rows) so the list is never blank;
 * fan text (display_text) comes from those rows by play_id because v2 carries only raw desc.
 */
export function PlayFeed({
  gameId,
  fallback,
  swingRanks,
}: {
  gameId: string;
  fallback: FeedRow[];
  swingRanks: [string, number][];
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const load = useCallback(() => {
    setState({ kind: "loading" });
    const ctrl = new AbortController();
    fetch(gameFileUrl(gameId, BASE_PATH), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((doc: unknown) => {
        if (!isGameFileV2(doc)) throw new Error("not game.v2");
        const fan = new Map(fallback.map((r) => [r.id, r.text]));
        setState({ kind: "ready", rows: feedRowsFromGameV2(doc, fan) });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [gameId, fallback]);
  useEffect(() => load(), [load]);

  const rows = state.kind === "ready" ? state.rows : fallback;
  const rank = new Map(swingRanks);
  const quarters: { q: number; items: FeedRow[] }[] = [];
  for (const p of rows) {
    const last = quarters.at(-1);
    if (last && last.q === p.quarter) last.items.push(p);
    else quarters.push({ q: p.quarter, items: [p] });
  }

  return (
    <div className="play-feed-wrap" aria-busy={state.kind === "loading"}>
      <p className="list-count" aria-live="polite">
        {state.kind === "loading" && !rows.length ? "Loading plays…" : `${rows.length} plays`}
      </p>
      {state.kind === "error" ? (
        <div className={rows.length ? "play-feed-note" : "error-band"} role={rows.length ? undefined : "alert"}>
          {rows.length ? "Couldn’t reach the full play file, so this is the saved play list." : "Couldn’t load the plays for this game."}
          <button type="button" className="btn play-feed-retry" onClick={() => load()}>
            Try again
          </button>
        </div>
      ) : null}
      {state.kind === "ready" && !rows.length ? (
        <p className="muted play-feed-soon">No plays for this game yet.</p>
      ) : null}
      {state.kind === "loading" && !rows.length ? (
        <ol className="play-feed play-feed-skeleton" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="play-card" />
          ))}
        </ol>
      ) : null}
      {quarters.map(({ q, items }) => (
        <section className="play-quarter" key={q} aria-label={periodName(q)}>
          <h3 className="play-quarter-head">{periodName(q)}</h3>
          <ol className="play-feed">
            {items.map((p) => {
              const r = rank.get(p.id);
              return (
                <li className={`play-card${r ? " is-swing" : ""}`} key={p.id} id={`play-${p.id}`}>
                  <span className="play-meta">
                    {periodName(p.quarter)} · {clock(p.clock_seconds)}
                    {p.down ? ` · ${ORD[p.down]} & ${p.distance}` : ""}
                  </span>
                  <p className="play-desc">
                    {r ? (
                      <span className="swing-badge" aria-label={`Swing play ${r}`}>
                        {r}
                      </span>
                    ) : null}
                    {p.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
