const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { FormData, File } = require('formdata-node');
const { FormDataEncoder } = require('form-data-encoder');
const fsp = require('fs/promises');
const compressing = require('compressing');

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
    const virtualRoot = path.join(tmpDir, 'package');

    // Create temporary virtual root: .tmp-timestamp/package/
    await fsp.mkdir(virtualRoot, { recursive: true });

    // Copy all contents into the virtual root
    const items = await fsp.readdir(folderPath);
    await Promise.all(items.map(async item => {
        const src = path.join(folderPath, item);
        const dest = path.join(virtualRoot, item);
        await fsp.cp(src, dest, { recursive: true });
    }));

    // Compress the virtual root (which includes the top-level package/)
    await compressing.tar.compressDir(path.join(tmpDir, packageDirName), archiveName);

    // Clean up
    await fsp.rm(tmpDir, { recursive: true, force: true });

    return fs.readFileSync(path.join(process.cwd(), archiveName));
}

async function uploadArchive(file, accessToken, isPublic, metadata, archiveName) {
    const form = new FormData();
    form.set('isPublic', String(isPublic));
    form.set('metadata', JSON.stringify(metadata));
    form.append('packageFile', new File([file], archiveName, { type: 'application/gzip' }));

    const encoder = new FormDataEncoder(form);

    const options = {
        method: 'POST',
        hostname: 'registry.pckgs.io',
        path: '/packages',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            ...encoder.headers
        }
    };

    await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed: ${res.statusCode} ${data}`));
                }
            });
        });
        req.on('error', reject);
        (async () => {
            try {
                for await (const chunk of encoder.encode()) {
                    req.write(chunk);
                }
                req.end();
            } catch (err) {
                reject(err);
            }
        })();
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
        await uploadArchive(file, accessToken, isPublic, metadata, archiveName);

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