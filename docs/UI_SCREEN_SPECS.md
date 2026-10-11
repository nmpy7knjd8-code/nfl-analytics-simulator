# UI Screen Specs — NFL Analytics Simulator

**Status:** Final — aligned to [`UI_DESIGN_SYSTEM.md`](./UI_DESIGN_SYSTEM.md) and [`UI_COMPONENT_RULES.md`](./UI_COMPONENT_RULES.md).  
**Tone:** Calm, confident, editorial-sports. Simulation and evidence first — not a scores ticker.  
**Scope:** NFL only. No betting/odds UI. No full app implementation.  
**Product name:** **NFL Analytics Simulator** (Syne display). Do not use short brand “Field Model” in MVP chrome.  
**Mood reference (optional):** [`media/ui-moodboard.html`](../media/ui-moodboard.html) — hero atmosphere, truth chips, turf accent; screens must match tokens, not invent new chrome from the board.

Cross-cuts apply to every screen. Each screen section covers purpose, composition, interactions, truth separation, clutter to refuse, states, and a11y. Cite tokens/components by name; do not invent API fields.

---

## Cross-cutting rules

### Shell & atmosphere

- **Canvas:** cool gradient per design system §3.2 (`--color-bg-atmosphere-top` → `--color-bg-atmosphere-bottom` → `--color-bg`); optional noise ≤ 0.04. Light theme only.
- **Top bar** (`--nav-height`): Syne product mark + Source Sans 3 text nav (eight destinations). Current route: 2px `--color-accent` underline or ink weight — not a filled pill ([component rules §5](./UI_COMPONENT_RULES.md)).
- **Freshness / model version:** quiet caption in shell (`--text-caption`, `--color-ink-muted`, mono for ids) — not badges.
- **Content width:** `--page-max` (most screens) or `--page-max-wide` (Game Explorer, Model Evaluation).
- **Section pattern:** overline/truth context → headline (Syne) → one supporting sentence → primary content.
- **Cards:** default none. Bordered surface only for interactive groups ([component rules §1](./UI_COMPONENT_RULES.md)).
- **Motion (global 2–3):** page enter (`--duration-slow` / `--ease-emphasized`); truth crossfade (`--duration-base`); primary CTA `:active` (`--duration-fast`). Honor `prefers-reduced-motion`.

### Truth chips (required)

Use `.truth-chip` variants from design system §8 — text label always; never color-alone; never green/red for epistemic status.

| Class | Chip | Chart series |
| --- | --- | --- |
| **Historical** | `.truth-chip--historical` | Solid `--chart-historical` 2px |
| **Predicted** | `.truth-chip--predicted` (2px left bar) | Solid `--chart-predicted` 2px; band `--chart-band` |
| **Simulated** | `.truth-chip--simulated` (dashed border) | Dashed `--chart-simulated`; band `--chart-band-sim`; optional hatch |

Chips at **section/panel** level. Mixed statuses in one chart need a legend using the same chip language. Prefer separate views over mixed tables.

### Numbers & tooltips

Per design system §9: probs as `%` with 0–1 justified decimal; EPA/rates 2–3 sig figs; clocks/ids/seeds in **IBM Plex Mono** + tabular nums. Tooltips = plain definition + “what it is not.” No invented intervals — show “interval unavailable” if API omits them.

### Buttons

At most one **Primary** (accent fill) per section. Secondary = border strong; tertiary = quiet text. No rounded-full pills. Height ≥ 40px primary ([component rules §3](./UI_COMPONENT_RULES.md)).

### Shared states

| State | Treatment (design system §11 + component rules §9) |
| --- | --- |
| **Loading** | Skeleton matching final layout (`--color-bg-sunken`); keep title + truth chips; label region (“Loading play-by-play…”). No fake live pulse. |
| **Empty** | One sentence + one next action in content region; secondary CTA. No mascot illustrations. |
| **Error** | `--color-danger-soft` band + danger ink; state what failed / preserved; retry if safe. Never demo numbers. |
| **Stale** | `--color-warning-soft` band: “Showing data as of {timestamp}. Refresh to update.” Stale ≠ Simulated. |
| **Unsupported** | Muted notice; disable actions that would fabricate results. |

### Shared a11y

- Focus: `--shadow-focus`. Skip link to main.
- Truth status: text + (for Simulated) dashed/hatch — not color-only.
- WCAG AA on atmospheric backgrounds; prefer AAA for body on `--color-bg-elevated`.
- Charts: “View as table” for evaluation/recommendation comparisons; data-table alternative for critical reads.
- Hit targets ≥ 40px on primary controls.

---

## Information architecture (nav)

```
Home / Live Center
Game Explorer
Situation Lab
Game Simulator
Strategy Lab
Team / Player Analytics
Model Evaluation
Data / Settings
```

MVP: “Live Center” = **session hub + data freshness**, not a live scoreboard. No fake LIVE chrome.

---

## 1. Home / Live Center

### Purpose (one job)

Orient the analyst and route into work — without becoming a dashboard.

### Primary viewport composition

**In (hero — branded surface)**

- Product name **NFL Analytics Simulator** at `--text-display` / Syne 700–800 (hero-level, not nav-only).
- One headline (Syne `--text-h1` or slightly below display).
- One supporting sentence (Source Sans 3): reconstruct → predict → simulate.
- CTA group: **Primary** “Open Game Explorer”; **Secondary** “Situation Lab” (or continue last session if present).
- Full-bleed atmospheric visual (field/stadium light / turf) — edge-to-edge, not inset card. No overlays/badges on hero media.

**Out of first viewport**

- Stat strips, schedules, leaderboards, “this week” callouts, KPI card bento, fake live scores.

**Below fold (optional, one job)**

- “Continue” as a sparse typographic list (≤ 3 rows): last game / last sim seed / last eval — each row may carry a truth chip. Not a widget grid. Per component rules: sparse summary + chips; spark only if it answers one question.

### Key interactions

- Primary → Game Explorer (or last game).
- Continue row → deep-link with provenance.
- Shell caption: seasons available / data version → Data/Settings.

### Historical vs predicted vs simulated

No mixed charts on Home. Continue rows: `.truth-chip--historical` for games, `.truth-chip--simulated` for sim runs, etc.

### Clutter to refuse

Tickers, pill clusters, glowing LIVE, multi-card KPIs, emoji, sportsbook chrome, Inter/system fonts.

### Empty / loading / error / stale

- **Empty:** No seasons → Secondary/Primary CTA to Data/Settings; no placeholder games.
- **Loading:** Brand + skeleton continue rows only.
- **Error:** Danger band for ingest/API; no invented coverage.
- **Stale:** Warning band once; static text (no pulse).

### Accessibility

Real buttons/links (not nested card hit areas). One clear `h1` (product name on this surface). Page-enter motion only if motion allowed.

---

## 2. Game Explorer

### Purpose (one job)

Reconstruct and walk a real historical game play-by-play.

### Primary viewport composition

**In**

- Quiet shell + page title (Syne). Overline: `.truth-chip--historical` + game identity (away @ home, season/week) + historical score.
- Optional sticky **context rail** (lg+): game summary + truth chips — text/metrics only, not a card stack.
- **Primary:** play/drive **table** (`--page-max-wide`) — down, distance, yard line, description; mono for clock/yardage.
- **Secondary (optional, next section):** drive EPA chart — one question; solid `--chart-historical`. Play detail via **drawer** from row (truth chip + provenance timestamps) — prefer drawer over modal ([component rules §8](./UI_COMPONENT_RULES.md)).

**Out**

WP sparkline farms, headshot walls, betting lines, broadcast lower-thirds, nested cards per play.

### Key interactions

- Progressive pickers: season → week → game.
- Keyboard: ↑/↓ in table; Enter opens drawer.
- Filters above table: horizontal group + “Clear all”; active filters as `--radius-sm` removable text chips (not rounded-full).
- Tertiary: “Open in Situation Lab” (prefill pre-play); “Simulate from here” → Game Simulator.
- Optional toggle: “Show model EP/WP at snap” → Predicted columns appear beside historical; truth crossfade; never replace observed play text.

### Historical vs predicted vs simulated

Default panel Historical. Predicted overlay uses `.truth-chip--predicted` + `--chart-predicted`. Simulated futures never paint into this list — route to Game Simulator.

### Clutter to refuse

Multi-stat header chip swarms (EPA+/CPOE/…), fake live chrome, card-per-play.

### Empty / loading / error / stale

- **Empty:** Choose season/week/game.
- **Loading:** Skeleton table rows; keep Historical chip + game title if known; do not show “0–0” as live start.
- **Error:** Missing PBP → unsupported/missing notice; no fabricated plays.
- **Stale:** Warning band + snapshot/version in mono.

### Accessibility

Table keyboard navigation; drawer focus trap; `aria-live` polite on selection. Down-and-distance as visible text. Focus rings `--shadow-focus`.

---

## 3. Situation Lab

### Purpose (one job)

Define one pre-play state; request prediction or a bounded simulation sample — not a full game.

### Primary viewport composition

**In — single-job form** ([component rules §4](./UI_COMPONENT_RULES.md))

1. Overline + **Predict vs Simulate** intent toggle (mutually exclusive; changes submit label and result chip).
2. One supporting sentence: what is held fixed vs drawn.
3. Field groups in reading order (not card stacks): Possession & score → Down & distance → Field & clock → Rules/context when needed.
4. **Primary** submit at form end (sticky on mobile): “Apply situation” / predict label, or simulate label.
5. **Results below form** (not modal): truth chip, key probs or EPA (mono), assumptions line (model name/version/training window), tertiary link to Model Evaluation. Probability **bars** for outcome set as secondary visual; table of outcomes as a11y fallback.

**Out**

Full drive charts, roster deep-dives, strategy trees, recommendation copy inside form fields.

### Key interactions

- Schema-backed validation; disable submit when invalid; error band on submit attempt.
- Preserve fields when results return.
- Secondary: “Open in Game Simulator”; tertiary metric glosses.
- Optional Historical league-frequency series: separate legend entry with Historical chip — not mixed into Predicted headline.
- Recommendations only in results, using component rules §6 language (“Higher estimated EPA…” — never “You should” / “Guaranteed”). Accent-soft block for Predicted; simulated soft/hatch for Simulated.

### Historical vs predicted vs simulated

Intent toggle selects result epistemic class. Monte Carlo sample paths stay in a secondary results block with Simulated chip — not in the distribution headline if the headline is Predicted.

### Clutter to refuse

Radar “team DNA,” gauge clusters, confidence theater without calibration, trophy WIN stamps.

### Empty / loading / error / stale

- **Empty:** Model missing → CTA toward Model Evaluation / Data.
- **Loading:** Skeleton results; dim prior results; do not interpolate fake probs.
- **Error / unsupported:** Danger or muted unsupported band; disable fabricate path.
- **Stale:** Show model artifact time vs data snapshot if mismatched.

### Accessibility

Labels above fields; steppers for down/timeouts; results chart has outcome table. “Most likely” not color-only. Primary button busy state announced.

---

## 4. Game Simulator

### Purpose (one job)

Roll forward from a defined state with reproducible randomness; inspect simulated sequences.

### Primary viewport composition

**In**

- Title + `.truth-chip--simulated` on all generated paths.
- Context: initial state (or “from historical play X”) + **seed** + model/config ids in mono near results.
- **Primary:** step log **table** + score/state line.
- Controls: run N plays / end of drive / end of half — one Primary “Run simulation”; Secondary Reset/Export; reseed as needed.
- **Secondary (after run):** optional trajectory chart (dashed `--chart-simulated`).
- Optional split: Historical continuation | Simulated — two columns, two chips; truth crossfade on toggle.

**Out**

Live scoreboard theatrics, moneylines, autoplay broadcast UI, particle TD celebrations.

### Key interactions

- Set/inherit state → Run; scrub table; pin play → Situation Lab.
- Secondary “Export reproduction bundle” (seed, config, versions).
- Predicted annotations (choice probs) may sit under realized Simulated outcomes with Predicted chip on that annotation row only.

### Historical vs predicted vs simulated

Primary stream Simulated (dashed chip + hatch-friendly charts). Historical comparison never overwrites sim column. Predicted = model probs only, clearly nested.

### Clutter to refuse

Crowd meters, lobby chrome, multiple primary buttons, card stacks for static state.

### Empty / loading / error / stale

- **Empty:** Prompt to set situation or pick historical snap.
- **Loading:** Progress with seed visible; results empty until complete; announce busy on Run.
- **Error:** Unsupported rules branch → stop + report.
- **Stale:** Finished run is immutable (“this run”); new run is explicit — not a stale-feed pattern.

### Accessibility

Same table keyboard pattern as Explorer. Seed copyable and announced. Confirm destructive Reset of long session (Danger button + modal OK per §8).

---

## 5. Strategy Lab

### Purpose (one job)

Compare a small set of decision alternatives in a fixed situation — decision aid, not playbook CMS.

### Primary viewport composition

**In**

- Read-only situation summary (context rail or overline) + truth intent for the comparison.
- Interactive selection of 2–4 alternatives (interactive surfaces OK; not a static card bento).
- **Primary:** comparison **table** of policies (same metric columns for all options).
- Objective control: EP vs WP (one control).
- Recommendation block per §6: comparative language, uncertainty/sample size, link to Model Evaluation. No trophies.
- **Secondary after runs:** distribution chart for simulated outcomes only if Simulate path used; else Predicted metrics only.

**Out**

Season-wide optimizer dashboards, formation encyclopedias, coach cards, 12-option matrices.

### Key interactions

- Compute via API; Secondary “View as table” if chart shown.
- Open alternative in Situation Lab or Game Simulator.
- Assumptions + non-causal disclaimer once near results.

### Historical vs predicted vs simulated

Results default Predicted (or Simulated if comparison is Monte Carlo). Optional Historical frequency row separated with Historical chip. Full counterfactual games → Game Simulator.

### Clutter to refuse

Heatmap wallpaper, “optimal” medals, green WIN stamps, conflating causal claims with associations.

### Empty / loading / error / stale

- **Empty:** Need situation + ≥ 2 alternatives.
- **Loading:** Prior comparison preserved/grayed; no animated winner.
- **Error:** Incomplete outputs → refuse ranking.
- **Stale:** Model/data version caption under results.

### Accessibility

Table-first; chart enhancement only. Suggested consideration stated in text. Focusable alternative selection.

---

## 6. Team / Player Analytics

### Purpose (one job)

Explore one team or player over a chosen window — filter → table → optional trend.

### Primary viewport composition

**In**

- Entity header (name, team/position, season scope) + `.truth-chip--historical` default.
- Filters → **rank/filter table** as primary ([component rules §2](./UI_COMPONENT_RULES.md)).
- **Secondary section:** one trend chart for selected entity/metric (`--chart-historical`; optional Predicted residual series with Predicted chip).
- Season range default within experiment window 2019–2023.

**Out**

Fantasy points, betting props, 32-team heatmap on first load, news feeds, fantasy-style player cards, radar spiders by default.

### Key interactions

- Search combobox → load entity.
- One primary metric family on first paint.
- Drill to Game Explorer for team games / player involvement.
- Tooltips + sample size beside rates; team colors only as tiny accents (design system §3.3).

### Historical vs predicted vs simulated

Default Historical aggregates. Optional Predicted expected/residual series. No simulated player seasons in MVP.

### Clutter to refuse

Pill clusters of 8 rates, hex “athlete brand” maps, card grids of static KPIs.

### Empty / loading / error / stale

- **Empty:** No entity selected.
- **Loading:** Skeleton for table/chart region; keep title.
- **Error:** Missing mapping — say what’s missing.
- **Stale:** PBP snapshot version in mono.

### Accessibility

Combobox + listbox; chart “View as table”; expand abbreviations in `aria-label`.

---

## 7. Model Evaluation

### Purpose (one job)

Show honest holdout performance and calibration — never vanity accuracy alone.

### Primary viewport composition

**In** (`--page-max-wide`)

- Model selector: family, version, train/val/test (2019–2021 / 2022 / 2023) as caption text from API.
- **Primary:** metrics **table** (Brier, log loss, agreed metrics vs baselines) + implementation status as plain text (reproduced / approximated / reference-only — not gamified badges).
- **Secondary:** reliability/calibration diagram (`--chart-predicted` vs historical outcomes); residual plot only if it answers a second question in its own section.
- Always “View as table” for calibration comparisons.

**Out**

Marketing leaderboards, “99% accurate” banners, medal icons, neon AUC gauges, hard-coded fake scores.

### Key interactions

- Switch model/split; expand metric definitions (tooltips §9).
- Tertiary link to training config / data version (read-only, mono ids).
- Empty if no eval artifact — do not fabricate (AGENTS.md).

### Historical vs predicted vs simulated

Compares Predicted vs Historical on holdout. Omit simulation metrics unless a sim-eval harness exists later.

### Clutter to refuse

Multi-model spaghetti without baseline; confusion-matrix wallpaper as decoration.

### Empty / loading / error / stale

- **Empty:** “No evaluation artifact…” + which phase produces it.
- **Loading:** Skeleton table + chart frame.
- **Error:** Failed job id/log if available.
- **Stale:** Warn if metrics predate current data snapshot.

### Accessibility

Metrics table is the source of truth; plot supplementary. Status words not color-only.

---

## 8. Data / Settings

### Purpose (one job)

Manage local snapshots, versions, and reproducibility — the trust panel.

### Primary viewport composition

**In**

- Plain **forms** + **status tables** (no charts). Provenance/version strings in IBM Plex Mono.
- Data status: seasons, row counts if known, source (e.g. nflverse client), license reminder (CC BY 4.0).
- Actions: ingest/refresh experiment window — one Primary per section (“Ingest seasons”).
- Settings: default seed policy, display/decimal prefs, reduced motion toggle.
- No gamified setup wizard ([component rules §10](./UI_COMPONENT_RULES.md)).

**Out**

Cloud billing, paid API key walls, non-NFL league switcher, odds providers, theme rainbow pickers, fake “syncing with NFL” live spinners.

### Key interactions

- Per-season progress text + last success/failure.
- Copy data version id.
- Danger + confirm modal for wipe local data.
- Link to licensing doc when present.

### Historical vs predicted vs simulated

Meta screen: tag listed artifacts as data vs model vs sim-run (chips or caption), not play charts.

### Clutter to refuse

Marketplace tiles, continuous pulse “live sync,” card bento for static status.

### Empty / loading / error / stale

- **Empty:** No local store → Primary ingest 2019–2023.
- **Loading:** Per-season progress with `aria-live`; not a silent forever bar.
- **Error:** Name partial season failures.
- **Stale:** Warning band with local “as of”; Refresh when endpoint exists.

### Accessibility

Labeled switches; confirm destructive actions; progress announced; focus visible.

---

## Table vs chart defaults (locked)

| Screen | Primary | Secondary |
| --- | --- | --- |
| Home / Live Center | Sparse typographic summary + truth chips | Spark only if one question |
| Game Explorer | Play/drive table | Optional drive EPA chart |
| Situation Lab | Form + result metrics | Probability bars |
| Game Simulator | Step log table + state line | Trajectory after run |
| Strategy Lab | Policy comparison table | Distribution after sim runs |
| Team / Player Analytics | Rank/filter table | Trend per entity |
| Model Evaluation | Metrics table + calibration | Reliability / residual |
| Data / Settings | Forms + status tables | None |

---

## Screen → API handoff

| Screen | Primary API concern (lead-owned contracts) |
| --- | --- |
| Home | Session + data freshness summary |
| Game Explorer | Game list, PBP, play detail |
| Situation Lab | Situation → predict / bounded simulate |
| Game Simulator | State + seed → sim steps |
| Strategy Lab | Situation + actions → comparison |
| Team/Player | Entity aggregates |
| Model Evaluation | Metrics artifacts |
| Data/Settings | Ingest jobs, versions, prefs |

Frontend must not reimplement EP/WP/EPA math; call documented APIs. Wire labels to lead architect contracts only.

---

## Implementer checklist

- [ ] Tokens from `UI_DESIGN_SYSTEM.md` in `tokens.css` / layout fonts (Syne, Source Sans 3, IBM Plex Mono)
- [ ] Truth chips on every numeric panel
- [ ] Button hierarchy + no card default
- [ ] States: loading / empty / error / stale / unsupported designed per screen
- [ ] Motion limited to the three global motions; reduced-motion path
- [ ] No betting UI; NFL only

---

## Revision log

| Date | Change |
| --- | --- |
| 2026-10-11 | Initial screen IA draft (pre–design system) |
| 2026-10-11 | **Final:** aligned to `UI_DESIGN_SYSTEM.md` + `UI_COMPONENT_RULES.md` (tokens, chips, shell, table/chart, forms, recommendations, states, motion, precision); moodboard cited |
