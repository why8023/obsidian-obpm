import {App, CachedMetadata, Notice, TFile} from 'obsidian';
import {
	buildUniqueTargetPath,
	ensureFolderExists,
	isPathInsideFolderPath,
	joinPath,
} from '../project-routing/file-move-utils';
import {getProjectRoutingLocalization} from '../project-routing/localization';
import {
	getOpenProjectCandidates,
	getVaultProjectCandidates,
	ProjectFileRecognitionOptions,
} from '../project-routing/project-resolver';
import {ProjectCandidate} from '../project-routing/types';
import {buildSourceContribution} from '../related-links/source-index';

interface EnsureFileInProjectFolderOptions {
	app: App;
	autoMoveWhenSingleCandidate: boolean;
	cache: CachedMetadata | null;
	displayProperty: string;
	file: TFile;
	projectFileRecognition: ProjectFileRecognitionOptions;
	relationProperty: string;
	showNoticeAfterMove: boolean;
	targetSubfolderPath: string;
}

type ProjectPlacementActionResult =
	| {
		kind: 'already-in-project';
		targetProject: ProjectCandidate;
	}
	| {
		kind: 'ambiguous-project';
		candidates: ProjectCandidate[];
	}
	| {
		kind: 'failed';
	}
	| {
		kind: 'moved';
		targetPath: string;
		targetProject: ProjectCandidate;
	}
	| {
		kind: 'no-project';
	};

type ProjectResolution =
	| {
		kind: 'ambiguous';
		candidates: ProjectCandidate[];
	}
	| {
		kind: 'project';
		candidate: ProjectCandidate;
	}
	| {
		kind: 'none';
	};

export async function ensureFileInProjectFolder(
	options: EnsureFileInProjectFolderOptions,
): Promise<ProjectPlacementActionResult> {
	const projectCandidates = getVaultProjectCandidates(options.app, options.projectFileRecognition);
	if (projectCandidates.length === 0) {
		return {kind: 'no-project'};
	}

	const relatedProject = resolveRelatedProjectCandidate(options, projectCandidates);
	if (relatedProject.kind === 'project') {
		return await ensureFileInProject(options, relatedProject.candidate);
	}

	if (relatedProject.kind === 'ambiguous') {
		const containingRelatedProject = relatedProject.candidates.find((candidate) =>
			isPathInsideFolderPath(options.file.path, candidate.folderPath));
		if (containingRelatedProject) {
			return {
				kind: 'already-in-project',
				targetProject: containingRelatedProject,
			};
		}

		return {
			kind: 'ambiguous-project',
			candidates: relatedProject.candidates,
		};
	}

	const containingProject = findDeepestContainingProjectCandidate(options.file.path, projectCandidates);
	if (containingProject) {
		return {
			kind: 'already-in-project',
			targetProject: containingProject,
		};
	}

	if (!options.autoMoveWhenSingleCandidate) {
		return {kind: 'no-project'};
	}

	const openCandidates = getOpenProjectCandidates(
		options.app,
		options.projectFileRecognition,
		{excludePath: options.file.path},
	);
	const onlyOpenCandidate = openCandidates[0];
	if (openCandidates.length !== 1 || !onlyOpenCandidate) {
		return {kind: 'no-project'};
	}

	return await ensureFileInProject(options, onlyOpenCandidate);
}

async function ensureFileInProject(
	options: EnsureFileInProjectFolderOptions,
	targetProject: ProjectCandidate,
): Promise<ProjectPlacementActionResult> {
	if (isPathInsideFolderPath(options.file.path, targetProject.folderPath)) {
		return {
			kind: 'already-in-project',
			targetProject,
		};
	}

	const localization = getProjectRoutingLocalization();
	const sourceName = options.file.name;
	const targetFolderPath = options.targetSubfolderPath.length > 0
		? joinPath(targetProject.folderPath, options.targetSubfolderPath)
		: targetProject.folderPath;

	try {
		await ensureFolderExists(options.app, targetFolderPath);
		const targetPath = buildUniqueTargetPath(options.app, options.file, targetFolderPath);
		await options.app.fileManager.renameFile(options.file, targetPath);

		if (options.showNoticeAfterMove) {
			new Notice(localization.moveNotice(sourceName, targetProject.name));
		}

		return {
			kind: 'moved',
			targetPath,
			targetProject,
		};
	} catch (error) {
		console.error('[OBPM] Failed to move a markdown file into its project folder.', error);
		new Notice(localization.moveFailureNotice);
		return {kind: 'failed'};
	}
}

function resolveRelatedProjectCandidate(
	options: EnsureFileInProjectFolderOptions,
	projectCandidates: readonly ProjectCandidate[],
): ProjectResolution {
	const contribution = buildSourceContribution(
		options.app,
		options.file,
		options.relationProperty.trim(),
		options.displayProperty.trim(),
		options.cache,
	);
	if (!contribution) {
		return {kind: 'none'};
	}

	const projectCandidatesByFilePath = new Map(projectCandidates.map((candidate) => [candidate.file.path, candidate]));
	const relatedProjectCandidates = new Map<string, ProjectCandidate>();
	for (const targetPath of contribution.targetPaths) {
		const directProjectCandidate = projectCandidatesByFilePath.get(targetPath);
		const projectCandidate = directProjectCandidate
			?? findDeepestContainingProjectCandidate(targetPath, projectCandidates);
		if (!projectCandidate) {
			continue;
		}

		relatedProjectCandidates.set(projectCandidate.file.path, projectCandidate);
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

function findDeepestContainingProjectCandidate(
	path: string,
	projectCandidates: readonly ProjectCandidate[],
): ProjectCandidate | null {
	const matches = projectCandidates
		.filter((candidate) => isPathInsideFolderPath(path, candidate.folderPath))
		.sort((left, right) => right.folderPath.length - left.folderPath.length);

	return matches[0] ?? null;
}
