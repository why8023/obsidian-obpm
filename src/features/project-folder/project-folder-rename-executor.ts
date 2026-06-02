import {ProjectFolderSyncPlan} from './project-folder-utils';

export type ProjectFolderRenameExecutionResult = 'conflict' | 'missing-source' | 'renamed';

interface ExecuteProjectFolderRenamePlanOptions<TFile> {
	getFileByPath: (path: string) => TFile | null;
	onConflict: (targetPath: string) => void;
	pathExists: (path: string) => boolean;
	renameFile: (file: TFile, targetPath: string) => Promise<void>;
}

export async function executeProjectFolderRenamePlan<TFile>(
	plan: ProjectFolderSyncPlan,
	options: ExecuteProjectFolderRenamePlanOptions<TFile>,
): Promise<ProjectFolderRenameExecutionResult> {
	if (plan.kind === 'conflict') {
		options.onConflict(plan.targetPath);
		return 'conflict';
	}

	const sourceFile = options.getFileByPath(plan.sourcePath);
	if (!sourceFile) {
		return 'missing-source';
	}

	if (options.pathExists(plan.targetPath)) {
		options.onConflict(plan.targetPath);
		return 'conflict';
	}

	await options.renameFile(sourceFile, plan.targetPath);
	return 'renamed';
}
