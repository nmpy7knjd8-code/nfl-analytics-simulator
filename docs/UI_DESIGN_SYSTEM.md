# UI Design System — NFL Analytics Simulator

**Status:** Design tokens and visual direction for Phase frontend work. Not an implementation.  
**Consumers:** Screen-spec agent, Next.js implementers.  
**Stack assumption:** Next.js + TypeScript; fonts via `next/font/google` or self-host.

---

## 1. Visual direction

**Positioning:** Calm, confident, editorial-sports. A simulation and evidence tool—not a scores ticker, SaaS metrics dashboard, or neon sportsbook.

**Principles**

1. **One job per section.** One headline, one supporting line, one primary action or reading path.
2. **Ruthless hierarchy.** Brand and primary question outrank numbers; numbers outrank chrome.
3. **Evidence first.** Historical, predicted, and simulated never look interchangeable.
4. **Dense when needed, never cluttered.** Density lives in tables and charts; surrounding chrome stays quiet.
5. **Atmosphere without noise.** Soft cool gradients and light grain—not flat fills, not glow, not purple mist.

**Anti-patterns (do not ship)**

- Purple-on-white or purple→indigo gradients  
- Warm cream paper + terracotta + display serif cliché  
- Broadsheet hairline grids / dense newspaper columns  
- Neon green/magenta “odds board” accents  
- Multi-layer drop shadows, glassmorphism, glow  
- Rounded-full pill clusters, emoji decoration  
- Cards wrapping static content that does not need a container  
- Floating badges/overlays on hero media  
- Inter, Roboto, Arial, or system UI stacks as brand/body fonts  

**Mood reference:** Quiet sideline light, chalk and turf depth, magazine clarity—not broadcast lower-thirds.

Optional static mood board: [`media/ui-moodboard.html`](../media/ui-moodboard.html).

---

## 2. Brand & first viewport

Product name: **NFL Analytics Simulator** (short: **Field Model** only if marketing later chooses a brand; until then use the full product name).

On branded surfaces (Home):

- Product name is a **hero-level** type signal, not nav-only text.
- First viewport composition: brand + one headline + one short sentence + one CTA group + one full-bleed atmospheric visual. Nothing else (no stats strips, schedules, or promo chips).
- Hero visual is edge-to-edge (field texture, abstract stadium light, or calm aerial turf)—not an inset card image.

Interior app screens skip the marketing hero; they open with a quiet top bar, page title, and truth-context for the data on screen.

---

## 3. Color

Light theme is default. A future dark theme is out of MVP scope; do not design dark-first.

### 3.1 CSS variables

```css
:root {
  /* Atmosphere */
  --color-bg: #eef1f4;
  --color-bg-elevated: #f7f8fa;
  --color-bg-sunken: #e4e8ed;
  --color-bg-atmosphere-top: #dce4ec;
  --color-bg-atmosphere-bottom: #f4f6f8;
  --color-bg-noise: rgba(15, 20, 24, 0.03);

  /* Ink */
  --color-ink: #0e1218;
  --color-ink-secondary: #3d4550;
  --color-ink-muted: #6a7380;
  --color-ink-inverse: #f7f8fa;

  /* Borders & lines */
  --color-border: #c9d0d8;
  --color-border-strong: #9aa3ae;
  --color-divider: #dce1e7;
  --color-focus-ring: #1a5f4a;

  /* Brand accent — deep turf, not neon */
  --color-accent: #1a5f4a;
  --color-accent-hover: #144c3b;
  --color-accent-soft: #e3efe9;
  --color-accent-ink: #0f3d30;

  /* Semantic (restrained) */
  --color-info: #2a4f6e;
  --color-info-soft: #e4ebf2;
  --color-success: #1a5f4a;
  --color-success-soft: #e3efe9;
  --color-warning: #9a6700;
  --color-warning-soft: #f5edd8;
  --color-danger: #9b3a2f;
  --color-danger-soft: #f3e4e1;

  /* Truth labels */
  --color-truth-historical: #2c333c;
  --color-truth-historical-soft: #e8eaed;
  --color-truth-predicted: #1a5f4a;
  --color-truth-predicted-soft: #e3efe9;
  --color-truth-simulated: #5b4a2e;
  --color-truth-simulated-soft: #efe8dc;
  --color-truth-simulated-pattern: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 2px,
    rgba(91, 74, 46, 0.12) 2px,
    rgba(91, 74, 46, 0.12) 4px
  );

  /* Charts */
  --chart-axis: #6a7380;
  --chart-grid: #dce1e7;
  --chart-series-1: #1a5f4a;
  --chart-series-2: #2a4f6e;
  --chart-series-3: #8a5a2b;
  --chart-series-4: #4a5560;
  --chart-historical: #2c333c;
  --chart-predicted: #1a5f4a;
  --chart-simulated: #8a6a3d;
  --chart-band: rgba(26, 95, 74, 0.14);
  --chart-band-sim: rgba(138, 106, 61, 0.16);

  /* Surfaces for interactive containers only */
  --color-interactive-surface: #f7f8fa;
  --color-interactive-hover: #eef2f5;
  --color-disabled: #a8b0ba;
  --color-disabled-surface: #e8eaed;
}
```

### 3.2 Page atmosphere

Do not leave the canvas as a single flat `#fff`. Prefer:

```css
body {
  color: var(--color-ink);
  background:
    linear-gradient(
      180deg,
      var(--color-bg-atmosphere-top) 0%,
      var(--color-bg-atmosphere-bottom) 42%,
      var(--color-bg) 100%
    );
}
```

Optional: a very light noise overlay (`opacity` ≤ 0.04) on a fixed pseudo-element. No vignette glow.

### 3.3 Team colors

Use official team colors only as **small accents** (logos, matchup marks, tiny series keys)—never as page chrome or full chart palettes. Always meet WCAG AA for text on its background. Prefer ink + turf accent for UI chrome regardless of team.

---

## 4. Typography

Load via `next/font/google` (or self-host the same files).

| Role | Family | Weights | Notes |
|------|--------|---------|--------|
| Brand / display | **Syne** | 600, 700, 800 | Geometric, confident; product name and page display titles |
| UI / body | **Source Sans 3** | 400, 500, 600, 700 | Long reading, forms, labels; excellent metrics |
| Data / mono | **IBM Plex Mono** | 400, 500, 600 | Tabular figures for clocks, rates, probabilities |

```css
:root {
  --font-display: "Syne", sans-serif;
  --font-body: "Source Sans 3", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;

  --text-display: clamp(2.5rem, 4vw + 1rem, 3.75rem);
  --text-h1: 2rem;        /* 32 */
  --text-h2: 1.5rem;      /* 24 */
  --text-h3: 1.25rem;     /* 20 */
  --text-body: 1rem;      /* 16 */
  --text-body-sm: 0.875rem; /* 14 */
  --text-caption: 0.75rem;  /* 12 */
  --text-overline: 0.6875rem; /* 11, uppercase tracking */

  --leading-display: 1.1;
  --leading-tight: 1.25;
  --leading-body: 1.5;
  --leading-dense: 1.35;

  --tracking-display: -0.02em;
  --tracking-overline: 0.08em;
}
```

**Usage rules**

- Product name and major screen titles → display (Syne).
- Section titles → Syne 600/700 at `--text-h2` / `--text-h3`, or Source Sans 3 600 if the page is already dense with data.
- Body and UI chrome → Source Sans 3.
- Probabilities, EPA, clocks, IDs, seeds → IBM Plex Mono with `font-variant-numeric: tabular-nums`.
- Cap line length for prose at ~65ch; data tables ignore that cap.
- Prefer plain language in tooltips and metric glosses; avoid false precision (see §9).

---

## 5. Space, radius, elevation

```css
:root {
  --space-1: 0.25rem;  /* 4 */
  --space-2: 0.5rem;   /* 8 */
  --space-3: 0.75rem;  /* 12 */
  --space-4: 1rem;     /* 16 */
  --space-5: 1.5rem;   /* 24 */
  --space-6: 2rem;     /* 32 */
  --space-7: 3rem;     /* 48 */
  --space-8: 4rem;     /* 64 */
  --space-9: 6rem;     /* 96 */

  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  /* No radius-full for UI chrome. Truth chips use radius-sm. */

  --shadow-none: none;
  --shadow-focus: 0 0 0 2px var(--color-bg-elevated), 0 0 0 4px var(--color-focus-ring);
  /* Avoid stacked decorative shadows. At most one soft separator shadow if needed: */
  --shadow-soft: 0 1px 0 rgba(14, 18, 24, 0.06);
}
```

**Spacing discipline:** Vertical rhythm in `--space-5` / `--space-6` between sections; `--space-3` / `--space-4` inside interactive groups. Do not pad empty cards to look “designed.”

---

## 6. Layout grid

```css
:root {
  --grid-columns: 12;
  --grid-gutter: var(--space-4);
  --grid-gutter-lg: var(--space-5);
  --page-max: 72rem;      /* 1152px — calm reading / most screens */
  --page-max-wide: 80rem; /* 1280px — Explorer, Evaluation tables */
  --page-margin: var(--space-4);
  --page-margin-lg: var(--space-6);
  --nav-height: 3.5rem;
}
```

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| `sm` | ≥ 640px | Two-column forms begin |
| `md` | ≥ 768px | Side nav optional collapse → rail |
| `lg` | ≥ 1024px | Primary app shell: nav + content |
| `xl` | ≥ 1280px | Wide data layouts; sticky context column OK |

**Shell**

- Top bar: product mark (Syne), primary nav links, environment/data freshness indicator.
- Content column centered within `--page-max` or `--page-max-wide`.
- Sticky **context rail** (optional, lg+): game/situation summary + truth labels—text and metrics only, not a card stack.
- Mobile: single column; sticky bottom primary action only when a lab/simulator step requires commit.

**Section pattern**

```
[Overline / truth context]
[Headline]
[One supporting sentence]
[Primary content: table | chart | form | result]
```

---

## 7. Motion

Ship **2–3 intentional motions** globally—not micro-animation everywhere.

```css
:root {
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-emphasized: cubic-bezier(0.2, 0.0, 0, 1);
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 360ms;
}
```

| Motion | Use |
|--------|-----|
| **Page enter** | Content fades/slides up slightly (`--duration-slow`, `--ease-emphasized`) once per route |
| **Truth crossfade** | When switching historical ↔ predicted ↔ simulated views, series and labels crossfade (`--duration-base`) |
| **Primary CTA press** | Background/ink shift on `:active` (`--duration-fast`) |

Respect `prefers-reduced-motion: reduce` (instant cuts, no slide). No continuous pulse on live/stale indicators—use static color + text instead.

---

## 8. Truth-label chips

Every view that shows numbers must declare epistemic status.

| Label | Meaning | Visual |
|-------|---------|--------|
| **Historical** | Observed play-by-play / derived facts from source data | Filled ink chip: `--color-truth-historical` on soft slate |
| **Predicted** | Model output for a state (no counterfactual rollouts) | Accent-soft fill + accent ink; solid left bar 2px |
| **Simulated** | Stochastic or rule-driven counterfactual outcomes | Warm soft fill + dashed border; optional hatch on chart fills |

```css
.truth-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
}

.truth-chip--historical {
  color: var(--color-truth-historical);
  background: var(--color-truth-historical-soft);
}

.truth-chip--predicted {
  color: var(--color-truth-predicted);
  background: var(--color-truth-predicted-soft);
  box-shadow: inset 2px 0 0 var(--color-truth-predicted);
}

.truth-chip--simulated {
  color: var(--color-truth-simulated);
  background: var(--color-truth-simulated-soft);
  border: 1px dashed var(--color-truth-simulated);
}
```

**Rules**

- Place chips at the **section or panel** level; repeat on a row only when a single table mixes statuses (rare—prefer separate views).
- Mixing statuses in one chart requires a legend that uses the same chip language.
- Never use green=“good” / red=“bad” to encode truth status.
- Live freshness (if later) is a separate **freshness** indicator, not a truth chip.

---

## 9. Numbers, precision, tooltips

| Kind | Display |
|------|---------|
| Probability | Percent with 0–1 decimal as justified by calibration (e.g. `23%` or `23.4%`); never 6 fake decimals |
| Rates / EPA | 2–3 significant figures appropriate to SE; show ± or interval when API provides it |
| Clock | Mono, football convention from shared schema |
| Counts | Locale grouping; mono in tables |

Tooltips: plain-language definition + “what it is not.” Example: *“EPA: expected points added versus average for this down/distance/field position. Not a win-probability substitute.”*

Do not invent confidence intervals in the UI if the API does not supply them—show “interval unavailable.”

---

## 10. Chart styling

Library-agnostic tokens (Recharts, Visx, or similar later).

**Defaults**

- Background transparent; grid lines `--chart-grid` at 1px; axes `--chart-axis` caption size.
- No 3D, no gradients on bars, no glow.
- Max **four** categorical series colors before forcing small-multiples or a table.
- Historical series: solid stroke `--chart-historical`, 2px.
- Predicted series: solid stroke `--chart-predicted`, 2px; confidence band `--chart-band`.
- Simulated series: dashed stroke `--chart-simulated` (4–3 dash), band `--chart-band-sim`; fill may use hatch token.
- Zero / critical reference lines: `--color-border-strong`, 1px.
- Tooltip panel: `--color-bg-elevated`, 1px `--color-border`, `--radius-md`, no heavy shadow.

**When not to chart:** see `UI_COMPONENT_RULES.md`.

---

## 11. State patterns

Design these as first-class layouts, not toasts-only afterthoughts.

### Loading

- Prefer **skeleton blocks** that match final layout (title line, chip row, table rows or chart frame).
- Skeleton color: `--color-bg-sunken` pulsing at low contrast only if motion allowed; otherwise static.
- Label the region: “Loading play-by-play…” with truth context still visible if already known (e.g. game selected).

### Empty

- One sentence why empty + one next action.
- Example: “No plays match this filter. Clear filters or choose another drive.”
- No illustration mascots; optional quiet field-line motif at low opacity.

### Error

- Use `--color-danger-soft` background band + danger ink text.
- State what failed, what was preserved, and a retry if safe.
- Never replace historical data with placeholder “demo” numbers.

### Stale

- Amber soft band: “Showing data as of {timestamp}. Refresh to update.”
- Content remains readable; primary button “Refresh” when endpoint exists.
- Stale ≠ Simulated. Stale is freshness of a feed/cache; Simulated is epistemic.

### Unsupported / missing

- Per AGENTS.md: report unsupported states rather than silent fill-ins.
- Pattern: muted inline notice—“Field goal ruleset for this season not modeled”—and disable the action that would fabricate a result.

---

## 12. Iconography & imagery

- Icons: simple 1.5px stroke, 20/24px, ink-secondary. No filled neon glyphs.
- Prefer text labels beside icons for primary actions.
- Photography/texture: real field, stadium atmosphere, chalk—desaturated slightly to sit under type. Full-bleed on marketing hero only.

---

## 13. Accessibility

- Text/background ≥ WCAG AA (prefer AAA for body on elevated surfaces).
- Focus visible via `--shadow-focus`; never remove focus outlines without replacement.
- Truth status not color-only: text label required; simulated also has dashed treatment.
- Hit targets ≥ 40px height on primary controls.
- Charts need a data-table alternative or downloadable rows for critical comparisons.

---

## 14. Token handoff checklist

Implementers should expose the CSS variables above in a single `tokens.css` (or CSS module) and map fonts in `app/layout.tsx` via `next/font/google`:

- `Syne` → `--font-display`
- `Source_Sans_3` → `--font-body`
- `IBM_Plex_Mono` → `--font-mono`

Component usage rules: [`UI_COMPONENT_RULES.md`](./UI_COMPONENT_RULES.md).
