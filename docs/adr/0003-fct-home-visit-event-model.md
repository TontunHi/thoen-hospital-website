# 0003. Visit-Based Event Model for FCT Home Visit Registry

- **Status:** accepted

We model each FCT Home Visit entry as an independent visit event (`fct_home_visits`) keyed by visit record ID and grouped by Thai fiscal year via `visit_date`, allowing the same patient (`hn`) to have multiple home visit rows over time, rather than reusing the one-row-per-patient-per-fiscal-year snapshot model of DM Remission (`ADR-0001`).

## Context and Trade-Offs

Although `/service/fct-home-visit` shares the spreadsheet-style UI, dashboard pattern, and configurable dropdown registry (`fct_home_visit_options`) of `/service/dm-remission`, multidisciplinary Family Care Team (FCT) visits happen repeatedly on specific `visit_date`s to track changing clinical status (`ดีขึ้น`, `คงเดิม`, `แย่ลง`, `เสียชีวิต`), ADL scores, and five-discipline care notes. Forcing one row per patient per fiscal year would overwrite prior home visit history, whereas a visit-event model lets teams record longitudinal follow-ups and compute both total visits and unique patients (`hn`) on the dashboard without carrying over cohorts across fiscal years.

## Consequences

- The same `hn` may appear across multiple `visit_date` rows within the same Thai fiscal year (Oct 1 to Sep 30).
- Cases without an `hn` are permitted; when `hn` is present alongside `visit_date`, batch Excel/CSV import detects `(visit_date, hn)` collisions and flags them for user review instead of silently creating duplicates.
- Dashboard metrics distinguish total visit count from unique patient count (`hn`), and the UI omits fiscal-year carryover modals.
- FCT Home Visit operates as a standalone registry and does not mutate `Palliative Care` or `LTC Registry` tables, pulling only combined `patientName`, `age`, and `address` from HOSxP on HN lookup (with no CID field stored).
