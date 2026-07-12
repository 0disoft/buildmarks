import { buildmarksVersion, scoreUserProfile, type ProfileInput } from "../../dist/index.js";

const profile: ProfileInput = {
  username: "package-consumer",
  repositories: []
};

const report = scoreUserProfile(profile);
console.log(buildmarksVersion, report.evidenceStatus);
