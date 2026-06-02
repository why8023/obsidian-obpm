import {getLanguage} from 'obsidian';

interface ProjectFolderLocalization {
	cancelButtonLabel: string;
	conflictNotice: (targetPath: string) => string;
	fileOpenFailureNotice: string;
	fileRenameSyncDescription: (sourcePath: string, targetPath: string) => string;
	fileRenameSyncTitle: string;
	folderRenameSyncDescription: (sourcePath: string, targetPath: string) => string;
	folderRenameSyncTitle: string;
	openIndicatorLabel: (fileName: string) => string;
	syncButtonLabel: string;
	syncFailureNotice: string;
}

const ENGLISH_LOCALIZATION: ProjectFolderLocalization = {
	cancelButtonLabel: 'Cancel',
	conflictNotice: (targetPath) => `Cannot sync project name because "${targetPath}" already exists.`,
	fileOpenFailureNotice: 'Failed to open the project file. Check the developer console for details.',
	fileRenameSyncDescription: (sourcePath, targetPath) =>
		`Rename the project folder from "${sourcePath}" to "${targetPath}"?`,
	fileRenameSyncTitle: 'Sync project folder name',
	folderRenameSyncDescription: (sourcePath, targetPath) =>
		`Rename the project file from "${sourcePath}" to "${targetPath}"?`,
	folderRenameSyncTitle: 'Sync project file name',
	openIndicatorLabel: (fileName) => `Open project file "${fileName}"`,
	syncButtonLabel: 'Sync',
	syncFailureNotice: 'Failed to sync the project name. Check the developer console for details.',
};

const CHINESE_LOCALIZATION: ProjectFolderLocalization = {
	cancelButtonLabel: '取消',
	conflictNotice: (targetPath) => `无法同步项目名称，因为“${targetPath}”已经存在。`,
	fileOpenFailureNotice: '打开项目文件失败，请打开开发者控制台查看详情。',
	fileRenameSyncDescription: (sourcePath, targetPath) =>
		`是否将项目文件夹从“${sourcePath}”同步重命名为“${targetPath}”？`,
	fileRenameSyncTitle: '同步项目文件夹名称',
	folderRenameSyncDescription: (sourcePath, targetPath) =>
		`是否将项目文件从“${sourcePath}”同步重命名为“${targetPath}”？`,
	folderRenameSyncTitle: '同步项目文件名称',
	openIndicatorLabel: (fileName) => `打开项目文件“${fileName}”`,
	syncButtonLabel: '同步',
	syncFailureNotice: '同步项目名称失败，请打开开发者控制台查看详情。',
};

export function getProjectFolderLocalization(): ProjectFolderLocalization {
	const language = resolveLanguage();
	return language.startsWith('zh') ? CHINESE_LOCALIZATION : ENGLISH_LOCALIZATION;
}

function resolveLanguage(): string {
	if (typeof getLanguage === 'function') {
		return normalizeLanguage(getLanguage());
	}

	if (typeof document !== 'undefined') {
		const documentLanguage = document.documentElement.lang;
		if (documentLanguage) {
			return normalizeLanguage(documentLanguage);
		}
	}

	if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
		return normalizeLanguage(navigator.language);
	}

	return 'en';
}

function normalizeLanguage(value: string): string {
	return value.trim().toLowerCase();
}
