"use client";
import { swingPctText } from "@/lib/stories/swings";

import { useState } from "react";
import type { Story } from "../../lib/stories/gameStory";
import { CALL_LABEL, spot } from "../../lib/stories/keyFourths";

/** C1 Pause: step through the game's key 4th downs, tap to see the real call. */
export function KeyFourths({ story }: { story: Story }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const keys = story.keys;
  if (!keys.length) return null;
  const done = i >= keys.length;
  const k = keys[Math.min(i, keys.length - 1)];
  const at = spot(k.team, k.yardline);
  return (
    <section className="gs-card gs-key" aria-label="Key 4th downs">
      <p className="gs-lbl">Key 4th down {done ? keys.length : i + 1} of {keys.length}</p>
      {done ? (
        <>
          <p className="gs-sent">That&apos;s every key 4th down in this game.</p>
          <button type="button" className="gs-oval" onClick={() => { setI(0); setShown(false); }}>Start over</button>
        </>
      ) : (
        <>
          <p className="gs-sent">{k.team} faces 4th and {k.togo}{at ? ` at the ${at}` : ""}.</p>
          <p className="gs-meta">Q{k.qtr} · {k.clock} · {k.team} ball</p>
          {shown ? (
            <>
              <p className="gs-call">{CALL_LABEL[k.call]}</p>
              <p className="gs-text">{story.rows.get(k.playId)?.text ?? ""}</p>
              <p className="gs-meta">Win chance swung {swingPctText(k.swing)} toward {k.toward}.</p>
              <button type="button" className="gs-oval gs-oval-fill" onClick={() => { setI(i + 1); setShown(false); }}>Continue</button>
            </>
          ) : (
            <button type="button" className="gs-oval gs-oval-fill" onClick={() => setShown(true)}>Show the call</button>
          )}
        </>
      )}
    </section>
  );
}
