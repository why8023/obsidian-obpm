import type {App, TAbstractFile, TFile, TFolder} from 'obsidian';

export interface ProjectTargetMovePlanFile {
	basename: string;
	extension: string;
	name: string;
	path: string;
}

export type ProjectTargetMovePlan =
	| {
		kind: 'already-in-target';
		targetFolderPath: string;
		targetPath: string;
	}
	| {
		kind: 'move';
		targetFolderPath: string;
		targetPath: string;
	};

export interface ProjectTargetMovePlanOptions {
	file: ProjectTargetMovePlanFile;
	pathExists: (path: string) => boolean;
	projectFolderPath: string;
	targetSubfolderPath: string;
}

export function buildUniqueTargetPath(app: App, file: TFile, targetFolderPath: string): string {
	return buildUniqueTargetPathFromFile(file, targetFolderPath, (path) =>
		Boolean(app.vault.getAbstractFileByPath(path)));
}

export function buildProjectTargetMovePlan(options: ProjectTargetMovePlanOptions): ProjectTargetMovePlan {
	const targetFolderPath = options.targetSubfolderPath.length > 0
		? joinPath(options.projectFolderPath, options.targetSubfolderPath)
		: normalizeVaultPath(options.projectFolderPath);
	const alreadyAcceptedFolderPath = options.targetSubfolderPath.length > 0
		? targetFolderPath
		: normalizeVaultPath(options.projectFolderPath);

	if (isPathInsideFolderPath(options.file.path, alreadyAcceptedFolderPath)) {
		return {
			kind: 'already-in-target',
			targetFolderPath,
			targetPath: normalizeVaultPath(options.file.path),
		};
	}

	return {
		kind: 'move',
		targetFolderPath,
		targetPath: buildUniqueTargetPathFromFile(options.file, targetFolderPath, options.pathExists),
	};
}

function buildUniqueTargetPathFromFile(
	file: ProjectTargetMovePlanFile,
	targetFolderPath: string,
	pathExists: (path: string) => boolean,
): string {
	const initialPath = joinPath(targetFolderPath, file.name);
	if (initialPath === file.path || !pathExists(initialPath)) {
		return initialPath;
	}

	for (let suffix = 1; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
		const candidateName = `${file.basename} ${suffix}.${file.extension}`;
		const candidatePath = joinPath(targetFolderPath, candidateName);
		if (candidatePath === file.path || !pathExists(candidatePath)) {
			return candidatePath;
		}
	}

	return initialPath;
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	if (!folderPath) {
		return;
	}

	const existingEntry = app.vault.getAbstractFileByPath(folderPath);
	if (existingEntry) {
		if (isFolderEntry(existingEntry)) {
			return;
		}

		throw new Error(`Cannot create folder because a file already exists at ${folderPath}.`);
	}

	const parentFolderPath = getParentFolderPath(folderPath);
	if (parentFolderPath && !app.vault.getAbstractFileByPath(parentFolderPath)) {
		await ensureFolderExists(app, parentFolderPath);
	}

	await app.vault.createFolder(folderPath);
}

export function isPathInsideFolderPath(path: string, folderPath: string): boolean {
	const normalizedPath = normalizeVaultPath(path);
	const normalizedFolderPath = normalizeVaultPath(folderPath);
	return normalizedFolderPath.length === 0
		? normalizedPath.length > 0
		: normalizedPath.startsWith(`${normalizedFolderPath}/`);
}

export function joinPath(folderPath: string, childPath: string): string {
	return folderPath.length > 0 ? normalizeVaultPath(`${folderPath}/${childPath}`) : normalizeVaultPath(childPath);
}

function getParentFolderPath(path: string): string {
	const normalizedPath = normalizeVaultPath(path);
	const lastSlashIndex = normalizedPath.lastIndexOf('/');
	return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : '';
}

function isFolderEntry(entry: TAbstractFile): entry is TFolder {
	return Array.isArray((entry as {children?: unknown}).children);
}

function normalizeVaultPath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== '.')
		.join('/');
}
