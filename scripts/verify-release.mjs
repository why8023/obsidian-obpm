import { readFileSync } from "node:fs";

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const tagName = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME ?? packageJson.version;

if (!/^\d+\.\d+\.\d+$/.test(tagName)) {
	throw new Error(`Release tag must be a semantic version without a leading "v". Received: ${tagName}`);
}

if (packageJson.version !== manifest.version) {
	throw new Error(`package.json version (${packageJson.version}) does not match manifest.json version (${manifest.version}).`);
}

if (manifest.version !== tagName) {
	throw new Error(`manifest.json version (${manifest.version}) does not match release tag (${tagName}).`);
}

if (versions[tagName] !== manifest.minAppVersion) {
	throw new Error(
		`versions.json entry for ${tagName} must equal manifest minAppVersion (${manifest.minAppVersion}).`,
	);
}

console.log(`Release metadata verified for ${tagName}.`);
