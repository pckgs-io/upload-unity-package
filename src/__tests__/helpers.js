const path = require("path");
const fs = require("fs");
const os = require("os");
const tar = require("tar");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pckgs-test-"));
}

function writePkgJson(dir, fields = {}) {
  const defaults = { name: "com.test.pkg", version: "1.0.0" };
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ ...defaults, ...fields }),
  );
}

function cleanDir(dir) {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}

async function listTarEntries(buffer) {
  const tmpFile = path.join(os.tmpdir(), `pckgs-list-${Date.now()}.tgz`);
  fs.writeFileSync(tmpFile, buffer);
  const entries = [];
  await tar.list({ file: tmpFile, onentry: (e) => entries.push(e.path) });
  fs.unlinkSync(tmpFile);
  return entries;
}

module.exports = { makeTmpDir, writePkgJson, cleanDir, listTarEntries };
