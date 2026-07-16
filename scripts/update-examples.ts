import { resolve } from "node:path";
import {
  analyzeSignalGaps,
  renderRepositorySignalCard,
  renderSignalGapsCard,
  renderUserSignalCard,
  scoreRepository,
  scoreUserProfile,
  type ProfileInput
} from "../src/index.js";
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
    resolve("examples/assets/example-gaps-card.svg"),
    renderSignalGapsCard(gapsReport)
  ),
  writeTextFileAtomically(
    resolve("examples/assets/example-repo-card.svg"),
    renderRepositorySignalCard(scoreRepository(repository, options))
  )
]);

function parseFixtureDate(value: string | undefined): Date {
  const parsed = value === undefined ? new Date(Number.NaN) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Example fixture generatedAt must be a valid ISO date.");
  }
  return parsed;
}
