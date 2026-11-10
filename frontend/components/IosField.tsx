import type { DailyItem } from "../lib/daily";
import { isGoalToGo, spotText, type Outcome } from "../lib/simpleGame";

// Compact side-on field from the iOS v2 mockup. 120 units: left end zone 0-10, field 10-110, right end zone 110-120.
// Same orientation as the TV bug: away team's end zone on the left, home on the right, on both the play and result
// screens. The offense attacks the defense's end zone. Neutral colors only (no team colors off the score bug).
const clamp = (v: number) => Math.max(-5, Math.min(105, v));

/** Football glyph (~18px): brown fill, white laces and a white rim so it holds contrast on the dark field. */
function Ball({ left }: { left: string }) {
  return (
    <svg className="igf-ball" style={{ left }} viewBox="0 0 20 12" width="20" height="12" aria-hidden="true">
      <ellipse cx="10" cy="6" rx="9" ry="5" fill="#8b4a1c" stroke="#fff" strokeWidth="1.4" />
      <path d="M6.5 6h7M8 4.6v2.8M10 4.6v2.8M12 4.6v2.8" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** Question: ball and yard label at the line of scrimmage (white), line to gain with a '1st' label (accent blue). Reveal: where the real play ended. */
export function IosField({ item, outcome }: { item: DailyItem; outcome?: Outcome | null }) {
  const s = item.situation;
  const home = s.home_team ?? s.defteam;
  const away = s.away_team ?? (home === s.posteam ? s.defteam : s.posteam);
  const rtl = s.posteam === home; // home offense attacks the left (away) end zone
  const num = (yardline100: number) => { const u = 10 + clamp(100 - yardline100); return ((rtl ? 120 - u : u) / 120) * 100; };
  const at = (yardline100: number) => `${num(yardline100)}%`;
  const reveal = outcome != null;
  const lines = [];
  // Faint 10-yard ticks along both sidelines; midfield runs the full height. Symmetric, so orientation-free.
  for (let v = 10; v <= 90; v += 10) {
    const left = `${((10 + v) / 120) * 100}%`;
    if (v === 50) { lines.push(<i key={v} className="igf-yd igf-mid" style={{ left }} />); continue; }
    lines.push(<i key={`b${v}`} className="igf-yd" style={{ left }} />, <i key={`t${v}`} className="igf-yd igf-top" style={{ left }} />);
  }
  const yl = s.yardline_100;
  const yardNum = yl > 50 ? 100 - yl : yl;
  const from = at(yl);
  const end = reveal ? outcome.endYardline100 : yl;
  const pathL = Math.min(num(yl), num(end)), pathW = Math.abs(num(yl) - num(end));
  return (
    <div className="igf-wrap">
      <div className={`igf${rtl ? " igf-rtl" : ""}`} role="img"
        aria-label={reveal ? `Field: the ball moved from ${spotText(item)}. ${outcome.label}.` : `Field: ball at ${spotText(item)}, ${s.posteam} going ${rtl ? "left" : "right"}`}>
        <span className="igf-ez igf-l">{away}</span>
        <span className="igf-ez igf-r">{home}</span>
        {lines}
        {reveal ? (
          <>
            <i className="igf-los igf-from" style={{ left: from }} />
            {end !== yl ? <i className="igf-path" style={{ left: `${pathL}%`, width: `${pathW}%` }} /> : null}
            <Ball left={at(end)} />
          </>
        ) : (
          <>
            {isGoalToGo(item) ? null : (
              <>
                <i className="igf-gain" style={{ left: at(Math.max(yl - s.distance, 0)) }} />
                <span className="igf-1st" style={{ left: at(Math.max(yl - s.distance, 0)) }} aria-hidden="true">1st</span>
              </>
            )}
            <i className="igf-los" style={{ left: from }} />
            <Ball left={from} />
            <span className="igf-yl" style={{ left: from }} aria-hidden="true">{yardNum}</span>
          </>
        )}
      </div>
      {reveal ? <p className="igf-pill" title={outcome.label}>{outcome.label}</p> : null}
    </div>
  );
}
