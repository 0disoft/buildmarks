import {
  dimensionLabels,
  signalDimensions,
  type ProfileInput,
  type RepoSignal,
  type SignalDimension,
  type UserSignalGapsReport,
  type UserSignalReport
} from "../shared/types";
import { analyzeSignalGaps } from "../scoring/gaps";
import { scoreUserProfile, type ScoreUserProfileOptions } from "../scoring/score-user";

export interface BuildmarksStaticReport {
  version: 1;
  profile: UserSignalReport;
  gaps: UserSignalGapsReport;
  repositories: RepoSignal[];
}

export interface CreateStaticReportOptions extends ScoreUserProfileOptions {}

export function createStaticReport(
  profile: ProfileInput,
  options: CreateStaticReportOptions = {}
): BuildmarksStaticReport {
  const scoredProfile = scoreUserProfile(profile, options);
  const gaps = analyzeSignalGaps(profile);

  return {
    version: 1,
    profile: scoredProfile,
    gaps,
    repositories: scoredProfile.topRepos
  };
}

export function renderStaticReportHtml(report: BuildmarksStaticReport): string {
  const dimensions = signalDimensions.map((dimension) => renderDimension(report.profile, dimension)).join("");
  const evidence = report.profile.evidence.map((item) => `<li>${escapeHtml(item.label)}</li>`).join("");
  const gaps = report.gaps.gaps.length === 0
    ? "<li>No obvious public signal gaps detected.</li>"
    : report.gaps.gaps
      .slice(0, 12)
      .map((gap) => `<li><strong>${escapeHtml(gap.repository)}</strong> · ${escapeHtml(dimensionLabels[gap.dimension])}: missing ${escapeHtml(gap.missing.join(", "))}</li>`)
      .join("");
  const repositories = report.repositories
    .map((repository) => renderRepository(repository))
    .join("");
  const limitations = report.profile.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

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
      <p class="score">${report.profile.overall}/100</p>
      <p>${escapeHtml(report.profile.signalType)} · Public GitHub evidence only · Not a ranking</p>
      <p class="muted">Generated ${escapeHtml(report.profile.generatedAt)}</p>
    </header>

    <section>
      <h2>Dimension Scores</h2>
      <div class="grid">${dimensions}</div>
    </section>

    <section>
      <h2>Evidence</h2>
      <ul>${evidence}</ul>
    </section>

    <section>
      <h2>What's Missing</h2>
      <p class="muted">Improvement hints based on missing public signals.</p>
      <ul>${gaps}</ul>
    </section>

    <section>
      <h2>Repository Signals</h2>
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
  if (report.unavailableDimensions?.includes(dimension) === true) {
    return `<article class="item">
    <h3>${escapeHtml(dimensionLabels[dimension])}</h3>
    <p><strong>N/A</strong></p>
    <p class="muted">Not available for this card.</p>
  </article>`;
  }

  const score = safeScore(report.dimensions[dimension]);

  return `<article class="item">
    <h3>${escapeHtml(dimensionLabels[dimension])}</h3>
    <p><strong>${score}/100</strong></p>
    <div class="bar" aria-hidden="true"><div class="fill" style="width: ${score}%"></div></div>
  </article>`;
}

function renderRepository(repository: RepoSignal): string {
  return `<article class="item">
    <h3>${escapeHtml(repository.owner)}/${escapeHtml(repository.name)}</h3>
    <p><strong>${safeScore(repository.overall)}/100</strong></p>
    <p class="muted">${repository.evidence.slice(0, 2).map((item) => escapeHtml(item.label)).join(" · ")}</p>
  </article>`;
}

function safeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
