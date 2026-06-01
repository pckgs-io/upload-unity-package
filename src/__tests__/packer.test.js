const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
const { packFolder } = require("../packer");
const { makeTmpDir, writePkgJson, cleanDir, listTarEntries } = require("./helpers");

describe("packFolder", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    writePkgJson(tmpDir);
    fs.writeFileSync(path.join(tmpDir, "Script.cs"), "// test");
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("packs files from a valid absolute path", async () => {
    const result = await packFolder(tmpDir);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("packs files from a valid relative path", async () => {
    const rel = path.relative(process.cwd(), tmpDir);
    const result = await packFolder(rel);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("throws when path does not exist", async () => {
    await expect(packFolder("/nonexistent/path/xyz")).rejects.toThrow(
      "not found or is not a directory",
    );
  });

  it("throws when path points to a file", async () => {
    const file = path.join(tmpDir, "package.json");
    await expect(packFolder(file)).rejects.toThrow(
      "not found or is not a directory",
    );
  });
});

describe("packFolder — npm install compatibility", () => {
  jest.setTimeout(30000);

  let srcDir;
  let consumerDir;
  let tgzPath;

  beforeEach(() => {
    srcDir = makeTmpDir();
    consumerDir = makeTmpDir();
    tgzPath = path.join(os.tmpdir(), `pckgs-test-${Date.now()}.tgz`);

    writePkgJson(srcDir, { name: "com.test.installable", version: "1.0.0" });
    fs.writeFileSync(path.join(srcDir, "Script.cs"), "// hello");
    fs.writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify({ name: "consumer", version: "1.0.0" }),
    );
  });

  afterEach(() => {
    cleanDir(srcDir);
    cleanDir(consumerDir);
    if (fs.existsSync(tgzPath)) fs.unlinkSync(tgzPath);
  });

  it("produces a tgz that npm can install with matching file contents", async () => {
    const buffer = await packFolder(srcDir);
    fs.writeFileSync(tgzPath, buffer);

    execSync(`npm install ${tgzPath} --no-save`, { cwd: consumerDir, stdio: "pipe" });

    const installedDir = path.join(consumerDir, "node_modules", "com.test.installable");
    expect(fs.existsSync(installedDir)).toBe(true);

    const srcFiles = fs.readdirSync(srcDir).sort();
    const installedFiles = fs.readdirSync(installedDir).sort();
    expect(installedFiles).toEqual(srcFiles);

    for (const file of srcFiles) {
      const srcContent = fs.readFileSync(path.join(srcDir, file), "utf-8");
      const installedContent = fs.readFileSync(path.join(installedDir, file), "utf-8");
      expect(installedContent).toBe(srcContent);
    }
  });
});

describe("packFolder — file filtering", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    writePkgJson(tmpDir);
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("excludes files listed in .npmignore", async () => {
    fs.writeFileSync(path.join(tmpDir, "Script.cs"), "// keep");
    fs.writeFileSync(path.join(tmpDir, "internal.txt"), "ignore me");
    fs.writeFileSync(path.join(tmpDir, ".npmignore"), "internal.txt");

    const entries = await listTarEntries(await packFolder(tmpDir));

    expect(entries).toContain("package/Script.cs");
    expect(entries).not.toContain("package/internal.txt");
  });

  it("excludes .git folder when .npmignore is absent", async () => {
    fs.writeFileSync(path.join(tmpDir, "Script.cs"), "// keep");
    fs.mkdirSync(path.join(tmpDir, ".git"));
    fs.writeFileSync(path.join(tmpDir, ".git", "HEAD"), "ref: refs/heads/main");

    const entries = await listTarEntries(await packFolder(tmpDir));

    expect(entries).toContain("package/Script.cs");
    expect(entries.some((e) => e.startsWith("package/.git"))).toBe(false);
  });

  it("excludes node_modules", async () => {
    fs.mkdirSync(path.join(tmpDir, "node_modules", "somelib"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "node_modules", "somelib", "index.js"), "");

    const entries = await listTarEntries(await packFolder(tmpDir));

    expect(entries.some((e) => e.includes("node_modules"))).toBe(false);
  });

  it("includes only files listed in package.json files field", async () => {
    writePkgJson(tmpDir, { files: ["Script.cs"] });
    fs.writeFileSync(path.join(tmpDir, "Script.cs"), "// included");
    fs.writeFileSync(path.join(tmpDir, "other.txt"), "excluded");

    const entries = await listTarEntries(await packFolder(tmpDir));

    expect(entries).toContain("package/Script.cs");
    expect(entries).not.toContain("package/other.txt");
  });

  it("uses .gitignore rules as fallback when .npmignore is absent", async () => {
    fs.writeFileSync(path.join(tmpDir, "Script.cs"), "// keep");
    fs.writeFileSync(path.join(tmpDir, "build.log"), "exclude me");
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "build.log");

    const entries = await listTarEntries(await packFolder(tmpDir));

    expect(entries).toContain("package/Script.cs");
    expect(entries).not.toContain("package/build.log");
  });

  it("all entries have package/ prefix", async () => {
    fs.writeFileSync(path.join(tmpDir, "Script.cs"), "// test");

    const entries = await listTarEntries(await packFolder(tmpDir));

    expect(entries.every((e) => e.startsWith("package/"))).toBe(true);
  });
});
