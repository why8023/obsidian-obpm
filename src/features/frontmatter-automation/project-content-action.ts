import {App, CachedMetadata, Notice, TFile} from 'obsidian';
import {buildSourceContribution} from '../related-links/source-index';
import {resolveAssociatedProjectCandidate, ProjectAssociationCandidate} from '../project-routing/project-association-resolver';
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
