# Decisions

One entry per decision, newest last. Superseded decisions stay; a later entry replaces them.

<!-- engine.py writes one entry per init, set and lock, in this shape (spec 7.9): -->
## D-{{nnnn}} · {{answers.Q-shape-01 | dials.roundness | raw.brandColor | hooks.H-logo.status}} = {{value}}
- set_by: {{chosen | confirmed_default | auto_default | assumed | delegated | reference | asset}} · locked: {{yes | no}} · date: {{YYYY-MM-DD}} · supersedes: {{D-nnnn | none}} · source_ref: {{ref-id | none}}
- reason: {{the owner's words, or the source of the default}}
- also set: {{derived path}} = {{value}} (from {{Q-id}})

<!-- The interviewing model adds a plain-language summary after each stage, for teammates: -->
## Stage {{NN}} summary · {{YYYY-MM-DD}} · {{stage title}}
{{2 to 5 plain sentences: what we chose and why, and what we turned down and why. For each reference: what we took and what we swapped.}}

<!-- And at the end of the interview: -->
## Open items · {{YYYY-MM-DD}}
- Assumed answers to confirm: {{question ids}}
- Pending assets and their briefs: {{hook ids and owners}}
- Warnings waived, with reasons: {{rule ids}}
