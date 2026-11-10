import { neededRate, realRate, realRateLabel, realRateSource, realRateText } from "../lib/breakEven";

/** A1: one answer row with the real conversion-rate dot; the "needed" tick renders only behind the checker flag. */
export function BreakEvenBar({ distance, yardline100, reveal }: { distance: number; yardline100: number; reveal: unknown }) {
  const r = realRate(distance, yardline100);
  if (!r) {
    return (
      <div className="sg-ln be-row"><div className="sg-lbl">Going for it</div><div className="sg-v be-empty">Too few real tries here to show a rate.</div></div>
    );
  }
  const need = neededRate(reveal);
  const needPct = need === null ? null : Math.round(need * 100);
  return (
    <div className="sg-ln be-row">
      <div className="sg-lbl">{realRateLabel(r)}</div>
      <div className="sg-v be">
        <span className="be-text">{realRateText(r)}{needPct !== null ? ` · needs ${needPct}%` : ""} <span className="be-src">· {realRateSource(r)}</span></span>
        <span className="be-track" role="img" aria-label={`${r.pct}% of real tries converted${needPct === null ? "" : `; going needs ${needPct}%`}`}>
          {needPct !== null ? <span className="be-need" style={{ left: `${needPct}%` }} /> : null}
          <span className="be-dot" style={{ left: `${r.pct}%` }} />
        </span>
        <span className="be-ends" aria-hidden="true"><span>0%</span><span>100%</span></span>
      </div>
    </div>
  );
}
