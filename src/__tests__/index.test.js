const path = require("path");
const fs = require("fs");
const { resolveFolder, resolveOrganization } = require("../index");
const { makeTmpDir, cleanDir } = require("./helpers");

describe("resolveFolder", () => {
  let tmpDir;
  const originalGithubWorkspace = process.env.GITHUB_WORKSPACE;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    delete process.env.GITHUB_WORKSPACE;
  });

  afterEach(() => {
    cleanDir(tmpDir);
    if (originalGithubWorkspace !== undefined) {
      process.env.GITHUB_WORKSPACE = originalGithubWorkspace;
    } else {
      delete process.env.GITHUB_WORKSPACE;
    }
  });

  it("returns the given folder path unchanged", () => {
    expect(resolveFolder(tmpDir)).toBe(tmpDir);
  });

  it("resolves a package.json file path to its parent directory", () => {
    const pkgFile = path.join(tmpDir, "package.json");
    fs.writeFileSync(pkgFile, "{}");
    expect(resolveFolder(pkgFile)).toBe(tmpDir);
  });

  it("falls back to process.cwd() when input is empty string", () => {
    expect(resolveFolder("")).toBe(process.cwd());
  });

  it("falls back to GITHUB_WORKSPACE when input is empty and env is set", () => {
    process.env.GITHUB_WORKSPACE = tmpDir;
    expect(resolveFolder("")).toBe(tmpDir);
  });
});

describe("resolveOrganization", () => {
  it("uses the provided organization input", () => {
    expect(resolveOrganization("myorg", "com.other.pkg")).toBe("myorg");
  });

  it("extracts org from second segment of package name when input is empty", () => {
    expect(resolveOrganization("", "com.myorg.pkg")).toBe("myorg");
  });

  it("throws when input is empty and name has no second segment", () => {
    expect(() => resolveOrganization("", "mypkg")).toThrow(
      "Organization could not be determined",
    );
  });

  it("throws when input is empty and name has only one segment with a dot", () => {
    expect(() => resolveOrganization("", "com")).toThrow(
      "Organization could not be determined",
    );
  });
});
