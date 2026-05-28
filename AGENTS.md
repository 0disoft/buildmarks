# AGENTS.md

## Role

This repository is the public open-source home for Buildmarks, a GitHub profile README card project that visualizes engineering signals from public GitHub activity.

Buildmarks is not a developer ranking tool. It should explain public evidence such as maintainability, project completeness, shipping traces, collaboration traces, and consistency.

## Working Principles

- Write public documentation in English.
- Keep the project honest: public GitHub data is incomplete and must never be presented as a full measure of a developer.
- Make scoring rules transparent, explainable, and inspectable.
- Prefer rule-based scoring before any statistical or AI-based scoring.
- Keep the core engine self-hostable and open-source friendly.
- Keep hosted-service assumptions, billing, private tokens, Cloudflare bindings, and abuse controls out of the public core unless they are safe examples.
- Use `buildmarks.xyz` only as a candidate hosted domain until domain ownership and deployment are real.

## Prohibited Direction

- Do not describe Buildmarks as a hiring filter, global ranking, elite tier, or developer worth score.
- Do not score raw commit count, contribution streaks, follower count, or language percentages as primary quality indicators.
- Do not infer private repositories, private contributions, employer work, compensation, seniority, or job suitability.
- Do not access private GitHub data in the public-core v0.
- Do not hide score reasons behind black-box logic.
- Do not add telemetry, analytics, or hosted secrets to this repository without an explicit product and privacy contract.

## Implementation Notes

- Start with static fixtures and SVG rendering before wiring live GitHub API calls.
- Every score should expose evidence and limitations.
- Failed card generation should return a readable fallback SVG instead of a broken image.
- Cache behavior, rate limits, and GitHub API cost must be documented before live API usage.
- Keep rendering, GitHub collection, scoring, and shared types separable so the project can grow without turning into one large API handler.
- The default license is 0BSD unless explicitly changed by the repository owner.
