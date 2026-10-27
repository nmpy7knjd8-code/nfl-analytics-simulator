import { elapsed, periodName, wpLabel, type GameFile, type NumberedSwing } from "../lib/gameStory";

const W = 400;
const H = 200;
const PAD = { l: 6, r: 12, t: 12, b: 22 };

/** Home-team win chance across the game: quarter gridlines, swing dots numbered 1–5. No motion. */
/**
 * `file` should be regulation-only (regulationOnly) for OT games: house rule #73, no OT win chance.
 * For those, the line ends on a labelled "End of regulation" dot and the right 10% is an OT band.
 */
export function GameChart({ file, swings, overtime = false }: { file: GameFile; swings: NumberedSwing[]; overtime?: boolean }) {
  const { home, away } = file.game;
  const plays = file.plays;
  const regEnd = Math.max(3600, ...plays.map(elapsed));
  // UI recheck P1-C: reserve the right ~10% of the x-axis for the OT band.
  const end = overtime ? regEnd / 0.9 : regEnd;
  const x = (t: number) => PAD.l + (t / end) * (W - PAD.l - PAD.r);
  const y = (wp: number) => PAD.t + (1 - wp) * (H - PAD.t - PAD.b);
  const pts = plays.map((p) => [x(elapsed(p)), y(p.home_wp)] as const);
  const last = plays[plays.length - 1];
  // Non-OT games end on the final result; OT games stop at the last regulation snap.
  const endWp = overtime ? last.home_wp_after : file.final_home_wp;
  pts.push([x(elapsed(last)), y(endWp)]);
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const marks = [900, 1800, 2700, 3600].filter((t) => t < end || t === 3600);
  const labels = [1, 2, 3, 4];
  return (
    <svg className="gs-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${home} win chance through the game; ${swings.length} numbered swing plays`}>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} className="gs-mid" />
      {marks.map((t) => (
        <line key={t} x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} className="gs-grid" />
      ))}
      {labels.map((q) => {
        const a = (q - 1) * 900;
        const b = q * 900;
        return (
          <text key={q} x={x((a + b) / 2)} y={H - 8} className="gs-axis" textAnchor="middle">
            {periodName(q)}
          </text>
        );
      })}
      <text x={PAD.l + 2} y={PAD.t + 10} className="gs-axis">{home} wins</text>
      <text x={PAD.l + 2} y={H - PAD.b - 4} className="gs-axis">{away} wins</text>
      {overtime ? <rect x={x(regEnd)} y={PAD.t} width={W - PAD.r - x(regEnd)} height={H - PAD.t - PAD.b} className="gs-ot-band" /> : null}
      <path d={d} className="gs-line" />
      {overtime ? (
        <g>
          <title>{`End of regulation ${away} ${last.away_score} – ${home} ${last.home_score}: ${wpLabel(endWp, home, away)}`}</title>
          <circle cx={x(regEnd)} cy={y(endWp)} r="5" className="gs-end-dot" />
        </g>
      ) : null}
      {swings.map((s) => (
        <g key={s.play.play_id}>
          <title>{`${s.n}. ${periodName(s.play.qtr)} ${s.play.clock}: ${wpLabel(s.play.home_wp_after, home, away)}`}</title>
          <circle cx={x(elapsed(s.play))} cy={y(s.play.home_wp_after)} r="8" className="gs-dot" />
          <text x={x(elapsed(s.play))} y={y(s.play.home_wp_after) + 3.5} className="gs-dot-n" textAnchor="middle">{s.n}</text>
        </g>
      ))}
    </svg>
  );
}
