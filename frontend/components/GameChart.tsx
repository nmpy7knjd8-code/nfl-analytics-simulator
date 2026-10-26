import { elapsed, periodName, wpLabel, type GameFile, type NumberedSwing } from "../lib/gameStory";

const W = 640;
const H = 240;
const PAD = { l: 44, r: 12, t: 14, b: 26 };

/** Home-team win chance across the game: quarter gridlines, swing dots numbered 1–5. No motion. */
export function GameChart({ file, swings }: { file: GameFile; swings: NumberedSwing[] }) {
  const { home, away } = file.game;
  const plays = file.plays;
  const end = Math.max(3600, ...plays.map(elapsed));
  const x = (t: number) => PAD.l + (t / end) * (W - PAD.l - PAD.r);
  const y = (wp: number) => PAD.t + (1 - wp) * (H - PAD.t - PAD.b);
  const pts = plays.map((p) => [x(elapsed(p)), y(p.home_wp)] as const);
  const last = plays[plays.length - 1];
  pts.push([x(elapsed(last)), y(file.final_home_wp)]);
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const marks = [900, 1800, 2700, 3600].filter((t) => t < end || t === 3600);
  const labels = [1, 2, 3, 4, ...(end > 3600 ? [5] : [])];
  return (
    <svg className="gs-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${home} win chance through the game; ${swings.length} numbered swing plays`}>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} className="gs-mid" />
      {marks.map((t) => (
        <line key={t} x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} className="gs-grid" />
      ))}
      {labels.map((q) => {
        const a = (q - 1) * 900;
        const b = q > 4 ? end : q * 900;
        return (
          <text key={q} x={x((a + b) / 2)} y={H - 8} className="gs-axis" textAnchor="middle">
            {periodName(q)}
          </text>
        );
      })}
      <text x={PAD.l - 6} y={PAD.t + 4} className="gs-axis" textAnchor="end">{home} 100%</text>
      <text x={PAD.l - 6} y={y(0.5) + 4} className="gs-axis" textAnchor="end">50%</text>
      <text x={PAD.l - 6} y={H - PAD.b} className="gs-axis" textAnchor="end">{away} 100%</text>
      <path d={d} className="gs-line" />
      {swings.map((s) => (
        <g key={s.play.play_id}>
          <title>{`${s.n}. ${periodName(s.play.qtr)} ${s.play.clock}: ${wpLabel(s.play.home_wp_after, home, away)}`}</title>
          <circle cx={x(elapsed(s.play))} cy={y(s.play.home_wp_after)} r="9" className="gs-dot" />
          <text x={x(elapsed(s.play))} y={y(s.play.home_wp_after) + 4} className="gs-dot-n" textAnchor="middle">{s.n}</text>
        </g>
      ))}
    </svg>
  );
}
