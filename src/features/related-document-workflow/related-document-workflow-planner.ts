export interface RelatedDocumentWorkflowFileInfo {
	isProject: boolean;
	name: string;
	parentPath: string;
	path: string;
}

export interface RelatedDocumentWorkflowRelationState {
	projectMarkdownLinksBySourcePath: Record<string, string[]>;
	sourceTargetsByPath: Record<string, string[]>;
}

export interface RelatedDocumentMovePlan {
	projectPath: string;
	sourcePath: string;
	targetFolderPath: string;
	targetPath: string;
}

export interface RelatedDocumentMovePlanStats {
	alreadyInTargetCount: number;
	ambiguousDocumentCount: number;
	missingEndpointCount: number;
	noProjectRelationCount: number;
	projectToProjectRelationCount: number;
}

export interface RelatedDocumentMovePlanResult {
	plans: RelatedDocumentMovePlan[];
	stats: RelatedDocumentMovePlanStats;
}

interface RelatedDocumentMovePlanOptions {
	files: readonly RelatedDocumentWorkflowFileInfo[];
	pathExists: (path: string) => boolean;
	relationState: RelatedDocumentWorkflowRelationState;
	targetSubfolderPath: string;
}

export function buildRelatedDocumentMovePlans(options: RelatedDocumentMovePlanOptions): RelatedDocumentMovePlanResult {
	const filesByPath = new Map(options.files.map((file) => [file.path, file] as const));
	const projectPathsByDocumentPath = new Map<string, Set<string>>();
	const stats: RelatedDocumentMovePlanStats = {
		alreadyInTargetCount: 0,
		ambiguousDocumentCount: 0,
		missingEndpointCount: 0,
		noProjectRelationCount: 0,
		projectToProjectRelationCount: 0,
	};
	const addRelation = (sourcePath: string, targetPath: string) => {
		const sourceFile = filesByPath.get(sourcePath);
		const targetFile = filesByPath.get(targetPath);
		if (!sourceFile || !targetFile) {
			stats.missingEndpointCount += 1;
			return;
		}

		if (sourceFile.isProject && targetFile.isProject) {
			stats.projectToProjectRelationCount += 1;
			return;
		}

		if (!sourceFile.isProject && !targetFile.isProject) {
			stats.noProjectRelationCount += 1;
			return;
		}

		const projectPath = sourceFile.isProject ? sourceFile.path : targetFile.path;
		const documentPath = sourceFile.isProject ? targetFile.path : sourceFile.path;
		let projectPaths = projectPathsByDocumentPath.get(documentPath);
		if (!projectPaths) {
			projectPaths = new Set<string>();
			projectPathsByDocumentPath.set(documentPath, projectPaths);
		}

		projectPaths.add(projectPath);
	};

	collectRelations(options.relationState.sourceTargetsByPath, addRelation);
	collectRelations(options.relationState.projectMarkdownLinksBySourcePath, addRelation);

	const plans: RelatedDocumentMovePlan[] = [];
	const reservedTargetPaths = new Set<string>();
	const normalizedSubfolderPath = normalizeSubfolderPath(options.targetSubfolderPath);
	for (const [documentPath, projectPaths] of [...projectPathsByDocumentPath.entries()].sort(([left], [right]) => left.localeCompare(right))) {
		if (projectPaths.size > 1) {
			stats.ambiguousDocumentCount += 1;
			continue;
		}

		const documentFile = filesByPath.get(documentPath);
		const projectPath = [...projectPaths][0];
		const projectFile = projectPath ? filesByPath.get(projectPath) : null;
		if (!documentFile || !projectFile) {
			stats.missingEndpointCount += 1;
			continue;
		}

		const targetFolderPath = joinPath(projectFile.parentPath, normalizedSubfolderPath);
		if (isPathInsideFolderPath(documentFile.path, targetFolderPath)) {
			stats.alreadyInTargetCount += 1;
			continue;
		}

		const targetPath = buildUniqueTargetPath(
			documentFile,
			targetFolderPath,
			(path) => path !== documentFile.path && (options.pathExists(path) || reservedTargetPaths.has(path)),
		);
		reservedTargetPaths.add(targetPath);
		plans.push({
			projectPath: projectFile.path,
			sourcePath: documentFile.path,
			targetFolderPath,
			targetPath,
		});
	}

	return {plans, stats};
}

function collectRelations(
	relationsBySourcePath: Record<string, string[]>,
	addRelation: (sourcePath: string, targetPath: string) => void,
): void {
	for (const [sourcePath, targetPaths] of Object.entries(relationsBySourcePath)) {
		for (const targetPath of targetPaths) {
			if (sourcePath === targetPath) {
				continue;
			}

			addRelation(sourcePath, targetPath);
		}
	}
}

function buildUniqueTargetPath(
	file: RelatedDocumentWorkflowFileInfo,
	targetFolderPath: string,
	pathUnavailable: (path: string) => boolean,
): string {
	const initialPath = joinPath(targetFolderPath, file.name);
	if (!pathUnavailable(initialPath)) {
		return initialPath;
	}

	const extensionIndex = file.name.lastIndexOf('.');
	const basename = extensionIndex > 0 ? file.name.slice(0, extensionIndex) : file.name;
	const extension = extensionIndex > 0 ? file.name.slice(extensionIndex) : '';
	for (let suffix = 1; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
		const candidatePath = joinPath(targetFolderPath, `${basename} ${suffix}${extension}`);
		if (!pathUnavailable(candidatePath)) {
			return candidatePath;
		}
	}

	return initialPath;
}

function isPathInsideFolderPath(path: string, folderPath: string): boolean {
	const normalizedPath = normalizePath(path);
	const normalizedFolderPath = normalizePath(folderPath);
	return normalizedFolderPath.length === 0
		? normalizedPath.length > 0
		: normalizedPath.startsWith(`${normalizedFolderPath}/`);
}

function joinPath(folderPath: string, childPath: string): string {
	if (!folderPath) {
		return normalizePath(childPath);
	}

	if (!childPath) {
		return normalizePath(folderPath);
	}

	return normalizePath(`${folderPath}/${childPath}`);
}

function normalizeSubfolderPath(value: string): string {
	return value
		.split(/[\\/]+/)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
		.join('/');
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}
