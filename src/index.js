const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const { getPackageJson, applyOverrides } = require("./metadata");
const { MAX_PACKAGE_SIZE } = require("./constants");
const { packFolder } = require("./packer");
const {
  startPublish,
  uploadToStorage,
  completePublish,
} = require("./pckgs-api");

async function uploadArchive(
  folder,
  accessToken,
  isPublic,
  metadata,
  isMetadataUpdated,
) {
  if (isMetadataUpdated) {
    fs.writeFileSync(
      path.join(folder, "package.json"),
      JSON.stringify(metadata, null, 2),
      "utf-8",
    );
  }

  const organizationSlug = resolveOrganization(core.getInput("organization"), metadata.name);
  core.info(`Organization: ${organizationSlug}`);

  const file = await packFolder(folder);

  if (file.length > MAX_PACKAGE_SIZE)
    throw new Error(
      "The uploaded package exceeds the maximum allowed size of 512 MB.",
    );

  const uploadSession = await startPublish(
    organizationSlug,
    { isPublic },
    accessToken,
  );
  core.info(`Upload session: ${uploadSession.id}`);

  await uploadToStorage(uploadSession.url, file);
  await completePublish({ sessionId: uploadSession.id }, accessToken);
}

function resolveOrganization(input, packageName) {
  const slug = input || packageName.split(".")[1];
  if (!slug) {
    throw new Error(
      "Organization could not be determined. Provide the 'organization' input or ensure the package name follows 'com.<org>.<name>' format.",
    );
  }
  return slug;
}

function resolveFolder(input) {
  let folder = input || process.env.GITHUB_WORKSPACE || process.cwd();
  if (fs.existsSync(folder) && fs.lstatSync(folder).isFile() && path.basename(folder) === "package.json") {
    folder = path.dirname(folder);
  }
  return folder;
}

async function run() {
  try {
    const folder = resolveFolder(core.getInput("package_folder"));
    const accessToken = core.getInput("access_token");
    const isPublic = core.getBooleanInput
      ? core.getBooleanInput("is_public")
      : core.getInput("is_public") === "true";

    const metadata = await getPackageJson(folder);
    const { metadata: updatedMetadata, isUpdated } = applyOverrides(metadata, {
      version: core.getInput("version"),
      contributorEmail: core.getInput("contributor_email"),
      contributorName: core.getInput("contributor_name"),
      contributorUrl: core.getInput("contributor_url"),
    });

    await uploadArchive(
      folder,
      accessToken,
      isPublic,
      updatedMetadata,
      isUpdated,
    );
    core.info(`Upload successful! isPublic: ${isPublic}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = { run, uploadArchive, resolveFolder, resolveOrganization };

if (require.main === module) {
  run();
}
