const path = require("path");
const { getPackageJson, applyOverrides } = require("../metadata");
const { makeTmpDir, writePkgJson, cleanDir } = require("./helpers");

describe("getPackageJson", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("reads package.json from a valid folder", () => {
    writePkgJson(tmpDir, { name: "com.test.pkg", version: "1.2.3" });
    const result = getPackageJson(tmpDir);
    expect(result.name).toBe("com.test.pkg");
    expect(result.version).toBe("1.2.3");
  });

  it("throws when package.json is missing from the folder", () => {
    expect(() => getPackageJson(tmpDir)).toThrow("not found");
  });

  it("throws when folder does not exist", () => {
    expect(() => getPackageJson("/nonexistent/path/xyz")).toThrow("not found");
  });

  it("throws when name field is missing", () => {
    writePkgJson(tmpDir, { name: undefined });
    expect(() => getPackageJson(tmpDir)).toThrow("'name' field");
  });

  it("throws when version field is missing", () => {
    writePkgJson(tmpDir, { version: undefined });
    expect(() => getPackageJson(tmpDir)).toThrow("'version' field");
  });
});

describe("applyOverrides", () => {
  let metadata;

  beforeEach(() => {
    metadata = { name: "com.test.pkg", version: "1.0.0" };
  });

  it("returns isUpdated false when no overrides are provided", () => {
    const { isUpdated } = applyOverrides(metadata, {});
    expect(isUpdated).toBe(false);
  });

  it("overrides version", () => {
    const { metadata: out, isUpdated } = applyOverrides(metadata, { version: "2.0.0" });
    expect(out.version).toBe("2.0.0");
    expect(isUpdated).toBe(true);
  });

  it("overrides contributorEmail", () => {
    const { metadata: out, isUpdated } = applyOverrides(metadata, { contributorEmail: "a@b.com" });
    expect(out.author.email).toBe("a@b.com");
    expect(isUpdated).toBe(true);
  });

  it("overrides contributorName", () => {
    const { metadata: out, isUpdated } = applyOverrides(metadata, { contributorName: "Alice" });
    expect(out.author.name).toBe("Alice");
    expect(isUpdated).toBe(true);
  });

  it("overrides contributorUrl", () => {
    const { metadata: out, isUpdated } = applyOverrides(metadata, { contributorUrl: "https://example.com" });
    expect(out.author.url).toBe("https://example.com");
    expect(isUpdated).toBe(true);
  });

  it("initializes author object when it does not exist", () => {
    const { metadata: out } = applyOverrides(metadata, { contributorName: "Bob" });
    expect(out.author).toEqual({ name: "Bob" });
  });

  it("preserves existing author fields when adding a new one", () => {
    metadata.author = { name: "Alice" };
    const { metadata: out } = applyOverrides(metadata, { contributorEmail: "alice@example.com" });
    expect(out.author.name).toBe("Alice");
    expect(out.author.email).toBe("alice@example.com");
  });
});
