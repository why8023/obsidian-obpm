import {App} from 'obsidian';
import {getVaultProjectCandidates, ProjectFileRecognitionOptions} from './project-resolver';
import {ProjectCandidate} from './types';

export interface DuplicateProjectFolder {
	folderPath: string;
	projects: ProjectCandidate[];
}

export function findDuplicateProjectFolders(
	app: App,
	projectFileRecognition: ProjectFileRecognitionOptions,
): DuplicateProjectFolder[] {
	const projectsByFolderPath = new Map<string, ProjectCandidate[]>();

	for (const project of getVaultProjectCandidates(app, projectFileRecognition)) {
		const existingProjects = projectsByFolderPath.get(project.folderPath);
		if (existingProjects) {
			existingProjects.push(project);
			continue;
		}

		projectsByFolderPath.set(project.folderPath, [project]);
	}

	return [...projectsByFolderPath.entries()]
		.filter(([, projects]) => projects.length > 1)
		.map(([folderPath, projects]) => ({
			folderPath,
			projects: [...projects].sort(compareProjectCandidates),
		}))
		.sort(compareDuplicateProjectFolders);
}

export function getDuplicateProjectFoldersKey(duplicateFolders: readonly DuplicateProjectFolder[]): string {
	return duplicateFolders
		.map((folder) => `${folder.folderPath}\n${folder.projects.map((project) => project.file.path).join('\n')}`)
		.join('\n\n');
}

function compareDuplicateProjectFolders(left: DuplicateProjectFolder, right: DuplicateProjectFolder): number {
	const folderCompare = left.folderPath.localeCompare(right.folderPath);
	if (folderCompare !== 0) {
		return folderCompare;
	}

	return left.projects.length - right.projects.length;
}

function compareProjectCandidates(left: ProjectCandidate, right: ProjectCandidate): number {
	return left.file.path.localeCompare(right.file.path);
}
