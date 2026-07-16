# How Scoring Works

Buildmarks describes what it can see in a repository. It does not rank developers, predict job performance, or guess about work that GitHub does not show.

Public cards cover public repositories. Private-local cards may also include repositories supplied by their owner. Those private projects cannot be checked independently on public GitHub, so the card says that plainly.

## Scoring Rules 2.0.1

The current scoring rules are `2.0.1`. The JSON file still uses `schemaVersion: "buildmarks-report/v1"`. One number tracks how scores are calculated; the other tracks the JSON shape. They can change separately.

## What Buildmarks Looks At

Buildmarks looks at six parts of a project:

- Maintainability
- Project Readiness
- Ease of Use
- Shipping
- Consistency
- Project Care

Each repository is checked in a way that fits what it is: `library`, `application`, `cli`, `documentation`, `monorepo`, `experiment`, or `general`.

The caller can name the project kind, or Buildmarks can work it out from the repository tree and project files. If the available details do not point clearly to one kind, Buildmarks uses `general` instead of pretending to know more than it does.

Checks that do not make sense for a project are left out. Checks that could not be completed are left undecided rather than counted as failures. A documentation project, for example, is not punished for lacking an application release pipeline.

## When a Score Is Shown

A project area needs at least half of its relevant details checked before it receives a score. Unknown details do not become zeroes.

The profile card shows its normal tier when Buildmarks checked at least 85% of the relevant project details and at least 85% of the repositories it tried to read. A thinner pass is labeled as an early look. If half or more of the attempted repositories could not be read, Buildmarks shows no score.

The checked percentage appears on the card so readers can see how much Buildmarks actually reviewed without a second label trying to interpret the number for them.

## How Points Add Up

Project habits that back each other up are worth more than isolated files. Tests backed by CI say more than either item alone. A release backed by an installable package, change notes that line up with shipped versions, and documentation backed by examples work the same way.

A project area supported only by standalone files can reach at most 40. The cap is lifted when another project detail shows that the practice is real rather than decorative.

The repository total uses these weights:

- Maintainability: 25%
- Project Readiness: 20%
- Ease of Use: 15%
- Shipping: 15%
- Consistency: 10%
- Project Care: 15%

Project areas that do not fit the repository are left out of the total.

## Profile Calculation and Card Display

Forked and archived repositories are left out by default. Every remaining repository with a complete enough Git tree contributes to the profile score.

The card may show fewer repositories than were used. Buildmarks first tries to show a strong example from each project kind, then fills the remaining slots by score. The default display limit is 12. The JSON records how many repositories were eligible, attempted, missed, checked, and shown.

## What Buildmarks Can Find

Buildmarks can use:

- README and practical setup or usage guidance
- license information
- CI workflows and visible tests
- changelogs, releases, and tags
- documentation, demos, examples, and package manifests
- contribution, conduct, and security guidance
- rough repository-tree details such as test-file share and source-file size buckets
- public creation and push dates

The JSON keeps its existing machine-facing field names so tools built against 0.2.0 continue to work. Cards and HTML pages use ordinary wording such as “What We Found” and “97% checked.”

Stars, forks, issue traffic, review traffic, and outside contributors do not raise the default score. Healthy solo projects, young projects, and work coordinated elsewhere may have little or none of that public activity.

## Repository Shape

Buildmarks reads Git tree details, not source contents or line counts. It can count source, test, and example files, compare tests with source files, and group source files by rough size.

Generated, vendored, dependency, build-output, lockfile, minified, and sourcemap paths are left out. These counts are rough clues about project structure, not a code-quality verdict.

If GitHub truncates a recursive tree, that repository is left out of the score and improvement ideas. A missing path in an incomplete tree is unknown, not absent.

## Boundaries

Buildmarks does not use raw commit counts, contribution streaks, follower counts, language percentages, private employer work, inferred seniority, job suitability, or hiring pass/fail labels.

Private-local mode is owner-controlled and opt-in. Names are hidden by default, private file contents stay outside the built-in collector, and the output says `Public + Private Projects`. The result still describes repositories, not the person who owns them.

## Source of Truth

The rule version and public types live in `src/shared/types.ts`. Checks and point values live in `src/scoring/methodology-v2.ts`. The code that scores one project area lives in `src/scoring/assessment.ts`; repository and profile totals live in `src/scoring/score-repo.ts` and `src/scoring/score-user.ts`.

The static JSON and HTML output is implemented in `src/reporter/static-report.ts` and described by `schemas/buildmarks-report-v1.schema.json`. Example input lives in `fixtures/example-public-profile.json`.
