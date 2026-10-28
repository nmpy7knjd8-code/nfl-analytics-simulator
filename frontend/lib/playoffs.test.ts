import { test } from "node:test";
import assert from "node:assert/strict";
import { CONF, SEASONS, bracket, roman } from "./playoffs";

test("every season has a full bracket: 6 WC (4 in 2019), 4 DIV, 2 CON, 1 SB; 89 games", () => {
  let n = 0;
  for (const s of SEASONS) {
    const b = bracket(s);
    assert.deepEqual(b.rounds.map((r) => r.games.length), [s === 2019 ? 4 : 6, 4, 2, 1], String(s));
    n += b.rounds.reduce((a, r) => a + r.games.length, 0);
  }
  assert.equal(n, 89);
});

test("conference map: every non-SB game is same-conference; SB is AFC vs NFC; 32 teams", () => {
  assert.equal(Object.keys(CONF).filter((t) => t !== "OAK").length, 32);
  for (const s of SEASONS) for (const r of bracket(s).rounds) for (const g of r.games) {
    if (r.key === "SB") assert.notEqual(CONF[g.home], CONF[g.away], g.id);
    else assert.equal(CONF[g.home], CONF[g.away], g.id);
  }
});

test("winners advance: each round's teams are the previous round's winners (byes enter at DIV)", () => {
  for (const s of SEASONS) {
    const [wc, div, con, sb] = bracket(s).rounds;
    const teams = (r: typeof wc) => r.games.flatMap((g) => [g.home, g.away]);
    for (const w of wc.games.map((g) => g.winner)) assert.ok(teams(div).includes(w), `${s} ${w}`);
    assert.deepEqual(teams(con).sort(), div.games.map((g) => g.winner).sort());
    assert.deepEqual(teams(sb).sort(), con.games.map((g) => g.winner).sort());
  }
});

test("Super Bowl names and champions", () => {
  assert.equal(roman(58), "LVIII");
  const b = bracket(2023);
  assert.equal(b.sbNumber, "LVIII");
  assert.equal(b.champion, "KC");
  assert.equal(b.rounds[3].games[0].overtime, true);
});
