const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const { getPackageJson, applyOverrides } = require("./metadata");
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

  const organizationSlug = core.getInput("organization") || metadata.name.split(".")[1];
  core.info(`Organization: ${organizationSlug}`);

  const file = await packFolder(folder);

  if (file.length > 512 * 1000 * 1000)
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

async function run() {
  try {
    const folder = core.getInput("package_folder");
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

module.exports = { run };

if (require.main === module) {
  run();
}
