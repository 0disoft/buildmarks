# Profile Card Design

The default profile card uses a 420 × 336 layout: identity and checked percentage, a type title and vector illustration, up to two representative projects with three observed details, then scope and generation date. Private-local cards add a visible owner-supplied notice and use 420 × 360. Text is at least 14 pixels at native size, approximately 12 pixels when embedded at 360 pixels. Each type has light and dark palettes; the automatic theme follows the viewer's color scheme. There are no external images, fonts, scripts or embedded raster assets.

The previous 760 × 420 card remains available as `layout: "detailed"`. It shows all six area scores and profile highlights. Reports always retain the full scored areas and criterion ledger regardless of card layout.

## Type Covers

| Project description | Existing signal type | Cover |
| --- | --- | --- |
| Built to Last | `Maintainer-Builder` | Green architectural beams |
| Ready to Use | `Productized Builder` | Orange open package |
| Well Rounded | `Builder` | Violet radial modules |
| Ships Steadily | `Steady Shipper` | Cyan release paths |
| Easy to Pick Up | `Well-Documented Project` | Warm handbook |
| Project Snapshot | `General Signal Profile` | Blue project viewfinder |

The classifier still uses the ordered rules in `src/scoring/signal-type.ts`. If several descriptions fit, the first matching rule wins. The cover describes the generated snapshot; it is not a rank or a permanent identity. A later snapshot can change cover when scores cross a classification boundary. The default receives the same design attention as the other types.

## Sample Gallery

These six cards use **invented scores for design demonstration** and say `Sample data`. They are not assessments of a real account. Each score set is checked against the existing classifier when the examples are regenerated.

![Built to Last sample](../examples/assets/types/built-to-last.svg)

![Ready to Use sample](../examples/assets/types/ready-to-use.svg)

![Well Rounded sample](../examples/assets/types/well-rounded.svg)

![Ships Steadily sample](../examples/assets/types/ships-steadily.svg)

![Easy to Pick Up sample](../examples/assets/types/easy-to-pick-up.svg)

![Project Snapshot sample](../examples/assets/types/project-snapshot.svg)

## Representative Projects

Representatives come from the report's existing `topRepos` display sample, not a new GitHub request. The first project prefers positive criterion IDs related to the profile type, then combined checks and two distinct detail categories. Repository identity breaks ties deterministically. The second project prefers a different project kind when available. Overall score does not decide compact-card order. Changing the report display limit can change the candidates without changing profile scoring.

Combined criteria are preferred within a category, and repeated categories are merged. The first project shows up to two details and the second shows one. Labels describe presence, such as `Tests + workflow` and `Release + changelog`; they do not claim that the workflow runs the tests or the release matches a changelog entry. Unknown IDs, negative evidence and unavailable repository assessments are excluded. Legacy reports without recognizable IDs show a readable empty state rather than invented facts.

Private representatives always use numbered labels such as `Private project 1`, including when a caller supplies a private name directly. The card continues to disclose private scope; its accessible description explains that owner-supplied projects cannot be independently checked. Repository names lead the visible label. The owner is omitted when it matches the profile, or appended otherwise, so a long owner does not hide the project name. Long identifiers are shortened by character width estimates, with full public names retained in accessible descriptions and reports.

## Scores and Missing Details

The detailed card's numeric scores and bar lengths come from the report. It retains all six row positions: an unavailable area says `Not checked`, while an irrelevant area says `Doesn't apply`. Neither receives a zero-score bar. Compact cards leave those rows to the report, retaining their accessible descriptions. If no area can be scored, the renderer returns a readable no-score fallback matching the requested layout and theme.

The checked percentage and `Early look` notice remain separate from scores. Private-local cards still disclose owner-supplied private projects and the limits of independent checking. Tier labels remain in report output and accessible score descriptions; they are no longer the profile cover's headline. No-score fallbacks honor the requested theme, and `renderFallbackCard(message, { theme })` also accepts the optional theme directly.

## Embedding and Ownership

Embed the compact card at 360–420 pixels. Display detailed cards at 600–760 pixels when space allows. Keep a report link beside the image in the README. SVG text uses system fonts, so glyph shapes can vary by platform.

`src/renderer/profile-cover.ts` owns the palettes and editable geometric illustrations. `src/renderer/card-projects.ts` owns representative selection; `compact-card.ts` owns the compact geometry and `profile-card.ts` the detailed geometry. All generate standalone SVGs without page CSS or network assets. `renderUserSignalCard(report, { theme, layout })` defaults to `layout: "compact"`. Scoring rules and JSON report schemas are unchanged. Repository and suggestions cards keep their existing layouts.

For CLI generation, choose `--layout compact` or `--layout detailed` on local, GitHub-card and combined GitHub-artifact commands. The composite Action exposes `card-layout` with the same values and rejects invalid inputs before collection. Report-only generation has no card layout option.

![Detailed profile card](../examples/assets/example-detailed-card.svg)

`scripts/update-examples.ts` is the deterministic source for the fixture cards and type gallery; do not edit generated files by hand. The workspace exposes the bounded offline `buildmarks_card_examples` generation intent. The optional preview helper validates generated SVG structure and renders the gallery with Playwright and Edge, using locally provided tooling without adding production dependencies.
