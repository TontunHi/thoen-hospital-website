# 0001. DM Remission Annual Cohort Snapshot Model

- **Status:** accepted

We model each DM Remission enrollment as one cohort row per patient per Thai fiscal year (`dm_remission_cohorts`) storing pre-intervention, post-intervention, and 3-month post-cessation measurements side by side, rather than normalizing into a multi-visit event log.

## Context and Trade-Offs

Clinical tracking and reporting for the DM Remission program centers on a 29-column fiscal-year cohort table (baseline vs. outcome, plus 3-month post-drug-cessation A1c) across hospital staff and subdistrict PCUs (`รพ.สต.`), with patients able to re-enter or carry over across fiscal years. Modeling every intermediate clinic visit separately would require extra visit-selection rules to populate before/after columns and dashboards, whereas changing from a flat snapshot to longitudinal visits later requires a schema migration.

## Consequences

- Each patient (`hn` or `cid`, when present) is unique within a given `fiscal_year`, enforced in service logic and indexed in MySQL.
- Patients who remain `ไม่ Remission` or `รอ lab A1c` at fiscal year end use an explicit carryover action into the next fiscal year rather than accumulating unbounded visit rows in one year.
- BMI (`bmiBefore`, `bmiAfter`) is derived in domain code from `weightKg` and `heightCm` rather than stored as mutable duplicate columns.
