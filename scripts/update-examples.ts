import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  analyzeSignalGaps,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard,
  scoreRepository,
  scoreUserProfile,
  type ProfileInput,
  type SignalDimension,
  type SignalType,
  type UserSignalReport
} from "../src/index.js";
import { classifySignalType } from "../src/scoring/signal-type.js";
import { writeTextFileAtomically } from "../src/cli/write-output.js";

const fixturePath = resolve("fixtures/example-public-profile.json");
const profile = JSON.parse(await Bun.file(fixturePath).text()) as ProfileInput;
const now = parseFixtureDate(profile.generatedAt);
const options = { now };
const profileReport = scoreUserProfile(profile, options);
const gapsReport = analyzeSignalGaps(profile, options);
const repository = profile.repositories.find((candidate) => candidate.name === "usable-toolkit");

if (repository === undefined) {
  throw new Error("Example fixture must include usable-toolkit.");
}

await Promise.all([
  writeTextFileAtomically(
    resolve("examples/assets/example-card.svg"),
    renderUserSignalCard(profileReport)
  ),
  writeTextFileAtomically(
    resolve("examples/assets/example-detailed-card.svg"),
    renderUserSignalCard(profileReport, { layout: "detailed" })
  ),
  writeTextFileAtomically(
    resolve("examples/assets/example-gaps-card.svg"),
    renderSignalGapsCard(gapsReport)
  ),
  writeTextFileAtomically(
    resolve("examples/assets/example-repo-card.svg"),
    renderRepositorySignalCard(scoreRepository(repository, options))
  )
]);

const typeExamples: { file: string; type: SignalType; dimensions: Record<SignalDimension, number> }[] = [
  { file: "built-to-last", type: "Maintainer-Builder", dimensions: { maintainability: 88, completeness: 79, usability: 72, shipping: 81, consistency: 70, stewardship: 82 } },
  { file: "ready-to-use", type: "Productized Builder", dimensions: { maintainability: 67, completeness: 71, usability: 89, shipping: 76, consistency: 66, stewardship: 60 } },
  { file: "well-rounded", type: "Builder", dimensions: { maintainability: 72, completeness: 88, usability: 68, shipping: 78, consistency: 71, stewardship: 65 } },
  { file: "ships-steadily", type: "Steady Shipper", dimensions: { maintainability: 64, completeness: 69, usability: 67, shipping: 84, consistency: 92, stewardship: 61 } },
  { file: "easy-to-pick-up", type: "Well-Documented Project", dimensions: { maintainability: 63, completeness: 68, usability: 92, shipping: 48, consistency: 61, stewardship: 55 } },
  { file: "project-snapshot", type: "General Signal Profile", dimensions: { maintainability: 62, completeness: 64, usability: 66, shipping: 59, consistency: 63, stewardship: 54 } }
];

await mkdir(resolve("examples/assets/types"), { recursive: true });
for (const example of typeExamples) {
  const signalType = classifySignalType(example.dimensions);
  if (signalType !== example.type) throw new Error(`Example ${example.file} no longer matches its type.`);
  const report: UserSignalReport = {
    username: "Sample data · example-builder",
    generatedAt: now.toISOString(),
    signalType,
    dimensions: example.dimensions,
    overall: Math.round(Object.values(example.dimensions).reduce((total, value) => total + value, 0) / 6),
    topRepos: profileReport.topRepos.map((repository, index) => ({ ...repository, owner: "example", name: index === 0 ? "sample-toolkit" : "sample-project" })),
    evidence: [],
    limitations: ["Design example with invented scores; not a real project assessment."]
  };
  await writeTextFileAtomically(
    resolve(`examples/assets/types/${example.file}.svg`),
    renderUserSignalCard(report, { theme: "auto" })
  );
}

function parseFixtureDate(value: string | undefined): Date {
  const parsed = value === undefined ? new Date(Number.NaN) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Example fixture generatedAt must be a valid ISO date.");
  }
  return parsed;
}
