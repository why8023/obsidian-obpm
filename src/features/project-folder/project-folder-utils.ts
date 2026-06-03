export interface DirectProjectFileLike {
	basename: string;
	extension: string;
	parentName: string;
	parentPath: string;
	path: string;
}

export interface ProjectFolderLike {
	name: string;
	path: string;
}

export interface BuildProjectFileOpenTargetOptions {
	folder: ProjectFolderLike;
	pathExists: (path: string) => boolean;
}

export interface BuildProjectFolderRenameSyncPlanOptions {
	newFolderPath: string;
	oldFolderPath: string;
	pathExists: (path: string) => boolean;
}

export interface BuildProjectFolderChildRenameSyncPlanOptions {
	newFilePath: string;
	newFolderPath: string;
	oldFilePath: string;
	oldFolderPath: string;
	pathExists: (path: string) => boolean;
}

export interface BuildProjectFileRenameSyncPlanOptions {
	newFileBasename: string;
	newFileExtension: string;
	newFileParentPath: string;
	oldFilePath: string;
	pathExists: (path: string) => boolean;
}

export interface BuildNewProjectFolderCreationPlanOptions {
	parentFolderPath: unknown;
	pathExists: (path: string) => boolean;
	projectName: string;
}

export type ProjectFolderSyncPlan =
	| {
		kind: 'conflict';
		sourcePath: string;
		targetPath: string;
	}
	| {
		kind: 'rename';
		sourcePath: string;
		targetPath: string;
	};

export type NewProjectFolderCreationPlan =
	| {
		kind: 'conflict';
		conflictPath: string;
		filePath: string;
		folderPath: string;
		projectName: string;
	}
	| {
		kind: 'create';
		filePath: string;
		folderPath: string;
		projectName: string;
	};

export interface FindProjectParentFolderFileConflictOptions {
	parentFolderPath: unknown;
	pathExists: (path: string) => boolean;
	pathIsFolder: (path: string) => boolean;
}

export function isDirectSameNameProjectFile(file: DirectProjectFileLike): boolean {
	const parentName = file.parentName.trim();
	return file.extension === 'md'
		&& parentName.length > 0
		&& file.basename === parentName
		&& file.parentPath.length > 0;
}

export function buildProjectFileOpenTarget(options: BuildProjectFileOpenTargetOptions): string | null {
	const folderName = options.folder.name.trim();
	if (!folderName) {
		return null;
	}

	const targetPath = joinPath(options.folder.path, `${folderName}.md`);
	return options.pathExists(targetPath) ? targetPath : null;
}

export function buildProjectFolderRenameSyncPlan(
	options: BuildProjectFolderRenameSyncPlanOptions,
): ProjectFolderSyncPlan | null {
	const oldFolderName = getPathBasename(options.oldFolderPath);
	const newFolderName = getPathBasename(options.newFolderPath);
	if (!oldFolderName || !newFolderName || oldFolderName === newFolderName) {
		return null;
	}

	const sourcePath = joinPath(options.newFolderPath, `${oldFolderName}.md`);
	if (!options.pathExists(sourcePath)) {
		return null;
	}

	const targetPath = joinPath(options.newFolderPath, `${newFolderName}.md`);
	if (sourcePath === targetPath) {
		return null;
	}

	return {
		kind: options.pathExists(targetPath) ? 'conflict' : 'rename',
		sourcePath,
		targetPath,
	};
}

export function buildProjectFolderChildRenameSyncPlan(
	options: BuildProjectFolderChildRenameSyncPlanOptions,
): ProjectFolderSyncPlan | null {
	const oldFolderPath = normalizeVaultPath(options.oldFolderPath);
	const newFolderPath = normalizeVaultPath(options.newFolderPath);
	if (getParentPath(options.oldFilePath) !== oldFolderPath || getParentPath(options.newFilePath) !== newFolderPath) {
		return null;
	}

	const oldFolderName = getPathBasename(oldFolderPath);
	const newFolderName = getPathBasename(newFolderPath);
	if (!oldFolderName || !newFolderName || oldFolderName === newFolderName) {
		return null;
	}

	const oldFileBasename = getPathBasenameWithoutExtension(options.oldFilePath);
	const newFileBasename = getPathBasenameWithoutExtension(options.newFilePath);
	if (oldFileBasename !== oldFolderName || newFileBasename !== oldFolderName) {
		return null;
	}

	if (getPathExtension(options.newFilePath) !== 'md') {
		return null;
	}

	const sourcePath = normalizeVaultPath(options.newFilePath);
	if (!options.pathExists(sourcePath)) {
		return null;
	}

	const targetPath = joinPath(newFolderPath, `${newFolderName}.md`);
	if (sourcePath === targetPath) {
		return null;
	}

	return {
		kind: options.pathExists(targetPath) ? 'conflict' : 'rename',
		sourcePath,
		targetPath,
	};
}

export function buildProjectFileRenameSyncPlan(
	options: BuildProjectFileRenameSyncPlanOptions,
): ProjectFolderSyncPlan | null {
	if (options.newFileExtension !== 'md') {
		return null;
	}

	const oldParentPath = getParentPath(options.oldFilePath);
	const newParentPath = normalizeVaultPath(options.newFileParentPath);
	if (oldParentPath !== newParentPath) {
		return null;
	}

	const sourceFolderName = getPathBasename(newParentPath);
	const oldFileBasename = getPathBasenameWithoutExtension(options.oldFilePath);
	if (!sourceFolderName || sourceFolderName !== oldFileBasename) {
		return null;
	}

	const targetFolderName = options.newFileBasename.trim();
	if (!targetFolderName || targetFolderName === sourceFolderName) {
		return null;
	}

	const sourcePath = newParentPath;
	if (!options.pathExists(sourcePath)) {
		return null;
	}

	const parentFolderPath = getParentPath(newParentPath);
	const targetPath = parentFolderPath
		? joinPath(parentFolderPath, targetFolderName)
		: normalizeVaultPath(targetFolderName);
	if (sourcePath === targetPath) {
		return null;
	}

	return {
		kind: options.pathExists(targetPath) ? 'conflict' : 'rename',
		sourcePath,
		targetPath,
	};
}

export function buildNewProjectFolderCreationPlan(
	options: BuildNewProjectFolderCreationPlanOptions,
): NewProjectFolderCreationPlan | null {
	const projectName = normalizeProjectName(options.projectName);
	if (!projectName) {
		return null;
	}

	const parentFolderPath = normalizeProjectParentFolderPath(options.parentFolderPath);
	const folderPath = joinPath(parentFolderPath, projectName);
	const filePath = joinPath(folderPath, `${projectName}.md`);
	const conflictPath = options.pathExists(folderPath)
		? folderPath
		: options.pathExists(filePath)
			? filePath
			: null;
	if (conflictPath) {
		return {
			kind: 'conflict',
			conflictPath,
			filePath,
			folderPath,
			projectName,
		};
	}

	return {
		kind: 'create',
		filePath,
		folderPath,
		projectName,
	};
}

export function joinPath(folderPath: string, childPath: string): string {
	return folderPath.length > 0 ? normalizeVaultPath(`${folderPath}/${childPath}`) : normalizeVaultPath(childPath);
}

export function findProjectParentFolderFileConflict(
	options: FindProjectParentFolderFileConflictOptions,
): string | null {
	const parentFolderPath = normalizeProjectParentFolderPath(options.parentFolderPath);
	if (!parentFolderPath) {
		return null;
	}

	const segments = parentFolderPath.split('/');
	let currentPath = '';
	for (const segment of segments) {
		currentPath = joinPath(currentPath, segment);
		if (options.pathExists(currentPath) && !options.pathIsFolder(currentPath)) {
			return currentPath;
		}
	}

	return null;
}

export function normalizeProjectParentFolderPath(path: unknown): string {
	if (typeof path !== 'string') {
		return '';
	}

	return normalizeVaultPath(path)
		.split('/')
		.filter((segment) => segment !== '..')
		.join('/');
}

export function getParentPath(path: string): string {
	const normalizedPath = normalizeVaultPath(path);
	const lastSlashIndex = normalizedPath.lastIndexOf('/');
	return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : '';
}

function getPathBasename(path: string): string {
	const normalizedPath = normalizeVaultPath(path);
	const lastSlashIndex = normalizedPath.lastIndexOf('/');
	return lastSlashIndex >= 0 ? normalizedPath.slice(lastSlashIndex + 1) : normalizedPath;
}

function getPathBasenameWithoutExtension(path: string): string {
	const basename = getPathBasename(path);
	const lastDotIndex = basename.lastIndexOf('.');
	return lastDotIndex > 0 ? basename.slice(0, lastDotIndex) : basename;
}

function getPathExtension(path: string): string {
	const basename = getPathBasename(path);
	const lastDotIndex = basename.lastIndexOf('.');
	return lastDotIndex > 0 ? basename.slice(lastDotIndex + 1).toLowerCase() : '';
}

function normalizeProjectName(value: string): string {
	const trimmedValue = value.trim();
	if (trimmedValue.toLowerCase().endsWith('.md')) {
		return trimmedValue.slice(0, -3).trim();
	}

	return trimmedValue;
}

function normalizeVaultPath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== '.')
		.join('/');
}
