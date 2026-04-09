import {App, TFile, WorkspaceLeaf} from 'obsidian';
import {matchesFrontmatterRule} from './matcher';
import {CurrentProjectResolution, FrontmatterMatchRule, ProjectCandidate} from './types';

interface ProjectFileRecognitionOptions {
	recognizeFilenameMatchesFolderAsProject: boolean;
}

interface CandidateOptions {
	excludePath?: string;
}

export function getOpenProjectCandidates(
	app: App,
	projectRule: FrontmatterMatchRule,
	projectFileRecognition: ProjectFileRecognitionOptions,
	options: CandidateOptions = {},
): ProjectCandidate[] {
	const candidatesByPath = new Map<string, ProjectCandidate>();

	app.workspace.iterateAllLeaves((leaf) => {
		const file = getLeafFile(leaf);
		if (!(file instanceof TFile) || file.extension !== 'md') {
			return;
		}

		if (file.path === options.excludePath || candidatesByPath.has(file.path)) {
			return;
		}

		if (!isProjectFile(app, file, projectRule, projectFileRecognition)) {
			return;
		}

		candidatesByPath.set(file.path, toProjectCandidate(file));
	});

	return [...candidatesByPath.values()].sort(compareProjectCandidates);
}

export function resolveCurrentProject(
	app: App,
	activeFile: TFile | null,
	projectRule: FrontmatterMatchRule,
	projectFileRecognition: ProjectFileRecognitionOptions,
): CurrentProjectResolution {
	if (!(activeFile instanceof TFile) || activeFile.extension !== 'md') {
		return {kind: 'none'};
	}

	if (isProjectFile(app, activeFile, projectRule, projectFileRecognition)) {
		return {
			kind: 'project',
			candidate: toProjectCandidate(activeFile),
		};
	}

	const activeFolderPath = activeFile.parent?.path ?? '';
	const folderMatches = getOpenProjectCandidates(app, projectRule, projectFileRecognition)
		.filter((candidate) => candidate.folderPath === activeFolderPath);
	const onlyFolderMatch = folderMatches[0];

	if (folderMatches.length === 1 && onlyFolderMatch) {
		return {
			kind: 'project',
			candidate: onlyFolderMatch,
		};
	}

	if (folderMatches.length > 1) {
		return {
			kind: 'ambiguous',
			candidates: folderMatches,
		};
	}

	return {kind: 'none'};
}

function isProjectFile(
	app: App,
	file: TFile,
	projectRule: FrontmatterMatchRule,
	projectFileRecognition: ProjectFileRecognitionOptions,
): boolean {
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	if (matchesFrontmatterRule(frontmatter, projectRule)) {
		return true;
	}

	return projectFileRecognition.recognizeFilenameMatchesFolderAsProject && hasMatchingFolderAndFileName(file);
}

function hasMatchingFolderAndFileName(file: TFile): boolean {
	const folderName = file.parent?.name?.trim() ?? '';
	return folderName.length > 0 && file.basename === folderName;
}

function compareProjectCandidates(left: ProjectCandidate, right: ProjectCandidate): number {
	const nameCompare = left.name.localeCompare(right.name);
	if (nameCompare !== 0) {
		return nameCompare;
	}

	return left.file.path.localeCompare(right.file.path);
}

function getLeafFile(leaf: WorkspaceLeaf): TFile | null {
	const file = (leaf.view as {file?: unknown}).file;
	return file instanceof TFile ? file : null;
}

function toProjectCandidate(file: TFile): ProjectCandidate {
	return {
		file,
		folderPath: file.parent?.path ?? '',
		name: file.basename,
	};
}
