const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { FormData, File } = require('formdata-node');
const { FormDataEncoder } = require('form-data-encoder');
const fsp = require('fs/promises');
const compressing = require('compressing');
const crypto = require('crypto');

async function getPackageJson(folder) {
    // Try to read from the given folder first (relative to repo root)
    let packageJsonPath = path.join(folder, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        // Fallback: try to read from repo root
        packageJsonPath = path.join('package.json');
        if (!fs.existsSync(packageJsonPath)) {
            throw new Error(`'package.json' not found in folder '${folder}' or repository root.`);
        }
    }
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const json = JSON.parse(content);
    if (!json.name || typeof json.name !== 'string' || json.name.trim() === '') {
        throw new Error(`'name' field in package.json is missing or invalid.`);
    }
    if (!json.version || typeof json.version !== 'string' || json.version.trim() === '') {
        throw new Error(`'version' field in package.json is missing or invalid.`);
    }
    return json;
}

async function compressFolder(folder, archiveName) {
    // Try to resolve the folder like getPackageJson
    let folderPath = path.join(folder);
    if (!fs.existsSync(folderPath) || !fs.lstatSync(folderPath).isDirectory()) {
        folderPath = path.join(process.cwd()); // fallback to repo root
        if (!fs.existsSync(folderPath) || !fs.lstatSync(folderPath).isDirectory()) {
            throw new Error(`Target folder '${folder}' not found.`);
        }
    }

    const tmpDir = path.join(process.cwd(), `.tmp-${Date.now()}`);
    const packageDirName = 'package';
    const virtualRoot = path.join(tmpDir, packageDirName);
    try {
        await fsp.mkdir(virtualRoot, { recursive: true });

        // Copy all contents into the virtual root
        const items = await fsp.readdir(folderPath);
        await Promise.all(items.map(async item => {
            const src = path.join(folderPath, item);
            const dest = path.join(virtualRoot, item);
            await fsp.cp(src, dest, { recursive: true });
        }));

        const archiveDir = path.join(tmpDir, archiveName);
        // Compress the virtual root (which includes the top-level package/)
        await compressing.tgz.compressDir(virtualRoot, archiveDir);

        return fs.readFileSync(archiveDir);
    } finally {
        await fsp.rm(tmpDir, { recursive: true, force: true });
    }
} async function sendHttpRequest({ url, method = 'POST', body, headers = {}, accessToken }) {
    const https = require('https');
    const { URL } = require('url');
    const parsedUrl = new URL(url);

    return new Promise((resolve, reject) => {
        const req = https.request({
            method,
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
                ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                ...headers
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
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
        });
        req.on('error', reject);

        if (body) {
            req.write(body);
        }
        req.end();
    });
}
async function uploadArchive(folder, file, accessToken, isPublic, metadata, archiveName) {

    if (file.length > 512 * 1024 * 1024)
        throw new Error("The uploaded package exceeds the maximum allowed size of 512 MB.");

    const readmePath = path.join(folder, 'README.md');
    const licensePath = path.join(folder, 'LICENSE.md');
    const changelogPath = path.join(folder, 'CHANGELOG.md');

    const readmeBytes = fs.existsSync(readmePath) ? fs.readFileSync(readmePath) : null;
    const licenseBytes = fs.existsSync(licensePath) ? fs.readFileSync(licensePath) : null;
    const changelogBytes = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath) : null;

    const checksumSha256 = crypto.createHash('sha256').update(file).digest('base64');
    core.info(`SHA256 checksum: ${checksumSha256}`);

    //Start Publish
    const startPublishForm = new FormData();
    startPublishForm.set("checksumSha256", checksumSha256);
    startPublishForm.set("packageSize", file.length);
    startPublishForm.set("metadata", JSON.stringify(metadata));
    startPublishForm.set("isPublic", String(isPublic));

    const startPublishFormEncoder = new FormDataEncoder(startPublishForm);
    const startPublishChunks = [];
    for await (const chunk of startPublishFormEncoder.encode()) {
        startPublishChunks.push(chunk);
    }
    const uploadSession = await sendHttpRequest({
        url: 'https://registry.pckgs.io/packages/start-publish',
        method: 'POST',
        body: Buffer.concat(startPublishChunks),
        accessToken,
        headers: startPublishFormEncoder.headers
    });

    core.info(`Upload session: ${uploadSession.sessionId}`);

    await sendHttpRequest({
        url: uploadSession.url,
        method: 'PUT',
        body: file,
        headers: {
            'Content-Type': 'application/gzip',
            'Content-Length': file.length
        }
    });

    const completePublishForm = new FormData();
    completePublishForm.set('sessionId', uploadSession.sessionId);
    if (readmeBytes)
        completePublishForm.set('readme', new File([readmeBytes], "README.md", { type: 'text/markdown' }));
    if (licenseBytes)
        completePublishForm.set('license', new File([licenseBytes], "LICENSE.md", { type: 'text/markdown' }));
    if (changelogBytes)
        completePublishForm.set('changelog', new File([changelogBytes], "CHANGELOG.md", { type: 'text/markdown' }));

    const completePublishFormEncoder = new FormDataEncoder(completePublishForm);
    const completePublishChunks = [];
    for await (const chunk of completePublishFormEncoder.encode()) {
        completePublishChunks.push(chunk);
    }

    core.info(`Completing upload`);

    await sendHttpRequest({
        url: 'https://registry.pckgs.io/packages/complete-publish',
        method: 'POST',
        body: Buffer.concat(completePublishChunks),
        accessToken,
        headers: completePublishFormEncoder.headers
    });
}

async function run() {
    let metadata;
    try {
        const folder = core.getInput('package_folder');
        const accessToken = core.getInput('access_token');
        const isPublic = core.getBooleanInput ? core.getBooleanInput('is_public') : core.getInput('is_public') === 'true';
        const version = core.getInput('version');
        const contributorEmail = core.getInput('contributor_email');
        const contributorName = core.getInput('contributor_name');
        const contributorUrl = core.getInput('contributor_url');

        metadata = await getPackageJson(folder);
        if (version) {
            metadata.version = version;
            core.info(`Package version is set to ${metadata.version}`);
        }
        if (contributorEmail) {
            metadata.author = metadata.author || {};
            metadata.author.email = contributorEmail;
            core.info(`Package author email is set to ${metadata.author.email}`);
        }
        if (contributorName) {
            metadata.author = metadata.author || {};
            metadata.author.name = contributorName;
            core.info(`Package author name is set to ${metadata.author.name}`);
        }
        if (contributorUrl) {
            metadata.author = metadata.author || {};
            metadata.author.url = contributorUrl;
            core.info(`Package author email is set to ${metadata.author.url}`);
        }

        const archiveName = `${metadata.name}@${metadata.version}.tar.gz`;
        const file = await compressFolder(folder, archiveName);
        await uploadArchive(folder, file, accessToken, isPublic, metadata, archiveName);

        core.info(`Upload successful! isPublic: ${isPublic}`);
    } catch (error) {
        core.setFailed(error.message);
    } finally {
        // Clean up the archive file if it exists
        if (typeof metadata !== 'undefined' && metadata.name && metadata.version) {
            const archivePath = path.join(process.cwd(), `${metadata.name}@${metadata.version}.tar.gz`);
            if (fs.existsSync(archivePath)) {
                try {
                    fs.unlinkSync(archivePath);
                    core.info(`${metadata.name}@${metadata.version}.tar.gz cleaned up.`);
                } catch (cleanupError) {
                    core.warning('Failed to clean up archive: ' + cleanupError.message);
                }
            }
        }
    }
}

run();