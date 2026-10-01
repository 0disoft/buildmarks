# Profile Card Design

Profile cards share a 760 × 420 layout: identity at the top, a type title and vector illustration on the left, six project areas on the right, then highlights and scope. Each type has light and dark palettes; the automatic theme follows the viewer's color scheme. There are no external images, fonts, scripts or embedded raster assets.

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

## Scores and Missing Details

Numeric scores and bar lengths come from the report. The card retains all six row positions: an unavailable area says `Not checked`, while an irrelevant area says `Doesn't apply`. Neither receives a zero-score bar. If no area can be scored, the renderer returns a readable no-score fallback.

The checked percentage and `Early look` notice remain separate from scores. Private-local cards still disclose owner-supplied private projects and the limits of independent checking. Tier labels remain in report output and accessible score descriptions; they are no longer the profile cover's headline. No-score fallbacks honor the requested theme, and `renderFallbackCard(message, { theme })` also accepts the optional theme directly.

## Embedding and Ownership

Display at 600–760 pixels when space allows. At 360 pixels the title and illustration remain identifiable, but small metric text cannot replace the report. Keep a report link beside the image in the README. SVG text uses system fonts, so glyph shapes can vary by platform.

`src/renderer/profile-cover.ts` owns the palettes and editable geometric illustrations. `src/renderer/profile-card.ts` owns the common layout. Both generate standalone SVGs without page CSS or network assets. The public `renderUserSignalCard(report, { theme })` interface is unchanged, as are scoring rules and JSON report schemas. Repository and suggestions cards keep their existing layouts.

`scripts/update-examples.ts` is the deterministic source for the fixture cards and type gallery; do not edit generated files by hand. The workspace exposes the bounded offline `buildmarks_card_examples` generation intent. The optional preview helper validates generated SVG structure and renders the gallery with Playwright and Edge, using locally provided tooling without adding production dependencies.
