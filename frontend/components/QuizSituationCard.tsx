import {
  ballProgress,
  formatClock,
  yardLineCaption,
  type QuizSituation,
} from "../lib/quiz";
import { ordinalDown, periodLabel, teamNickname } from "../lib/teams";

function TeamMark({ abbr }: { abbr: string }) {
  return (
    <span className="quiz-team-mark" aria-hidden>
      {abbr.slice(0, 2)}
    </span>
  );
}

function TimeoutDots({ count }: { count: number }) {
  return (
    <span className="quiz-to" aria-label={`${count} timeouts`}>
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className={`quiz-to-dot${i < count ? " is-on" : ""}`} />
      ))}
    </span>
  );
}

function FieldTrack({ situation }: { situation: QuizSituation }) {
  const progress = ballProgress(situation.yardline_100);
  // Arrow sits on 0–100 field (own EZ → opp EZ); clamp away from edges
  const left = Math.max(4, Math.min(96, progress));

  return (
    <div className="quiz-track" role="img" aria-label="Field position">
      <svg
        className="quiz-track-svg"
        viewBox="0 0 280 36"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Track rail */}
        <rect x="8" y="10" width="264" height="6" rx="3" fill="#3a3a3e" />
        {/* Tick marks every 10 yards */}
        {Array.from({ length: 11 }, (_, i) => {
          const x = 8 + (i / 10) * 264;
          const major = i === 0 || i === 5 || i === 10;
          return (
            <line
              key={i}
              x1={x}
              y1={major ? 6 : 8}
              x2={x}
              y2={major ? 20 : 18}
              stroke="#6a6a70"
              strokeWidth={major ? 1.6 : 1}
            />
          );
        })}
        {/* Yard labels: own 20, 50, opp 20 */}
        <text x={8 + 0.2 * 264} y="32" textAnchor="middle" className="quiz-track-label">
          20
        </text>
        <text x={8 + 0.5 * 264} y="32" textAnchor="middle" className="quiz-track-label">
          50
        </text>
        <text x={8 + 0.8 * 264} y="32" textAnchor="middle" className="quiz-track-label">
          20
        </text>
      </svg>
      <span
        className="quiz-track-arrow"
        style={{ left: `${left}%` }}
        title={yardLineCaption(situation.yardline_100, situation.posteam)}
      />
    </div>
  );
}

export function QuizSituationCard({ situation }: { situation: QuizSituation }) {
  const clock = formatClock(situation.game_seconds_remaining);
  const yardText = yardLineCaption(situation.yardline_100, situation.posteam);
  const downText = `${ordinalDown(situation.down)} & ${situation.distance}`;

  return (
    <section className="quiz-sit-card" aria-label="Game situation">
      <div className="quiz-sit-top">
        <div className="quiz-sit-teams">
          <div className="quiz-sit-row">
            <TeamMark abbr={situation.posteam} />
            <div className="quiz-sit-team-meta">
              <span className="quiz-sit-name">{teamNickname(situation.posteam)}</span>
              <TimeoutDots count={situation.posteam_timeouts} />
            </div>
            <span className="quiz-sit-score">{situation.posteam_score}</span>
          </div>
          <div className="quiz-sit-row">
            <TeamMark abbr={situation.defteam} />
            <div className="quiz-sit-team-meta">
              <span className="quiz-sit-name">{teamNickname(situation.defteam)}</span>
              <TimeoutDots count={situation.defteam_timeouts} />
            </div>
            <span className="quiz-sit-score">{situation.defteam_score}</span>
          </div>
        </div>
        <div className="quiz-sit-clock" aria-label={`${periodLabel(situation.qtr)} ${clock}`}>
          {periodLabel(situation.qtr)} - {clock}
        </div>
      </div>

      <div className="quiz-sit-bottom">
        <div className="quiz-sit-field">
          <TeamMark abbr={situation.posteam} />
          <FieldTrack situation={situation} />
        </div>
        <div className="quiz-sit-down">
          <span className="quiz-sit-down-main">{downText}</span>
          <span className="quiz-sit-down-yl">{yardText}</span>
        </div>
      </div>
    </section>
  );
}
