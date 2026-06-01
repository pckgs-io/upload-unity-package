const fs = require("fs");
const path = require("path");
const packlist = require("npm-packlist");
const tar = require("tar");

async function packFolder(folderPath) {
  const resolvedPath = path.resolve(folderPath);
  if (!fs.existsSync(resolvedPath) || !fs.lstatSync(resolvedPath).isDirectory()) {
    throw new Error(`package_folder '${folderPath}' not found or is not a directory.`);
  }
  const files = await packlist({ path: resolvedPath });
  const chunks = [];
  const stream = tar.create(
    { gzip: true, cwd: resolvedPath, prefix: "package/", portable: true },
    files,
  );
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = { packFolder };
