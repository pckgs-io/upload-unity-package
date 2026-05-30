require("dotenv").config({ path: ".env.test" });

const { randomUUID } = require("crypto");

const path = require("path");
const fs = require("fs");
const os = require("os");
const core = require("@actions/core");
const { run } = require("../index");

const INPUT_KEYS = [
  "INPUT_PACKAGE_FOLDER",
  "INPUT_ACCESS_TOKEN",
  "INPUT_IS_PUBLIC",
  "INPUT_ORGANIZATION",
  "INPUT_VERSION",
  "INPUT_CONTRIBUTOR_EMAIL",
  "INPUT_CONTRIBUTOR_NAME",
  "INPUT_CONTRIBUTOR_URL",
];

jest.setTimeout(30000);

describe("upload action (real API)", () => {
  let tmpDir;

  beforeEach(() => {
    if (process.env.INPUT_PACKAGE_FOLDER) {
      tmpDir = null;
    } else {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pckgs-test-"));
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify(
          {
            name: `com.${process.env.INPUT_ORGANIZATION || "testorg"}.integration-test-${randomUUID()}`,
            version: "0.0.1",
            description: "Integration test package",
            unity: "2022.3",
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(path.join(tmpDir, "TestScript.cs"), "// test");
      process.env.INPUT_PACKAGE_FOLDER = tmpDir;
    }

    process.env.INPUT_IS_PUBLIC = process.env.INPUT_IS_PUBLIC || "false";
  });

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    INPUT_KEYS.forEach((k) => delete process.env[k]);
    delete process.exitCode;
  });

  it("uploads a package to pckgs.io", async () => {
    const setFailed = jest.spyOn(core, "setFailed");

    await run();

    expect(setFailed).not.toHaveBeenCalled();
  });
});
