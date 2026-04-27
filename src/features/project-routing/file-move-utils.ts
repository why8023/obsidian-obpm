import {App, TFile, TFolder, normalizePath} from 'obsidian';

export function buildUniqueTargetPath(app: App, file: TFile, targetFolderPath: string): string {
	const initialPath = joinPath(targetFolderPath, file.name);
	if (initialPath === file.path || !app.vault.getAbstractFileByPath(initialPath)) {
		return initialPath;
	}

	for (let suffix = 1; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
		const candidateName = `${file.basename} ${suffix}.${file.extension}`;
		const candidatePath = joinPath(targetFolderPath, candidateName);
		if (candidatePath === file.path || !app.vault.getAbstractFileByPath(candidatePath)) {
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
		if (existingEntry instanceof TFolder) {
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
	const normalizedPath = normalizePath(path);
	const normalizedFolderPath = normalizePath(folderPath);
	return normalizedFolderPath.length === 0
		? normalizedPath.length > 0
		: normalizedPath.startsWith(`${normalizedFolderPath}/`);
}

export function joinPath(folderPath: string, childPath: string): string {
	return folderPath.length > 0 ? normalizePath(`${folderPath}/${childPath}`) : normalizePath(childPath);
}

function getParentFolderPath(path: string): string {
	const normalizedPath = normalizePath(path);
	const lastSlashIndex = normalizedPath.lastIndexOf('/');
	return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : '';
}
