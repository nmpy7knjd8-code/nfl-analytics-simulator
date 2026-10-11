# UI Component Rules — NFL Analytics Simulator

Companion to [`UI_DESIGN_SYSTEM.md`](./UI_DESIGN_SYSTEM.md). Rules for composition and control choice—not a component library API.

---

## 1. Cards

**Default: no cards.**

Use a bordered/background container only when it groups an **interaction** (form submit unit, selectable option, expandable simulator step). If removing border, fill, shadow, or radius does not hurt understanding, remove them.

Never use cards in the Home hero. Never wrap a static KPI in a card grid—use typographic hierarchy and section spacing instead.

---

## 2. Tables vs charts

| Prefer a **table** when… | Prefer a **chart** when… |
|--------------------------|---------------------------|
| Users compare exact values, sort, or scan many rows | Shape, trend, or distribution matters more than exact cells |
| Mixed units / heterogeneous columns | One metric over drive, clock, or season |
| Play-by-play, evaluation rows, model versions | EPA by down, calibration curve, win-prob path |
| Counts are small and labels are long | Density would make a table unreadable |

**Defaults by screen**

| Screen | Primary | Secondary |
|--------|---------|-----------|
| Home / Live Center | Sparse typographic summary + truth chips | Small spark only if it answers one question |
| Game Explorer | Play/drive **table** | Optional drive EPA chart |
| Situation Lab | Form + result metrics | Probability bars for outcome set |
| Game Simulator | Step log **table** + score/state line | Trajectory chart optional after run |
| Strategy Lab | Comparison **table** of policies | Distribution chart for simulated outcomes |
| Team / Player Analytics | Rank/filter **table** | Trend chart per selected entity |
| Model Evaluation | Metrics **table** + calibration | Reliability diagram, residual plot |
| Data / Settings | Forms and status tables | None |

**Chart rules of thumb**

- One chart answers one question; put a second chart in the next section.
- If a legend needs more than four series, split or use a table.
- Always label truth status on the chart region.
- Provide a “View as table” affordance for evaluation and recommendation comparisons.

---

## 3. Button hierarchy

At most **one** primary button per section.

| Level | Style | Use |
|-------|-------|-----|
| **Primary** | Fill `--color-accent`, text inverse, `--radius-md` | The commit action: Run simulation, Apply situation, Save config |
| **Secondary** | 1px border `--color-border-strong`, ink text, transparent fill | Alternate path: Reset, Export, View as table |
| **Tertiary / quiet** | Text-only, ink-secondary, underline on hover | Inline navigation, “Learn about EPA”, dismiss |
| **Danger** | `--color-danger` outline or soft fill | Destructive reset of a long-running lab session—confirm first |

**Do not**

- Use multiple filled accent buttons side by side.
- Use rounded-full pills for button shape.
- Label a button “Win” / “Best play” as if the model were certain—see §6.

**Sizing:** default height 40px; compact table actions 32px with caption text. Icon+label for primary; icon-only only in dense tables with `aria-label`.

---

## 4. Forms — Situation Lab

Situation Lab is a **single-job form**: define a pre-play state, then request prediction or simulation.

**Layout**

1. Overline + truth intent toggle: **Predict** vs **Simulate** (mutually exclusive; changes submit label and result styling).
2. One supporting sentence: what will be held fixed vs drawn.
3. Field groups in reading order (not card stacks):
   - **Possession & score** — offense, defense, score differential
   - **Down & distance** — down, yards to go
   - **Field & clock** — yard line convention per shared schema, quarter, clock, timeouts
   - **Rules / context** — season/ruleset if exposed; kickoff vs scrimmage only when needed
4. Primary submit sticky on mobile; inline at end of form on desktop.
5. Results region **below** the form (not a modal): truth chip, key probabilities or EPA, assumptions line, link to Model Evaluation for limits.

**Field rules**

- Labels above fields; helper text under for conventions (e.g. yard-line origin).
- Use selects for bounded enums; numeric steppers for down (1–4) and timeouts.
- Validate with schema-backed messages—“Distance must be ≥ 1”—no silent clamping without notice.
- Disable submit while required fields invalid; show summary error band on submit attempt.
- Preserve form values when results return so users can tweak one lever.

**Do not** put recommendations inside the form fields. Recommendations appear only in the results region after a successful response.

---

## 5. Navigation & shell

- Primary nav: text links in Source Sans 3, current route with accent underline (2px) or ink weight change—not a filled pill.
- Skip links for main content.
- Breadcrumbs only when hierarchy is ≥ 3 levels (e.g. Game → Drive → Play).
- Data/Settings freshness and model version live in the shell as quiet caption text, not badges.

---

## 6. Recommendations (without overclaiming)

Recommendations are **decision aids**, not prescriptions.

**Presentation pattern**

```
[Truth chip: Predicted | Simulated]
Suggested consideration
{action or ranking}

Based on {model name / version}, given {state summary}.
Not a guarantee of outcome. See assumptions.
```

**Rules**

1. Prefer language: “Higher estimated EPA,” “More often succeeds in simulation (N runs),” “Ranks above alternatives under this model”—never “You should” or “Guaranteed.”
2. Show **top alternatives** (at least 2) with the same metric columns so the lead option is comparative.
3. Surface **uncertainty**: intervals if provided; otherwise sample size / run count for simulations; calibration caveat for predictions.
4. Link to model card / Model Evaluation for training window and known limitations.
5. If the API returns unsupported state, show unsupported notice—do **not** invent a recommendation client-side.
6. Visual weight: recommendation block uses accent-soft background only for Predicted, simulated hatch/soft for Simulated; never trophy icons or green “WIN” stamps.
7. Separate **policy comparison** (Strategy Lab) from **single-situation suggestion** (Situation Lab)—do not conflate causal claims with associations.

---

## 7. Filters & toolbars

- Filters sit above tables as a horizontal group with clear “Clear all.”
- Active filters are removable text chips (`--radius-sm`), not rounded-full tags.
- Avoid sticky filter bars that cover > 20% of the viewport on mobile.

---

## 8. Modals & drawers

- Prefer inline expansion and route changes over modals.
- Use a modal only for destructive confirmations or short disclaimer gates.
- Drawers OK for play detail from a table row; include truth chip and provenance timestamps.

---

## 9. Loading, empty, error, stale (component level)

| State | Component behavior |
|-------|-------------------|
| Loading | Replace primary content region with skeletons; keep page title + chips |
| Empty | Inline empty copy in the content region; secondary CTA |
| Error | Soft danger band above the region; preserve prior good data if still on screen and mark it stale/unavailable |
| Stale | Warning band; do not auto-toast spam |

Full visual tokens: design system §11.

---

## 10. Screen-specific notes

### Home / Live Center

One composition: brand-forward if marketing; otherwise quiet “continue work” entry (recent game, open Situation Lab). No ticker, no stat strip, no card bento.

### Game Explorer

Table-first. Drive chart is optional secondary. Historical chip dominant.

### Game Simulator

Emphasize reproducibility: show seed and config summary near results (mono). Simulated chip required on all generated paths.

### Strategy Lab

Comparison table of policies; chart for outcome distributions only after runs complete. Language stays comparative under stated assumptions.

### Team / Player Analytics

Filter → table → optional trend. No fantasy-style player cards.

### Model Evaluation

Honesty over polish: metrics table, calibration chart, training/validation/test period text from API—never hard-coded fake scores.

### Data / Settings

Plain forms; provenance and version strings in mono. No gamified setup wizard.

---

## 11. Handoff to screen-spec agent

When specifying screens, cite:

- Tokens from `UI_DESIGN_SYSTEM.md` (color, type, space, truth chips, states).
- Control choices from this document (table vs chart, button level, form order, recommendation copy limits).

Do not invent API fields here. Wire labels to contracts owned by the lead architect.
