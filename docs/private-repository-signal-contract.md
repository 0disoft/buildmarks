# Private Repository Signal Contract

Buildmarks is public-only by default. Public profile cards should remain safe to publish in a GitHub profile README without exposing private repository names, private organization work, or unverifiable claims.

Some developers do most of their meaningful work in private repositories. Buildmarks may support those users through an explicit private-local mode, but that mode is a different trust surface from the public card.

## Modes

### Public-Only Mode

Public-only mode is the default.

- Uses public GitHub repositories only.
- Produces public-safe SVG and report artifacts.
- Keeps evidence independently inspectable from public GitHub data.
- Does not require private token scopes.
- Does not include private repositories, private contributions, employer work, or private organization activity.

### Private-Local Mode

Private-local mode is opt-in and must stay local or self-hosted by the repository owner.

- Requires an explicitly supplied token.
- Should use a fine-grained GitHub token with read-only access to selected repositories only.
- May include private repository signals selected by the owner.
- Must not upload private repository data to a hosted Buildmarks service by default.
- Must mark generated cards as `Public + Private Signals`.
- Must state that private evidence is owner-supplied and not independently verifiable from public GitHub.
- Must redact private repository names by default.
- Must keep evidence reports private-local by default.

## Allowed Private-Local Evidence

Private-local mode may use coarse evidence that resembles the public collector contract:

- repository metadata needed for aggregation
- repository visibility and archive/fork flags
- file-presence signals such as README, LICENSE, CI workflows, tests, changelog, contribution guide, code of conduct, security policy, demo/docs links, and package artifacts
- release or tag presence
- aggregate issue and pull request traces, when those methodology and API-cost rules are defined

The intent is to answer questions like:

```txt
Does this private project look maintained?
Does it have docs, tests, CI, releases, and basic project hygiene?
```

The intent is not to inspect private code or rank the owner.

## Prohibited Private-Local Evidence

Private-local mode must not collect, store, render, or infer:

- file contents
- commit messages
- issue titles, issue bodies, pull request titles, or pull request bodies
- private contribution graph inference
- raw commit count
- contribution streaks
- follower count
- language percentages as a quality signal
- employer, seniority, compensation, hiring suitability, pass/fail, or developer worth

## Disclosure Requirements

Any card or report that includes private repositories must disclose the trust boundary:

```txt
Public + Private Signals
Private repositories included by owner
Private evidence is not independently verifiable from public GitHub
```

The public-only card label must not be reused for private-local output.

## Redaction Defaults

Private-local output should hide sensitive details unless the user explicitly opts into revealing them.

Default redactions:

- private repository names
- private organization names
- private repository URLs
- private file paths when the path itself may reveal customer, employer, or product names

Public repository evidence may stay visible.

## Token Boundary

Private-local mode should prefer fine-grained GitHub tokens scoped to selected repositories with read-only access.

Classic `repo` tokens are broader than necessary and should not be the default recommendation.

Buildmarks core must not read ambient environment variables for private tokens. Callers must pass private-local tokens explicitly.

## Hosted Boundary

Private-local mode is not a hosted endpoint contract.

Before any hosted private mode exists, Buildmarks would need a separate product and privacy contract covering encryption, retention, deletion, abuse controls, auditability, billing, and explicit consent. That is intentionally outside the v0 public OSS core.
