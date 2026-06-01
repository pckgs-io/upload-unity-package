const path = require("path");
const fs = require("fs");

jest.mock("@actions/core", () => ({
  getInput: jest.fn().mockReturnValue(""),
  info: jest.fn(),
  setFailed: jest.fn(),
}));

jest.mock("../pckgs-api", () => ({
  startPublish: jest.fn(),
  uploadToStorage: jest.fn(),
  completePublish: jest.fn(),
}));

jest.mock("../packer", () => ({
  packFolder: jest.fn(),
}));

const core = require("@actions/core");
const {
  startPublish,
  uploadToStorage,
  completePublish,
} = require("../pckgs-api");
const { packFolder } = require("../packer");
const { uploadArchive } = require("../index");
const { MAX_PACKAGE_SIZE } = require("../constants");
const { makeTmpDir, writePkgJson, cleanDir } = require("./helpers");

describe("uploadArchive", () => {
  let tmpDir;
  const metadata = { name: "com.myorg.pkg", version: "1.0.0" };
  const accessToken = "test-token";

  beforeEach(() => {
    tmpDir = makeTmpDir();
    writePkgJson(tmpDir);
    startPublish.mockResolvedValue({
      id: "session-123",
      url: "https://storage.example.com/upload",
    });
    uploadToStorage.mockResolvedValue({});
    completePublish.mockResolvedValue({});
    packFolder.mockResolvedValue(Buffer.alloc(100));
  });

  afterEach(() => {
    cleanDir(tmpDir);
    jest.clearAllMocks();
  });

  it("writes updated package.json to folder when isMetadataUpdated is true", async () => {
    const updated = { ...metadata, version: "2.0.0" };
    await uploadArchive(tmpDir, accessToken, false, updated, true);
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "package.json"), "utf-8"),
    );
    expect(written.version).toBe("2.0.0");
  });

  it("does not write package.json when isMetadataUpdated is false", async () => {
    writePkgJson(tmpDir, { version: "1.0.0" });
    await uploadArchive(
      tmpDir,
      accessToken,
      false,
      { ...metadata, version: "2.0.0" },
      false,
    );
    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "package.json"), "utf-8"),
    );
    expect(written.version).toBe("1.0.0");
  });

  it("throws when packed file exceeds max package size", async () => {
    packFolder.mockResolvedValue(Buffer.alloc(MAX_PACKAGE_SIZE + 1));
    await expect(
      uploadArchive(tmpDir, accessToken, false, metadata, false),
    ).rejects.toThrow("exceeds the maximum allowed size");
  });
});
