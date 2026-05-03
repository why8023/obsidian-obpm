import {App, CachedMetadata, Notice, TFile} from 'obsidian';
import {buildSourceContribution} from '../related-links/source-index';
import {isPathInsideFolderPath} from '../project-routing/file-move-utils';
import {
	getOpenProjectCandidates,
	getVaultProjectCandidates,
	ProjectFileRecognitionOptions,
} from '../project-routing/project-resolver';
import {ProjectCandidate} from '../project-routing/types';
import {FrontmatterAutomationProjectContentAction} from './frontmatter-automation-types';
import {buildProjectFileContentWithSentContent} from './project-content-insertion';
import {getProjectContentActionLocalization} from './project-content-action-localization';

interface SendContentToProjectFileOptions {
	app: App;
	autoMoveWhenSingleCandidate: boolean;
	cache: CachedMetadata | null;
	displayProperty: string;
	file: TFile;
	projectFileRecognition: ProjectFileRecognitionOptions;
	relationProperty: string;
	stripSingleH1: boolean;
	action: FrontmatterAutomationProjectContentAction;
}

type ProjectContentActionResult =
	| {
		kind: 'ambiguous-project';
		candidates: ProjectCandidate[];
	}
	| {
		kind: 'failed';
	}
	| {
		kind: 'no-project';
	}
	| {
		kind: 'sent';
		targetProject: ProjectCandidate;
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

export async function sendContentToProjectFile(
	options: SendContentToProjectFileOptions,
): Promise<ProjectContentActionResult> {
	const localization = getProjectContentActionLocalization();
	const projectCandidates = getVaultProjectCandidates(options.app, options.projectFileRecognition);
	if (projectCandidates.length === 0) {
		new Notice(localization.noProjectNotice);
		return {kind: 'no-project'};
	}

	const targetProject = resolveTargetProjectCandidate(options, projectCandidates);
	if (targetProject.kind === 'none') {
		new Notice(localization.noProjectNotice);
		return {kind: 'no-project'};
	}

	if (targetProject.kind === 'ambiguous') {
		new Notice(localization.ambiguousProjectNotice);
		return {
			kind: 'ambiguous-project',
			candidates: targetProject.candidates,
		};
	}

	if (targetProject.candidate.file.path === options.file.path) {
		new Notice(localization.sameFileNotice);
		return {kind: 'failed'};
	}

	const sourceName = options.file.name;
	const projectName = targetProject.candidate.file.name;
	let projectContentBefore = '';
	let projectContentAfter = '';
	let didModifyProjectFile = false;

	try {
		const sourceContent = await options.app.vault.read(options.file);
		projectContentBefore = await options.app.vault.read(targetProject.candidate.file);
		projectContentAfter = buildProjectFileContentWithSentContent({
			placement: {
				headingLevel: options.action.headingLevel,
				mode: options.action.placementMode,
				targetHeading: options.action.targetHeading,
			},
			projectContent: projectContentBefore,
			sourceBasename: options.file.basename,
			sourceContent,
			stripSingleH1: options.stripSingleH1,
		});

		await options.app.vault.modify(targetProject.candidate.file, projectContentAfter);
		didModifyProjectFile = true;
		await options.app.fileManager.trashFile(options.file);
		new Notice(localization.successNotice(sourceName, projectName));
		return {
			kind: 'sent',
			targetProject: targetProject.candidate,
		};
	} catch (error) {
		if (didModifyProjectFile) {
			await rollbackProjectFile(options.app, targetProject.candidate.file, projectContentAfter, projectContentBefore);
		}

		console.error('[OBPM] Failed to send source content to a project file.', {
			error,
			projectPath: targetProject.candidate.file.path,
			sourcePath: options.file.path,
		});
		new Notice(localization.failureNotice);
		return {kind: 'failed'};
	}
}

async function rollbackProjectFile(
	app: App,
	projectFile: TFile,
	expectedContent: string,
	previousContent: string,
): Promise<void> {
	try {
		const currentContent = await app.vault.read(projectFile);
		if (currentContent === expectedContent) {
			await app.vault.modify(projectFile, previousContent);
		}
	} catch (error) {
		console.error('[OBPM] Failed to roll back project content insertion.', {
			error,
			projectPath: projectFile.path,
		});
	}
}

function resolveTargetProjectCandidate(
	options: SendContentToProjectFileOptions,
	projectCandidates: readonly ProjectCandidate[],
): ProjectResolution {
	const relatedProject = resolveRelatedProjectCandidate(options, projectCandidates);
	if (relatedProject.kind === 'project') {
		return relatedProject;
	}

	if (relatedProject.kind === 'ambiguous') {
		const containingRelatedProject = relatedProject.candidates.find((candidate) =>
			isPathInsideFolderPath(options.file.path, candidate.folderPath));
		return containingRelatedProject
			? {
				kind: 'project',
				candidate: containingRelatedProject,
			}
			: relatedProject;
	}

	const containingProject = findDeepestContainingProjectCandidate(options.file.path, projectCandidates);
	if (containingProject) {
		return {
			kind: 'project',
			candidate: containingProject,
		};
	}

	if (!options.autoMoveWhenSingleCandidate) {
		return {kind: 'none'};
	}

	const openCandidates = getOpenProjectCandidates(
		options.app,
		options.projectFileRecognition,
		{excludePath: options.file.path},
	);
	const onlyOpenCandidate = openCandidates[0];
	if (openCandidates.length === 1 && onlyOpenCandidate) {
		return {
			kind: 'project',
			candidate: onlyOpenCandidate,
		};
	}

	return {kind: 'none'};
}

function resolveRelatedProjectCandidate(
	options: SendContentToProjectFileOptions,
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
