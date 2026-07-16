import {
  buildmarksVersion,
  scoreUserProfile,
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
