import type { DailyItem } from "../lib/daily";
import { isGoalToGo, spotText, type Outcome } from "../lib/simpleGame";

// Compact side-on field from the iOS v2 mockup. 120 units: own end zone 0-10, field 10-110, their end zone 110-120.
// The offense always drives left to right. Neutral colors only (no team colors off the score bug).
const pct = (fromOwnGoal: number) => `${((10 + Math.max(-5, Math.min(105, fromOwnGoal))) / 120) * 100}%`;
const at = (yardline100: number) => pct(100 - yardline100);

/** Question: ball and yard label at the line of scrimmage (white), line to gain (accent blue). Reveal: where the real play ended. */
export function IosField({ item, outcome }: { item: DailyItem; outcome?: Outcome | null }) {
  const s = item.situation;
  const reveal = outcome != null;
  const lines = [];
  // Faint 10-yard ticks along both sidelines; midfield runs the full height.
  for (let v = 10; v <= 90; v += 10) {
    if (v === 50) { lines.push(<i key={v} className="igf-yd igf-mid" style={{ left: pct(v) }} />); continue; }
    lines.push(<i key={`b${v}`} className="igf-yd" style={{ left: pct(v) }} />, <i key={`t${v}`} className="igf-yd igf-top" style={{ left: pct(v) }} />);
  }
  const yl = s.yardline_100;
  const yardNum = yl > 50 ? 100 - yl : yl;
  const from = at(s.yardline_100);
  const end = reveal ? outcome.endYardline100 : s.yardline_100;
  const lo = Math.min(100 - s.yardline_100, 100 - end), hi = Math.max(100 - s.yardline_100, 100 - end);
  return (
    <div className="igf-wrap">
      <div className="igf" role="img"
        aria-label={reveal ? `Field: the ball moved from ${spotText(item)}. ${outcome.label}.` : `Field: ball at ${spotText(item)}, ${s.posteam} going right`}>
        <span className="igf-ez igf-own">{s.posteam}</span>
        <span className="igf-ez igf-opp">{s.defteam}</span>
        {lines}
        {reveal ? (
          <>
            <i className="igf-los igf-from" style={{ left: from }} />
            {end !== s.yardline_100 ? <i className="igf-path" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} /> : null}
            <b className="igf-ball" style={{ left: at(end) }} />
          </>
        ) : (
          <>
            {isGoalToGo(item) ? null : <i className="igf-gain" style={{ left: at(Math.max(s.yardline_100 - s.distance, 0)) }} />}
            <i className="igf-los" style={{ left: from }} />
            <b className="igf-ball" style={{ left: from }} />
            <span className="igf-yl" style={{ left: from }} aria-hidden="true">{yardNum}</span>
          </>
        )}
      </div>
      {reveal ? <p className="igf-pill" title={outcome.label}>{outcome.label}</p> : null}
    </div>
  );
}
