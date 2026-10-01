import {
  buildmarksVersion,
  scoreUserProfile,
  renderUserSignalCard,
  scoringMethodologyVersion,
  type ProfileInput,
  type UserSignalReportV2
} from "../../dist/index.js";

const profile: ProfileInput = {
  username: "package-consumer",
  repositories: []
};

const report: UserSignalReportV2 = scoreUserProfile(profile);
console.log(buildmarksVersion, scoringMethodologyVersion, report.evidenceStatus);
renderUserSignalCard(report, { layout: "compact", theme: "dark" });
renderUserSignalCard(report, { layout: "detailed" });
