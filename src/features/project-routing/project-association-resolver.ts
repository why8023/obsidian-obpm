export interface ProjectAssociationCandidate {
	filePath: string;
	folderPath: string;
	name: string;
}

export interface ResolveAssociatedProjectCandidateOptions<TCandidate extends ProjectAssociationCandidate> {
	autoUseSingleOpenProject: boolean;
	openProjectCandidates: readonly TCandidate[];
	projectCandidates: readonly TCandidate[];
	relatedTargetPaths: readonly string[];
	sourcePath: string;
}

export type ProjectAssociationResolution<TCandidate extends ProjectAssociationCandidate> =
	| {
		kind: 'ambiguous';
		candidates: TCandidate[];
	}
	| {
		kind: 'project';
		candidate: TCandidate;
	}
	| {
		kind: 'none';
	};

export function resolveAssociatedProjectCandidate<TCandidate extends ProjectAssociationCandidate>(
	options: ResolveAssociatedProjectCandidateOptions<TCandidate>,
): ProjectAssociationResolution<TCandidate> {
	const relatedProject = resolveRelatedProjectCandidate(options.relatedTargetPaths, options.projectCandidates);
	if (relatedProject.kind === 'project') {
		return relatedProject;
	}

	if (relatedProject.kind === 'ambiguous') {
		const containingRelatedProject = relatedProject.candidates.find((candidate) =>
			isPathInsideFolderPath(options.sourcePath, candidate.folderPath));
		return containingRelatedProject
			? {
				kind: 'project',
				candidate: containingRelatedProject,
			}
			: relatedProject;
	}

	const containingProject = findDeepestContainingProjectCandidate(options.sourcePath, options.projectCandidates);
	if (containingProject) {
		return {
			kind: 'project',
			candidate: containingProject,
		};
	}

	if (!options.autoUseSingleOpenProject) {
		return {kind: 'none'};
	}

	const onlyOpenCandidate = options.openProjectCandidates[0];
	if (options.openProjectCandidates.length === 1 && onlyOpenCandidate) {
		return {
			kind: 'project',
			candidate: onlyOpenCandidate,
		};
	}

	return {kind: 'none'};
}

function findDeepestContainingProjectCandidate<TCandidate extends ProjectAssociationCandidate>(
	path: string,
	projectCandidates: readonly TCandidate[],
): TCandidate | null {
	const matches = projectCandidates
		.filter((candidate) => isPathInsideFolderPath(path, candidate.folderPath))
		.sort((left, right) => right.folderPath.length - left.folderPath.length);

	return matches[0] ?? null;
}

function resolveRelatedProjectCandidate<TCandidate extends ProjectAssociationCandidate>(
	relatedTargetPaths: readonly string[],
	projectCandidates: readonly TCandidate[],
): ProjectAssociationResolution<TCandidate> {
	const projectCandidatesByFilePath = new Map(projectCandidates.map((candidate) => [candidate.filePath, candidate]));
	const relatedProjectCandidates = new Map<string, TCandidate>();

	for (const targetPath of relatedTargetPaths) {
		const directProjectCandidate = projectCandidatesByFilePath.get(targetPath);
		const projectCandidate = directProjectCandidate
			?? findDeepestContainingProjectCandidate(targetPath, projectCandidates);
		if (!projectCandidate) {
			continue;
		}

		relatedProjectCandidates.set(projectCandidate.filePath, projectCandidate);
	}

	const candidates = [...relatedProjectCandidates.values()];
	const onlyCandidate = candidates[0];
	if (candidates.length === 1 && onlyCandidate) {
		return {
			kind: 'project',
			candidate: onlyCandidate,
		};
	}

	if (candidates.length > 1) {
		return {
			kind: 'ambiguous',
			candidates,
		};
	}

	return {kind: 'none'};
}

function isPathInsideFolderPath(path: string, folderPath: string): boolean {
	const normalizedPath = normalizeVaultPath(path);
	const normalizedFolderPath = normalizeVaultPath(folderPath);
	return normalizedFolderPath.length === 0
		? normalizedPath.length > 0
		: normalizedPath.startsWith(`${normalizedFolderPath}/`);
}

function normalizeVaultPath(value: string): string {
	return value
		.replace(/\\/g, '/')
		.split('/')
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== '.')
		.join('/');
}
