import type { DailyItem } from "../lib/daily";
import { isGoalToGo, spotText, type Outcome } from "../lib/simpleGame";
import { teamColor, teamLogo, teamWordmark } from "./ScoreBug";

const W = 53.3;
const Y = (v: number) => 10 + v; // y=0 back of the defense end zone; offense drives up
const BX = 34.5;
const NUM = { textAnchor: "middle" as const, dy: 1.3, fontSize: 3.6, fontWeight: 800, fill: "#fff", opacity: 0.92, fontFamily: "'Arial Black',sans-serif" };

function Ball({ x, y, o = 1 }: { x: number; y: number; o?: number }) {
  return (
    <g opacity={o}>
      <ellipse cx={x} cy={y} rx={1.25} ry={2} fill="#6b3416" stroke="#2b1408" strokeWidth={0.2} />
      <line x1={x} x2={x} y1={y - 0.8} y2={y + 0.8} stroke="#fff" strokeWidth={0.22} />
    </g>
  );
}

/** Cropped top-down field (38-yard window). Question: ball, LOS, 1st-down line, arrow. Reveal: ball moves to where the real play ended. */
export function FieldView({ item, outcome }: { item: DailyItem; outcome?: Outcome | null }) {
  const s = item.situation;
  const home = s.home_team ?? s.defteam;
  const reveal = outcome != null;
  const los = Y(s.yardline_100);
  const fd = Y(Math.max(s.yardline_100 - s.distance, 0));
  const throughPosts = reveal && outcome.endYardline100 < 0;
  const endY = reveal ? (throughPosts ? 1.5 : Y(outcome.endYardline100)) : los;
  const EX = throughPosts ? W / 2 : BX;
  const h = 38;
  const c = (Math.min(los, endY) + Math.max(los, endY)) / 2 - 3;
  const y0 = Math.max(-1, Math.min(c - h / 2, 121 - h));
  const label = reveal ? outcome.label : "";
  const chipW = label.length * 1.62 + 2.6;
  // QA 0116 U2: keep the chip 1.6 field units (~10px at 390) inside the sidelines so it never looks clipped.
  const chipX = Math.max(1.6, Math.min(W - chipW - 1.6, EX > W / 2 ? EX - chipW - 3 : EX + 3));
  const chipY = throughPosts ? endY + 2.4 : endY - 4.8;
  const stripes = [];
  for (let y = 0; y < 120; y += 5) stripes.push(<rect key={y} x={0} y={y} width={W} height={5} fill={(y / 5) % 2 ? "#3f8a3a" : "#367d32"} />);
  const yardLines = [];
  for (let v = 0; v <= 100; v += 5) yardLines.push(<line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} stroke="#fff" strokeWidth={v % 100 ? 0.28 : 0.6} />);
  const hashes = [];
  for (let v = 1; v < 100; v++) if (v % 5) for (const x of [0.4, W / 2 - 3.45 - 0.5, W / 2 + 3.45 - 0.5, W - 1.4]) /* QA 0116 SG5: inbound hashes centred on W/2 */ hashes.push(<line key={`${v}-${x}`} x1={x} x2={x + 1} y1={Y(v)} y2={Y(v)} stroke="#fff" strokeWidth={0.22} />);
  const nums = [];
  for (let v = 10; v < 100; v += 10) {
    const n = v <= 50 ? v : 100 - v;
    nums.push(<text key={`l${v}`} x={9} y={Y(v)} transform={`rotate(90 9 ${Y(v)})`} {...NUM}>{n}</text>);
    nums.push(<text key={`r${v}`} x={W - 9} y={Y(v)} transform={`rotate(-90 ${W - 9} ${Y(v)})`} {...NUM}>{n}</text>);
  }
  return (
    <div className="sg-field">
      <svg viewBox={`0 ${y0} ${W} ${h}`} preserveAspectRatio={throughPosts ? "xMidYMin slice" : "xMidYMid slice"} role="img"
        aria-label={reveal ? `Field: the ball moved from ${spotText(item)}. ${label}.` : `Field: ball at ${spotText(item)}, ${s.posteam} going up`}>
        <defs>
          <filter id="sg-t"><feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves={2} seed={4} /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .16 0" /><feComposite in2="SourceGraphic" operator="in" /></filter>
          <filter id="sg-w"><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" /></filter>
          <filter id="sg-p"><feTurbulence baseFrequency="3" numOctaves={1} seed={2} /><feDisplacementMap in="SourceGraphic" scale={0.18} /></filter>
        </defs>
        {stripes}
        {[0, 110].map((z) => (
          <g key={z}>
            <rect x={0} y={z} width={W} height={10} fill={teamColor(home)} />
            <image href={teamWordmark(home)} x={6} y={z + 1.6} width={W - 12} height={6.8} preserveAspectRatio="xMidYMid meet" filter="url(#sg-w)" />
          </g>
        ))}
        <rect width={W} height={120} filter="url(#sg-t)" fill="#000" />
        <image href={teamLogo(home)} x={W / 2 - 5} y={Y(50) - 5} width={10} height={10} opacity={0.95} />
        <g filter="url(#sg-p)" opacity={0.9}>
          <rect x={0.3} y={0} width={W - 0.6} height={120} fill="none" stroke="#fff" strokeWidth={0.5} />
          {yardLines}{hashes}
        </g>
        <line x1={W / 2 - 3.1} x2={W / 2 + 3.1} y1={0.4} y2={0.4} stroke="#FFD400" strokeWidth={1.1} />
        <line x1={W / 2} x2={W / 2} y1={0} y2={1.6} stroke="#FFD400" strokeWidth={0.6} />
        <line x1={0} x2={W} y1={los} y2={los} stroke="#1E5BFF" strokeWidth={0.7} />
        <line x1={0} x2={W} y1={fd} y2={fd} stroke="#FFD400" strokeWidth={0.7} />
        <g filter="url(#sg-p)" opacity={0.95}>{nums}</g>
        {reveal ? (
          <>
            <Ball x={BX} y={los} o={0.45} />
            {endY !== los ? <line x1={BX} x2={EX} y1={los + (endY < los ? -2.2 : 2.2)} y2={endY + (endY < los ? 2.2 : -2.2)} stroke="#fff" strokeWidth={0.35} strokeDasharray=".9 .7" /> : null}
            <Ball x={EX} y={endY} />
            <g>
              <rect x={chipX} y={chipY - 2.1} width={chipW} height={4.2} rx={2.1} fill="#1E5BFF" />
              <text x={chipX + 1.3} y={chipY + 1.05} fontSize={2.8} fontWeight={700} fill="#fff">{label}</text>
            </g>
          </>
        ) : (
          <>
            {isGoalToGo(item) ? null : (
              <text x={BX + 2.5} y={fd - 1} fontSize={2.6} fontWeight={800} fill="#FFD400" stroke="#000" strokeWidth={0.45} paintOrder="stroke">1ST DOWN</text>
            )}
            <g transform={`translate(17 ${los - 1})`}><path d="M0 -3.2 L2.2 0 L.8 0 L.8 2.6 L-.8 2.6 L-.8 0 L-2.2 0Z" fill="#fff" stroke="#000" strokeWidth={0.15} /></g>
            <text x={17} y={los + 4.6} textAnchor="middle" fontSize={2.8} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={0.5} paintOrder="stroke">{s.posteam}</text>
            <Ball x={BX} y={los} />
          </>
        )}
      </svg>
    </div>
  );
}
