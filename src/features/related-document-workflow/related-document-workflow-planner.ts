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
	alreadyInProjectFolderCount: number;
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

interface ProjectContext {
	projectFolderPath: string;
	projectPath: string;
}

interface RelatedDocumentMovePlanOptions {
	files: readonly RelatedDocumentWorkflowFileInfo[];
	pathExists: (path: string) => boolean;
	relationState: RelatedDocumentWorkflowRelationState;
	targetSubfolderPath: string;
}

export function buildRelatedDocumentMovePlans(options: RelatedDocumentMovePlanOptions): RelatedDocumentMovePlanResult {
	const filesByPath = new Map(options.files.map((file) => [file.path, file] as const));
	const projectContextsByFilePath = buildProjectContextsByFilePath(options.files);
	const projectPathsByDocumentPath = new Map<string, Set<string>>();
	const stats: RelatedDocumentMovePlanStats = {
		alreadyInProjectFolderCount: 0,
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

		const sourceProjectContexts = projectContextsByFilePath.get(sourceFile.path) ?? [];
		const targetProjectContexts = projectContextsByFilePath.get(targetFile.path) ?? [];
		if (sourceProjectContexts.length === 0 && targetProjectContexts.length === 0) {
			stats.noProjectRelationCount += 1;
			return;
		}

		const relationContext = resolveRelationProjectContext({
			sourceFile,
			sourceProjectContexts,
			targetFile,
			targetProjectContexts,
		});
		if (relationContext.kind === 'already-in-project') {
			stats.alreadyInProjectFolderCount += 1;
			return;
		}

		if (relationContext.kind === 'ambiguous') {
			stats.ambiguousDocumentCount += 1;
			return;
		}

		const projectPath = relationContext.projectContext.projectPath;
		const documentPath = relationContext.documentPath;
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

		if (isPathInsideFolderPath(documentFile.path, projectFile.parentPath)) {
			stats.alreadyInProjectFolderCount += 1;
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

function buildProjectContextsByFilePath(
	files: readonly RelatedDocumentWorkflowFileInfo[],
): Map<string, ProjectContext[]> {
	const projectFiles = files.filter((file) => file.isProject);
	const contextsByFilePath = new Map<string, ProjectContext[]>();

	for (const file of files) {
		if (file.isProject) {
			contextsByFilePath.set(file.path, [{
				projectFolderPath: file.parentPath,
				projectPath: file.path,
			}]);
			continue;
		}

		const contexts = projectFiles
			.filter((projectFile) => isPathInsideFolderPath(file.path, projectFile.parentPath))
			.map((projectFile) => ({
				projectFolderPath: projectFile.parentPath,
				projectPath: projectFile.path,
			}));
		contextsByFilePath.set(file.path, contexts);
	}

	return contextsByFilePath;
}

function resolveRelationProjectContext(options: {
	sourceFile: RelatedDocumentWorkflowFileInfo;
	sourceProjectContexts: readonly ProjectContext[];
	targetFile: RelatedDocumentWorkflowFileInfo;
	targetProjectContexts: readonly ProjectContext[];
}):
	| {
		documentPath: string;
		kind: 'move';
		projectContext: ProjectContext;
	}
	| {
		kind: 'already-in-project';
	}
	| {
		kind: 'ambiguous';
	} {
	if (options.sourceProjectContexts.length === 1 && options.targetProjectContexts.length === 0) {
		return {
			documentPath: options.targetFile.path,
			kind: 'move',
			projectContext: options.sourceProjectContexts[0]!,
		};
	}

	if (options.sourceProjectContexts.length === 0 && options.targetProjectContexts.length === 1) {
		return {
			documentPath: options.sourceFile.path,
			kind: 'move',
			projectContext: options.targetProjectContexts[0]!,
		};
	}

	if (options.sourceProjectContexts.length === 1 && options.targetProjectContexts.length === 1) {
		return options.sourceProjectContexts[0]?.projectPath === options.targetProjectContexts[0]?.projectPath
			? {kind: 'already-in-project'}
			: {kind: 'ambiguous'};
	}

	return {kind: 'ambiguous'};
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
