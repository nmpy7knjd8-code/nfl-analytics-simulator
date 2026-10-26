# NFL Analytics Simulator

**Website / progress hub:** [HANDOFF.md](HANDOFF.md) · [index](index.md)

Research-grounded **NFL-only** analytics and simulation (historical-first). Local-first, CPU-only. No sports-betting features in the MVP.

**Phase 1** architecture and shared contracts are established locally. **Phase 2 is paused for approval.**

## Project docs (working Pages links)

- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Decisions](DECISIONS.md)
- [Data dictionary](DATA_DICTIONARY.md)
- [Data experiment](DATA_EXPERIMENT.md)
- [Research register](RESEARCH_REGISTER.md)
- [Model catalog](MODEL_CATALOG.md)
- [Model validation](MODEL_VALIDATION.md)
- [Licensing & data sources](LICENSING_AND_DATA_SOURCES.md)
- [UI design system](UI_DESIGN_SYSTEM.md)
- [UI screen specs](UI_SCREEN_SPECS.md)
- [AGENTS.md](../AGENTS.md)
- [Handoff checklist](HANDOFF.md)

## Stack (locked)

| Layer | Choice |
| --- | --- |
| Backend | Python + FastAPI |
| Storage | DuckDB + Parquet |
| Models | scikit-learn first; XGBoost only if justified |
| Frontend | Next.js + TypeScript |
| Data | nflverse PBP via **nflreadpy==0.1.5** |

## Experiment window

Train 2019–2021 · validate 2022 · test 2023. See [DATA_EXPERIMENT.md](DATA_EXPERIMENT.md).

## Source repository

https://github.com/nmpy7knjd8-code/nfl-analytics-simulator
