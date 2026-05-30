const https = require("https");
const { URL } = require("url");

const BASE_URL = "https://registry.pckgs.io";

async function sendHttpRequest({
  url,
  method = "POST",
  body,
  headers = {},
  accessToken,
}) {
  const parsedUrl = new URL(url);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`Request failed: ${res.statusCode} ${data}`));
          }
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function startPublish(organizationSlug, { isPublic }, accessToken) {
  return sendHttpRequest({
    url: `${BASE_URL}/uploads`,
    method: "POST",
    body: JSON.stringify({
      orgId: organizationSlug,
      isPublic,
      type: "UnityPackage",
    }),
    accessToken,
    headers: { "Content-Type": "application/json" },
  });
}

async function uploadToStorage(url, fileBuffer) {
  return sendHttpRequest({
    url,
    method: "PUT",
    body: fileBuffer,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": fileBuffer.length,
    },
  });
}

async function completePublish({ sessionId }, accessToken) {
  return sendHttpRequest({
    url: `${BASE_URL}/uploads/${sessionId}/finalize`,
    method: "GET",
    accessToken,
  });
}

module.exports = { startPublish, uploadToStorage, completePublish };
