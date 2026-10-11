# Agent / workstream ownership

| Workstream | Owns | Must not edit casually |
| --- | --- | --- |
| Architecture (Agent 0) | `docs/ARCHITECTURE.md`, `DECISIONS.md`, `DATA_DICTIONARY.md`, `ROADMAP.md`, `REPO_AUDIT.md`, contracts, `AGENTS.md` sync | Research narrative without reconciliation |
| Research (Agent 1) | `RESEARCH_REGISTER.md`, `MODEL_CATALOG.md`, `LICENSING_AND_DATA_SOURCES.md`, `MODEL_VALIDATION.md` | Final canonical field names (architect) |
| Data (Agent 2) | `DATA_EXPERIMENT.md`, ingest design notes | Contract Python/TS without architect PR |
| Models | `backend/src/nfl_sim/models` (Phase 3+) | Canonical schemas |
| Frontend | `frontend/` Next.js (Phase 2+) | Backend contracts without sync |
| Live | `providers/` | Historical ingest path |

Phase 1 max three workstreams: Research, Data, Architecture.
