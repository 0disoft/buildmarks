# Buildmarks

Buildmarks turns public GitHub activity into engineering signal cards for GitHub profile READMEs.

It is not a developer ranking tool. It does not claim to measure a person's full engineering ability. It only visualizes signals that are visible in public GitHub repositories.

```txt
No streaks.
No commit vanity.
No language pie charts.

Just public signals for maintainability, completeness, shipping evidence, collaboration, and consistency.
```

## Status

Buildmarks is in repository bootstrap stage. There is no package, API server, renderer, or hosted service yet.

The intended license is 0BSD so the scoring rules, renderer, and self-host path can stay easy to reuse.

## Project Goals

- Generate SVG cards that can be embedded in GitHub profile READMEs.
- Explain public engineering signals instead of producing vanity stats.
- Keep scoring rules transparent and inspectable.
- Return JSON reports with the same evidence shown in cards.
- Provide a self-hostable core before any hosted service layer.

## Non-Goals

Buildmarks must not become:

- a global developer leaderboard
- a hiring pass/fail tool
- an "elite developer" badge
- a raw commit-count or contribution-streak card
- a private repository analyzer
- a black-box developer score

## Signal Areas

Buildmarks focuses on these public signal areas:

```txt
maintainability
project completeness
shipping evidence
collaboration traces
consistency
external validation with strict caps
```

Examples of evidence:

- README with installation or usage guidance
- LICENSE file
- release or tag history
- CI workflow files
- test configuration or test directory
- issue and pull request templates
- public pull request or issue response traces
- demo, documentation, or package links

## Anti-Gaming Principles

- Raw commit count is not a primary score.
- Contribution streak is not scored.
- Stars and forks must be capped and treated as weak adoption signals.
- Forked repositories are excluded by default.
- Archived repositories are excluded by default.
- One popular repository must not dominate the whole profile.
- Low public activity must never produce a harsh personal label.
- Every score must show evidence and limitations.
- Every card must clearly state that it uses public data only.

## Planned Surfaces

Future API shape may look like this:

```txt
GET /api/card/user/{username}.svg
GET /api/card/repo/{owner}/{repo}.svg
GET /api/report/user/{username}.json
GET /api/report/repo/{owner}/{repo}.json
```

These routes are not implemented yet.

## Candidate Hosted Domain

`buildmarks.xyz` is a candidate domain for a hosted service or public documentation site. Until the domain is actually owned and deployed, it must be treated as a candidate only.

## Repository Shape

The first implementation should start small:

```txt
fixtures/
packages/
  renderer/
  scoring/
  shared/
docs/
  scoring.md
  anti-gaming.md
examples/
  profile-readme.md
```

Do not create every folder before it has real content.

## Development

No toolchain is installed yet. After a package scaffold is added, this section should list the real commands.

Expected future checks:

```bash
bun run check
bun test
bun run build
```

## License

Buildmarks is intended to be released under the 0BSD license. See [LICENSE](LICENSE).
