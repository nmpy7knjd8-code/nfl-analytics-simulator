/** Stylized CGI/SVG night stadium field — atmospheric base, not photography. */

export function QuizNightField() {
  return (
    <div className="quiz-night" aria-hidden="true">
      <div className="quiz-night-sky" />
      <div className="quiz-night-lights">
        <span className="quiz-night-light quiz-night-light-a" />
        <span className="quiz-night-light quiz-night-light-b" />
        <span className="quiz-night-light quiz-night-light-c" />
        <span className="quiz-night-light quiz-night-light-d" />
      </div>
      <svg
        className="quiz-night-field-svg"
        viewBox="0 0 400 180"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="quizGrass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a3d24" />
            <stop offset="55%" stopColor="#14301c" />
            <stop offset="100%" stopColor="#0a1610" />
          </linearGradient>
          <linearGradient id="quizLightBeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,248,220,0.22)" />
            <stop offset="45%" stopColor="rgba(255,248,220,0.06)" />
            <stop offset="100%" stopColor="rgba(255,248,220,0)" />
          </linearGradient>
          <linearGradient id="quizFieldFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="1" />
            <stop offset="35%" stopColor="#000" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Light beams from top of field plane */}
        <polygon points="40,-10 90,180 10,180" fill="url(#quizLightBeam)" />
        <polygon points="130,-10 175,180 95,180" fill="url(#quizLightBeam)" />
        <polygon points="270,-10 315,180 235,180" fill="url(#quizLightBeam)" />
        <polygon points="360,-10 400,180 320,180" fill="url(#quizLightBeam)" />
        {/* Field plane */}
        <path
          d="M-20 48 L420 48 L460 180 L-60 180 Z"
          fill="url(#quizGrass)"
        />
        {/* Yard lines (perspective-ish) */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
          const t = i / 10;
          const y = 52 + t * 118;
          const inset = 28 + t * 8;
          return (
            <line
              key={i}
              x1={inset}
              y1={y}
              x2={400 - inset}
              y2={y}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={i === 5 ? 1.6 : 0.8}
            />
          );
        })}
        {/* Sidelines */}
        <polyline
          points="28,52 8,170 392,170 372,52"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.4"
        />
        {/* Hash marks mid */}
        {[2, 4, 6, 8].map((i) => {
          const t = i / 10;
          const y = 52 + t * 118;
          return (
            <g key={`h-${i}`} stroke="rgba(255,255,255,0.2)" strokeWidth="1">
              <line x1="155" y1={y - 3} x2="155" y2={y + 3} />
              <line x1="245" y1={y - 3} x2="245" y2={y + 3} />
            </g>
          );
        })}
        {/* Soft vignette into black above */}
        <rect x="0" y="0" width="400" height="70" fill="url(#quizFieldFade)" />
      </svg>
    </div>
  );
}
