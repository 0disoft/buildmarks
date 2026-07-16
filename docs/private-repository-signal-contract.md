# Private Repository Signal Contract

Buildmarks is public-only by default. A normal profile card should be safe to publish without leaking private repository names, private organization work, or claims that nobody else can check.

Some people keep most of their projects private. Private-local mode can include those owner-supplied repositories, but it crosses a different trust boundary from a public card and must never masquerade as one.

## Modes

### Public-Only Mode

Public-only mode is the default.

- Uses public GitHub repositories only.
- Produces public-safe SVG and report artifacts.
- Lets readers inspect the supporting details on public GitHub.
- Does not require private token scopes.
- Does not include private repositories, private contributions, employer work, or private organization activity.

### Private-Local Mode

Private-local mode is opt-in and must stay local or self-hosted by the repository owner.

- Requires an explicitly supplied token.
- Should use a fine-grained GitHub token with read-only access to selected repositories only.
- May include selected private repositories supplied by the owner.
- Must not upload private repository data to a hosted Buildmarks service by default.
- Must mark generated cards as `Public + Private Signals`.
- Must state that the private details came from the owner and cannot be checked independently on public GitHub.
- Must redact private repository names by default.
- Must keep detailed reports private-local by default.
- Must warn that generated SVG, HTML, and JSON artifacts can reveal owner-supplied private repository metadata if committed to a public profile repository.
- Must disclose that the built-in private-local collector does not expose private file contents and therefore treats README usage-guide detection conservatively for private repositories.

## What Private-Local Mode May Review

Private-local mode may use the same coarse project details as the public collector:

- repository metadata needed for aggregation
- repository visibility and archive/fork flags
- familiar project surfaces such as README, LICENSE, CI workflows, tests, changelog, contribution guide, code of conduct, security policy, demo/docs links, and package manifests
- coarse repository shape such as source, test, and example file counts plus source-file size buckets
- release or tag presence
- aggregate issue and pull request traces, when those methodology and API-cost rules are defined

The useful questions are modest:

```txt
Does this private project look maintained?
Does it have docs, tests, CI, releases, and basic project hygiene?
```

The intent is not to inspect private code or rank the owner.

Because file contents are out of bounds, the built-in private-local collector does not read private README text. It can see that a README exists in tree metadata, but it cannot confidently say that the README teaches someone how to use the project. Any richer owner-controlled input still has to follow the same disclosure and redaction rules.

## What Private-Local Mode Must Not Use

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

Any card or report that includes private repositories must state the boundary in these exact terms:

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

Redaction does not make the artifacts harmless. Repository count, project practices, release or tag presence, and coarse codebase shape can still reveal information the owner meant to keep private. Do not commit private-local SVG, HTML, or JSON to a public profile repository unless publishing that information is intentional.

Public repository evidence may stay visible.

## Token Boundary

Private-local mode should prefer fine-grained GitHub tokens scoped to selected repositories with read-only access.

Classic `repo` tokens are broader than necessary and should not be the default recommendation.

Buildmarks core does not search environment variables for private tokens. Callers must pass a private-local token explicitly, making the access choice visible at the call site.

## Hosted Boundary

Private-local mode is not a hosted endpoint contract.

Before any hosted private mode exists, Buildmarks would need a separate product and privacy contract covering encryption, retention, deletion, abuse controls, auditability, billing, and explicit consent. That is intentionally outside the v0 public OSS core.
