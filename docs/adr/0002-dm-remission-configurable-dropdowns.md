# 0002. Configurable Dropdown Registry for DM Remission Outcomes

- **Status:** accepted

We store selectable options for `สรุป Remission`, lifestyle behavior summaries (`สรุป การปรับอาหาร`, `สรุป การออกกำลังกาย`, `สรุป IF`), and optional `รพ.สต.` presets in a database table (`dm_remission_options`) managed by `admin` users, rather than hardcoding TypeScript or SQL enums.

## Context and Trade-Offs

Clinic leads have defined initial statuses for `สรุป Remission` (`Remission`, `ไม่ Remission`, `รอ lab A1c`) but explicitly want to expand remission categories later and start lifestyle behavior dropdowns empty until clinical definitions are finalized. Hardcoding enums would require code edits and deployments for each new label, whereas storing free strings backed by an option registry allows immediate expansion while keeping dashboard aggregation grouped cleanly by option label.

## Consequences

- Behavior summary dropdowns (`diet`, `exercise`, `if_fasting`) start with zero seeded options until an `admin` adds them via the settings UI.
- Cohort rows store the selected label text so renaming or disabling an option in settings does not orphan historical fiscal-year records.
- Only `admin` accounts can create, reorder, toggle, or delete configured options, while `member`, `admin`, and `subdistrict` users select from active options in the cohort form.
