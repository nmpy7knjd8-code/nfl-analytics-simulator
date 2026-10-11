# EP Stage A targets

See [`docs/EP_MODEL_SPEC.md`](../../docs/EP_MODEL_SPEC.md) and [`AUDIT.md`](AUDIT.md).

- Target: next score in half (7 classes)
- Values: +7,+3,+2,0,−2,−3,−7
- XP/2PT: not independent next-score labels
- Features: no `era_post_2020` in production
- Split: train 2019–2021 / val 2022 / test 2023
- nflverse `ep`/`epa`: reference agreement only (parity not required)
