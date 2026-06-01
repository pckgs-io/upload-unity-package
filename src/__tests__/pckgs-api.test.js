const nock = require("nock");
const { startPublish, uploadToStorage, completePublish } = require("../pckgs-api");

const BASE_URL = "https://registry.pckgs.io";

afterEach(() => {
  nock.cleanAll();
});

describe("startPublish", () => {
  it("posts to /uploads and returns parsed response", async () => {
    const response = { id: "session-abc", url: "https://storage.example.com/upload" };
    nock(BASE_URL)
      .post("/uploads", { orgId: "myorg", isPublic: true, type: "UnityPackage" })
      .reply(200, response);

    const result = await startPublish("myorg", { isPublic: true }, "tok");
    expect(result).toEqual(response);
  });

  it("throws on non-2xx response", async () => {
    nock(BASE_URL).post("/uploads").reply(403, "Forbidden");
    await expect(startPublish("myorg", { isPublic: false }, "bad-tok")).rejects.toThrow("403");
  });
});

describe("uploadToStorage", () => {
  it("puts file buffer to the given URL", async () => {
    const storageUrl = "https://storage.example.com";
    nock(storageUrl).put("/upload").reply(200, "");

    const buf = Buffer.from("fake-tgz-content");
    await expect(uploadToStorage(`${storageUrl}/upload`, buf)).resolves.not.toThrow();
  });

  it("throws on non-2xx response", async () => {
    const storageUrl = "https://storage.example.com";
    nock(storageUrl).put("/upload").reply(500, "Internal Server Error");

    await expect(uploadToStorage(`${storageUrl}/upload`, Buffer.from("x"))).rejects.toThrow("500");
  });
});

describe("completePublish", () => {
  it("gets /uploads/:id/finalize and returns parsed response", async () => {
    const response = { status: "done" };
    nock(BASE_URL).get("/uploads/session-abc/finalize").reply(200, response);

    const result = await completePublish({ sessionId: "session-abc" }, "tok");
    expect(result).toEqual(response);
  });

  it("throws on non-2xx response", async () => {
    nock(BASE_URL).get("/uploads/session-abc/finalize").reply(404, "Not Found");
    await expect(completePublish({ sessionId: "session-abc" }, "tok")).rejects.toThrow("404");
  });
});

describe("sendHttpRequest (via startPublish)", () => {
  it("returns raw string when response is not valid JSON", async () => {
    nock(BASE_URL).post("/uploads").reply(200, "plain text response");
    const result = await startPublish("myorg", { isPublic: false }, "tok");
    expect(result).toBe("plain text response");
  });
});
