import {App, CachedMetadata, Notice, TFile} from 'obsidian';
import type {FileMoveRequest, FileMoveResult} from '../../file-move-coordinator';
import {
	buildProjectTargetMovePlan,
	ensureFolderExists,
} from '../project-routing/file-move-utils';
import {getProjectRoutingLocalization} from '../project-routing/localization';
import {resolveAssociatedProjectCandidate, ProjectAssociationCandidate} from '../project-routing/project-association-resolver';
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
	moveFile?: (file: TFile, request: FileMoveRequest<TFile>) => Promise<FileMoveResult>;
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
		candidates: ProjectAssociationCandidateWithProject[];
	}
	| {
		kind: 'project';
		candidate: ProjectAssociationCandidateWithProject;
	}
	| {
		kind: 'none';
	};

type ProjectAssociationCandidateWithProject = ProjectAssociationCandidate & ProjectCandidate;

export async function ensureFileInProjectFolder(
	options: EnsureFileInProjectFolderOptions,
): Promise<ProjectPlacementActionResult> {
	const projectCandidates = getVaultProjectCandidates(options.app, options.projectFileRecognition);
	if (projectCandidates.length === 0) {
		return {kind: 'no-project'};
	}

	const targetProject = resolveTargetProjectCandidate(options, projectCandidates);
	if (targetProject.kind === 'project') {
		return await ensureFileInProject(options, targetProject.candidate);
	}

	if (targetProject.kind === 'ambiguous') {
		return {
			kind: 'ambiguous-project',
			candidates: targetProject.candidates,
		};
	}

	return {kind: 'no-project'};
}

async function ensureFileInProject(
	options: EnsureFileInProjectFolderOptions,
	targetProject: ProjectCandidate,
): Promise<ProjectPlacementActionResult> {
	const initialPlan = buildMovePlan(options, targetProject, options.file);
	if (initialPlan.kind === 'already-in-target') {
		return {
			kind: 'already-in-project',
			targetProject,
		};
	}

	const localization = getProjectRoutingLocalization();
	const sourceName = options.file.name;

	try {
		const moveResult = options.moveFile
			? await options.moveFile(options.file, {
				resolveTargetPath: async (liveFile) => {
					const plan = buildMovePlan(options, targetProject, liveFile);
					await ensureFolderExists(options.app, plan.targetFolderPath);
					return plan.targetPath;
				},
			})
			: await moveFileWithoutCoordinator(options, targetProject, initialPlan.targetPath, initialPlan.targetFolderPath);
		if (moveResult.kind === 'skipped') {
			if (moveResult.reason === 'already-at-target') {
				return {
					kind: 'already-in-project',
					targetProject,
				};
			}

			return {kind: 'failed'};
		}

		if (options.showNoticeAfterMove) {
			new Notice(localization.moveNotice(sourceName, targetProject.name));
		}

		return {
			kind: 'moved',
			targetPath: moveResult.targetPath,
			targetProject,
		};
	} catch (error) {
		console.error('[OBPM] Failed to move a markdown file into its project folder.', error);
		new Notice(localization.moveFailureNotice);
		return {kind: 'failed'};
	}
}

async function moveFileWithoutCoordinator(
	options: EnsureFileInProjectFolderOptions,
	targetProject: ProjectCandidate,
	targetPath: string,
	targetFolderPath: string,
): Promise<FileMoveResult> {
	const sourcePath = options.file.path;
	await ensureFolderExists(options.app, targetFolderPath);
	await options.app.fileManager.renameFile(options.file, targetPath);
	return {
		kind: 'moved',
		sourcePath,
		targetPath,
	};
}

function buildMovePlan(
	options: EnsureFileInProjectFolderOptions,
	targetProject: ProjectCandidate,
	file: TFile,
) {
	return buildProjectTargetMovePlan({
		file: {
			basename: file.basename,
			extension: file.extension,
			name: file.name,
			path: file.path,
		},
		pathExists: (path) => {
			const existingFile = options.app.vault.getAbstractFileByPath(path);
			return Boolean(existingFile && existingFile.path !== file.path);
		},
		projectFolderPath: targetProject.folderPath,
		targetSubfolderPath: options.targetSubfolderPath,
	});
}

function resolveTargetProjectCandidate(
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
	return resolveAssociatedProjectCandidate({
		autoUseSingleOpenProject: options.autoMoveWhenSingleCandidate,
		openProjectCandidates: getOpenProjectCandidates(
			options.app,
			options.projectFileRecognition,
			{excludePath: options.file.path},
		).map(toProjectAssociationCandidate),
		projectCandidates: projectCandidates.map(toProjectAssociationCandidate),
		relatedTargetPaths: contribution?.targetPaths ?? [],
		sourcePath: options.file.path,
	});
}

function toProjectAssociationCandidate(candidate: ProjectCandidate): ProjectAssociationCandidateWithProject {
	return {
		...candidate,
		filePath: candidate.file.path,
	};
}
