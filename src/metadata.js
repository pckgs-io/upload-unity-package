const core = require("@actions/core");
const fs = require("fs");
const path = require("path");

function getPackageJson(folder) {
  const packageJsonPath = path.join(folder, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`'package.json' not found in '${folder}'.`);
  }
  const content = fs.readFileSync(packageJsonPath, "utf-8");
  const json = JSON.parse(content);
  if (!json.name || typeof json.name !== "string" || json.name.trim() === "") {
    throw new Error(`'name' field in package.json is missing or invalid.`);
  }
  if (
    !json.version ||
    typeof json.version !== "string" ||
    json.version.trim() === ""
  ) {
    throw new Error(`'version' field in package.json is missing or invalid.`);
  }
  return json;
}

function applyOverrides(
  metadata,
  { version, contributorEmail, contributorName, contributorUrl },
) {
  let isUpdated = false;

  if (version) {
    metadata.version = version;
    isUpdated = true;
    core.info(`Package version is set to ${metadata.version}`);
  }
  if (contributorEmail) {
    metadata.author = metadata.author || {};
    metadata.author.email = contributorEmail;
    isUpdated = true;
    core.info(`Package author email is set to ${metadata.author.email}`);
  }
  if (contributorName) {
    metadata.author = metadata.author || {};
    metadata.author.name = contributorName;
    isUpdated = true;
    core.info(`Package author name is set to ${metadata.author.name}`);
  }
  if (contributorUrl) {
    metadata.author = metadata.author || {};
    metadata.author.url = contributorUrl;
    isUpdated = true;
    core.info(`Package author url is set to ${metadata.author.url}`);
  }

  return { metadata, isUpdated };
}

module.exports = { getPackageJson, applyOverrides };
