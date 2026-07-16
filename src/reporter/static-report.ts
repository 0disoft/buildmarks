import {
  dimensionLabels,
  scoringMethodologyVersion,
  signalTypeDisplayLabels,
  signalDimensions,
  type ProfileInput,
  type RepoSignal,
  type RepoSignalV2,
  type ScoringMethodologyVersion,
  type SignalDimension,
  type UserSignalGapsReport,
  type UserSignalReport,
  type UserSignalReportV2
} from "../shared/types.js";
import { privateLocalPublicCommitWarning } from "../shared/private-local-warning.js";
import { analyzeSignalGaps } from "../scoring/gaps.js";
import { scoreUserProfile, type ScoreUserProfileOptions } from "../scoring/score-user.js";

export interface BuildmarksStaticReport {
  version: 1;
  profile: UserSignalReport;
  gaps: UserSignalGapsReport;
  repositories: RepoSignal[];
}

export interface BuildmarksStaticReportV2 extends BuildmarksStaticReport {
  schemaVersion: "buildmarks-report/v1";
  methodologyVersion: ScoringMethodologyVersion;
  profile: UserSignalReportV2;
  repositories: RepoSignalV2[];
}

export interface CreateStaticReportOptions extends ScoreUserProfileOptions {}

export function createStaticReport(
  profile: ProfileInput,
  options: CreateStaticReportOptions = {}
): BuildmarksStaticReportV2 {
  const scoredProfile = scoreUserProfile(profile, options);
  const gaps = analyzeSignalGaps(profile, {
    ...(options.maxRepositories === undefined ? {} : { maxRepositories: options.maxRepositories }),
    ...(options.now === undefined ? {} : { now: options.now })
  });

  return {
    version: 1,
    schemaVersion: "buildmarks-report/v1",
    methodologyVersion: scoringMethodologyVersion,
    profile: scoredProfile,
    gaps,
    repositories: scoredProfile.topRepos
  };
}

export function renderStaticReportHtml(report: BuildmarksStaticReport): string {
  const hasInsufficientEvidence = report.profile.evidenceStatus === "insufficient";
  const scopeSummary = report.profile.signalVisibility?.privateRepositoriesIncluded === true
    ? "Public GitHub plus owner-supplied private repositories · Private details cannot be checked independently · Not a ranking"
    : "Based on public GitHub repositories only · Not a ranking";
  const gapScope = report.gaps.signalVisibility?.privateRepositoriesIncluded === true
    ? "Suggestions drawn from the public and owner-supplied private repositories included in this local report."
    : "Suggestions drawn from the public repositories Buildmarks could review.";
  const dimensions = signalDimensions
    .filter((dimension) =>
      report.profile.unavailableDimensions?.includes(dimension) !== true &&
      report.profile.notApplicableDimensions?.includes(dimension) !== true
    )
    .map((dimension) => renderDimension(report.profile, dimension))
    .join("") || '<p class="muted">No project-area scores are available.</p>';
  const findings = report.profile.evidence.length === 0
    ? "<li>No project practices to show.</li>"
    : report.profile.evidence.map((item) => `<li>${escapeHtml(item.label)}</li>`).join("");
  const noGapsMessage = "No project suggestions are available for this report.";
  const gaps = report.gaps.gaps.length === 0
    ? `<li>${escapeHtml(noGapsMessage)}</li>`
    : report.gaps.gaps
      .slice(0, 12)
      .map((gap) => `<li><strong>${escapeHtml(gap.repository)}</strong> · ${escapeHtml(dimensionLabels[gap.dimension])}: Could add ${escapeHtml(gap.missing.join(", "))}.</li>`)
      .join("");
  const repositories = report.repositories
    .map((repository) => renderRepository(repository))
    .join("") || '<p class="muted">No repository highlights to show.</p>';
  const limitations = report.profile.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const privateLocalWarning = report.profile.signalVisibility?.reportVisibility === "private-local"
    ? `<p class="warning">${escapeHtml(privateLocalPublicCommitWarning)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Buildmarks report for ${escapeHtml(report.profile.username)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f6f8fb;
      --panel: #ffffff;
      --text: #102030;
      --muted: #5b7083;
      --border: #d8e2ec;
      --accent: #0f8b6c;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #081018;
        --panel: #101923;
        --text: #eef5fb;
        --muted: #96a9ba;
        --border: #26394a;
        --accent: #4ee6a6;
      }
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(960px, calc(100% - 32px));
      margin: 40px auto;
    }
    header, section {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 18px;
    }
    h1, h2, h3, p {
      margin-top: 0;
    }
    .muted {
      color: var(--muted);
    }
    .score {
      font-size: 48px;
      font-weight: 800;
      color: var(--accent);
      line-height: 1;
    }
    .warning {
      border-left: 4px solid var(--accent);
      padding-left: 12px;
      font-weight: 650;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .item {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
    }
    .bar {
      height: 8px;
      border-radius: 999px;
      background: rgba(15, 139, 108, 0.18);
      background: color-mix(in srgb, var(--accent), transparent 82%);
      overflow: hidden;
    }
    .fill {
      height: 100%;
      background: var(--accent);
      border-radius: inherit;
    }
    code {
      color: var(--accent);
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="muted">Buildmarks static report</p>
      <h1>${escapeHtml(report.profile.username)}</h1>
      <p class="score">${hasInsufficientEvidence ? "Not scored" : `${report.profile.overall}/100`}</p>
      <p>${hasInsufficientEvidence ? "Not enough complete repository data for a reliable score" : escapeHtml(signalTypeDisplayLabels[report.profile.signalType])} · ${escapeHtml(scopeSummary)}</p>
      <p class="muted">${escapeHtml(assessmentSummary(report.profile))}</p>
      ${privateLocalWarning}
      <p class="muted">Generated ${escapeHtml(report.profile.generatedAt)}</p>
    </header>

    <section>
      <h2>Project Areas</h2>
      <div class="grid">${dimensions}</div>
    </section>

    <section>
      <h2>What We Found</h2>
      <ul>${findings}</ul>
    </section>

    <section>
      <h2>Ways to Improve</h2>
      <p class="muted">${escapeHtml(gapScope)}</p>
      <ul>${gaps}</ul>
    </section>

    <section>
      <h2>Repository Highlights</h2>
      <div class="grid">${repositories}</div>
    </section>

    <section>
      <h2>Limitations</h2>
      <ul>${limitations}</ul>
    </section>
  </main>
</body>
</html>`;
}

function renderDimension(report: UserSignalReport, dimension: SignalDimension): string {
  const score = safeScore(report.dimensions[dimension]);
  const assessment = report.dimensionAssessments?.[dimension];
  const detail = assessment === undefined
    ? ""
    : `<p class="muted">${escapeHtml(formatConfidence(assessment.confidence))} · ${Math.round(assessment.coverage.ratio * 100)}% checked</p>`;

  return `<article class="item">
    <h3>${escapeHtml(dimensionLabels[dimension])}</h3>
    <p><strong>${score}/100</strong></p>
    <div class="bar" aria-hidden="true"><div class="fill" style="width: ${score}%"></div></div>
    ${detail}
  </article>`;
}

function renderRepository(repository: RepoSignal): string {
  const kind = repository.repositoryKind?.kind ?? "general";
  const details = repository.evidence.length === 0
    ? "No repository highlights to show."
    : repository.evidence.slice(0, 2).map((item) => escapeHtml(item.label)).join(" · ");
  return `<article class="item">
    <h3>${escapeHtml(repository.owner)}/${escapeHtml(repository.name)}</h3>
    <p><strong>${safeScore(repository.overall)}/100</strong></p>
    <p class="muted">${escapeHtml(formatRepositoryKind(kind))}</p>
    <p class="muted">${details}</p>
  </article>`;
}

function assessmentSummary(report: UserSignalReport): string {
  const confidence = formatConfidence(report.confidence ?? null);
  const coverage = Math.round((report.coverage?.ratio ?? 0) * 100);
  const status = report.resultStatus === "unavailable"
    ? "Result unavailable"
    : report.resultStatus === "provisional"
      ? "Provisional result"
      : "Reviewed result";
  return `${status} · ${confidence} · ${coverage}% checked · Methodology ${report.methodologyVersion ?? "legacy"}`;
}

function formatConfidence(value: UserSignalReport["confidence"]): string {
  if (value === "high") {
    return "High confidence";
  }
  if (value === "medium") {
    return "Medium confidence";
  }
  if (value === "low") {
    return "Low confidence";
  }
  return "Confidence unavailable";
}

function formatRepositoryKind(value: string): string {
  return value === "cli"
    ? "CLI"
    : value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function safeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function escapeHtml(value: string): string {
  return stripControlCharacters(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}
