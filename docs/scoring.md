# Scoring

Buildmarks uses a published set of rules to describe what can be seen in a repository. It does not rank developers, predict job performance, or fill in work that GitHub does not show.

Public-only results cover public repositories. Private-local results may also include repositories supplied by their owner, but those details cannot be checked independently on public GitHub and must be labeled accordingly.

## Methodology 2.0.0

The current scoring methodology is `2.0.0`. That value describes how Buildmarks calculates a result; it is separate from the JSON report format. Static reports currently use `schemaVersion: "buildmarks-report/v1"`, whose package schema is published at `schemas/buildmarks-report-v1.schema.json`.

This separation is deliberate. The scoring rules can evolve without pretending that every change creates a new report envelope, and a future report schema can change without silently changing how scores are calculated.

## What Buildmarks Reviews

Buildmarks looks at six parts of a project:

- Maintainability
- Project Readiness
- Ease of Use
- Shipping
- Consistency
- Project Care

Each repository is reviewed against checks that make sense for its kind. The supported kinds are `library`, `application`, `cli`, `documentation`, `monorepo`, `experiment`, and `general`.

Repository kind may be declared by the caller, detected from the repository tree, inferred from the available project details, or left as the `general` fallback. The report records both the chosen kind and how confidently Buildmarks made that choice. Kind detection is intentionally conservative: a package manifest alone, for example, is not enough to claim that Buildmarks understands the project's purpose with high confidence.

## Score, Confidence, Coverage, and Applicability

These fields answer different questions and should not be collapsed into one number:

- `score` describes the share of available points earned by the checks Buildmarks could actually complete.
- `confidence` (`low`, `medium`, or `high`) summarizes how much of the applicable review was observed.
- `coverage` records the observed check count, expected check count, and their ratio.
- `applicability` says whether a check or dimension is `applicable`, `not-applicable`, or `unavailable`.

`not-applicable` means the check does not fit that repository kind. A documentation repository is not penalized for lacking an application release pipeline. `unavailable` means the check would matter, but Buildmarks did not have enough information to decide. Unknown data is never treated as a failed check.

A dimension needs at least 50% coverage before Buildmarks will calculate its score. Confidence is low below 60% coverage, medium from 60% through 84%, and high from 85% upward. When the profile as a whole is too incomplete, the result becomes `provisional` or `unavailable` instead of dressing a thin snapshot up as a firm conclusion.

## How Points Work

Methodology 2.0.0 gives more weight to project practices that reinforce one another than to isolated files. A CI workflow and a real test surface together say more than either item alone. Releases backed by an installable package, change notes that line up with shipped versions, and documentation backed by examples work the same way.

Checks therefore use four bases:

- `presence`: a useful public trace exists, such as a README, license, or workflow.
- `corroborated`: two or more details support the same practice.
- `shape`: coarse repository-tree measurements support the finding.
- `history`: public dates support a recency or continuity finding.

A dimension supported only by presence checks is capped at 40, even when every visible file is present. The cap is lifted only when at least one corroborated criterion in that dimension passes. This keeps a pile of empty checkbox files from looking equivalent to working project habits.

Within each applicable dimension, points earned are divided by points available from the checks Buildmarks could complete, then scaled to 0–100. The repository total combines the six dimension assessments using these weights:

- Maintainability: 25%
- Project Readiness: 20%
- Ease of Use: 15%
- Shipping: 15%
- Consistency: 10%
- Project Care: 15%

Dimensions marked `not-applicable` are left out of the calculation. Missing observations reduce coverage instead of quietly becoming zeroes.

## Profile Calculation and Display

Forked and archived repositories are excluded by default. Every remaining repository with a complete enough Git tree is evaluated, and all of those evaluated repositories contribute to the profile calculation.

The card and report may show fewer repositories than were used in the calculation. Display selection is `kind-stratified`: Buildmarks first tries to show a strong representative from each repository kind, then fills the remaining slots by score with a stable owner/name tie-break. The default display limit is 12. The report's `selection` object records eligible, evaluated, displayed, and limit counts so the distinction is visible.

This prevents a profile full of one project type from hiding the rest of the owner's public project mix, while avoiding the older mistake of calculating the profile from only the repositories that fit on the card.

## What Buildmarks Found

In public-only mode, Buildmarks can use public traces such as:

- README and practical setup or usage guidance
- license information
- CI workflows and visible tests
- changelogs, releases, and tags
- documentation, demos, examples, and package manifests
- contribution, conduct, and security guidance
- coarse repository-tree measurements such as test-file ratio and source-file size buckets
- public creation and push dates

The `Evidence` API type and `evidenceLedger` report field retain their exact names for consumers. In the rendered report, these are simply the supporting details behind a result. A score that cannot point back to those details should not be shown.

Stars, forks, issue traffic, review traffic, and outside contributors do not raise the default score. Healthy solo projects, young projects, and work coordinated elsewhere may have little or none of that public activity.

## Codebase Shape

Buildmarks reads Git tree metadata, not source contents or line counts. It can summarize source, test, and example file counts; test-to-source ratio; median and 90th-percentile source-file sizes; and the share of unusually large source files.

Generated, vendored, dependency, build-output, lockfile, minified, and sourcemap paths are left out. These measurements are rough clues about project structure, not a code-quality verdict.

If GitHub truncates a recursive tree, that repository is excluded from scoring and improvement hints. A path missing from an incomplete tree is unknown, not absent. If failed collection and truncated trees account for at least half of the attempted repositories, Buildmarks does not present a normal score.

## Boundaries

Buildmarks does not use raw commit counts, contribution streaks, follower counts, language percentages, private employer work, inferred seniority, job suitability, or hiring pass/fail labels.

Private-local mode is an explicit owner-controlled exception for selected private repositories. Names are redacted by default, private file contents stay outside the built-in collector, and the output must say `Public + Private Signals`. The result still describes repository practices, not the person who owns them.

## Source of Truth

The methodology version and public types live in `src/shared/types.ts`. Criteria and point values live in `src/scoring/methodology-v2.ts`; assessment behavior lives in `src/scoring/assessment.ts`; repository and profile aggregation live in `src/scoring/score-repo.ts` and `src/scoring/score-user.ts`.

The static report envelope is implemented in `src/reporter/static-report.ts` and described by `schemas/buildmarks-report-v1.schema.json`. Example input lives in `fixtures/example-public-profile.json`.
