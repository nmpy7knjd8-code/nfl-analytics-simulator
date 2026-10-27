import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
// tsconfig keeps jsx "preserve" for Next; under tsx the components compile to React.createElement.
(globalThis as { React?: typeof React }).React = React;
import { PenaltyText } from "../components/PenaltyText";
import { PlayFeed } from "../components/PlayFeed";
import { SwingPlayList, OvertimePlayList } from "../components/WinProbabilityChart";
import { findSwingPlays, inGameOrder } from "./winProbability";
import { WP_FIXTURES } from "./wpFixtures";
import type { FeedRow } from "./gameFileV2";

test("#106: penalty_text renders as span.play-penalty; null/empty renders nothing", () => {
  assert.equal(renderToStaticMarkup(<PenaltyText text="Flag on X (NYJ), declined." />), '<span class="play-penalty">Flag on X (NYJ), declined.</span>');
  assert.equal(renderToStaticMarkup(<PenaltyText text={null} />), "");
  assert.equal(renderToStaticMarkup(<PenaltyText text="  " />), "");
});

test("#106: play list rows show penalty after the play text, rows without one show none", () => {
  const rows: FeedRow[] = [
    { id: "709", quarter: 1, clock_seconds: 300, down: 3, distance: 4, text: "Zach Wilson pass incomplete.", penalty: "Flag on Mekhi Becton (NYJ) for ineligible downfield pass, declined." },
    { id: "710", quarter: 1, clock_seconds: 290, down: 4, distance: 4, text: "Thomas Morstead punts 50 yards.", penalty: null },
  ];
  const html = renderToStaticMarkup(<PlayFeed gameId="x" fallback={rows} swingRanks={[]} />);
  assert.match(html, /Zach Wilson pass incomplete\.<span class="play-penalty">Flag on Mekhi Becton/);
  assert.equal(html.match(/play-penalty/g)?.length, 1);
});

test("#106: BUF_NYJ Milano pick swing card shows its taunting penalty; OT card has none", () => {
  const w = WP_FIXTURES["2023_01_BUF_NYJ"];
  const sw = inGameOrder(findSwingPlays(w.series, 50));
  const html = renderToStaticMarkup(<SwingPlayList swings={sw.filter((s) => s.point.play_id === "1551")} series={w.series} />);
  assert.match(html, /<span class="play-penalty">Penalty on Matt Milano \(BUF\): taunting/);
  const ot = renderToStaticMarkup(<OvertimePlayList plays={w.overtimePlays} />);
  assert.doesNotMatch(ot, /play-penalty/);
  const otPen = renderToStaticMarkup(<OvertimePlayList plays={[{ ...w.overtimePlays[0], penalty_text: "Flag on Y (BUF), declined." }]} />);
  assert.match(otPen, /<span class="play-penalty">Flag on Y/);
});
