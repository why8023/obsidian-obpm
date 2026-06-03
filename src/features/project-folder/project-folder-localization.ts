import {getLanguage} from 'obsidian';

interface ProjectFolderLocalization {
	cancelButtonLabel: string;
	conflictNotice: (targetPath: string) => string;
	createProjectCommandDisabledNotice: string;
	createProjectCommandName: string;
	createProjectConflictNotice: (targetPath: string) => string;
	createProjectEmptyNameNotice: string;
	createProjectFailureNotice: string;
	createProjectInvalidCharacterNotice: string;
	createProjectParentFolderConflictNotice: (targetPath: string) => string;
	createProjectPathSeparatorNotice: string;
	createProjectPromptDescription: (parentFolderPath: string) => string;
	createProjectPromptPlaceholder: string;
	createProjectPromptTitle: string;
	createProjectReservedNameNotice: string;
	createProjectSubmitButtonLabel: string;
	createProjectSuccessNotice: (projectName: string) => string;
	createProjectTrailingPeriodNotice: string;
	fileOpenFailureNotice: string;
	fileRenameSyncDescription: (sourcePath: string, targetPath: string) => string;
	fileRenameSyncTitle: string;
	folderRenameSyncDescription: (sourcePath: string, targetPath: string) => string;
	folderRenameSyncTitle: string;
	openIndicatorLabel: (fileName: string) => string;
	syncButtonLabel: string;
	syncFailureNotice: string;
	vaultRootLabel: string;
}

const ENGLISH_LOCALIZATION: ProjectFolderLocalization = {
	cancelButtonLabel: 'Cancel',
	conflictNotice: (targetPath) => `Cannot sync project name because "${targetPath}" already exists.`,
	createProjectCommandDisabledNotice: 'The create project command is disabled in project folder settings.',
	createProjectCommandName: 'Create project folder',
	createProjectConflictNotice: (targetPath) => `Cannot create the project because "${targetPath}" already exists.`,
	createProjectEmptyNameNotice: 'Project name cannot be empty.',
	createProjectFailureNotice: 'Failed to create the project folder. Check the developer console for details.',
	createProjectInvalidCharacterNotice: 'Project name contains characters that are not allowed in file names.',
	createProjectParentFolderConflictNotice: (targetPath) =>
		`Cannot create the project because "${targetPath}" is a file, not a folder.`,
	createProjectPathSeparatorNotice: 'Project name cannot include slashes.',
	createProjectPromptDescription: (parentFolderPath) =>
		`The project folder and same-name markdown file will be created in ${parentFolderPath}.`,
	createProjectPromptPlaceholder: 'Enter project name',
	createProjectPromptTitle: 'Create project folder',
	createProjectReservedNameNotice: 'This project name is reserved by the operating system.',
	createProjectSubmitButtonLabel: 'Create',
	createProjectSuccessNotice: (projectName) => `Created project "${projectName}".`,
	createProjectTrailingPeriodNotice: 'Project name cannot end with a period.',
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
	vaultRootLabel: 'the vault root',
};

const CHINESE_LOCALIZATION: ProjectFolderLocalization = {
	cancelButtonLabel: '取消',
	conflictNotice: (targetPath) => `无法同步项目名称，因为“${targetPath}”已经存在。`,
	createProjectCommandDisabledNotice: '“新建项目文件夹”命令已在项目文件夹设置中关闭。',
	createProjectCommandName: '新建项目文件夹',
	createProjectConflictNotice: (targetPath) => `无法新建项目，因为“${targetPath}”已经存在。`,
	createProjectEmptyNameNotice: '项目名称不能为空。',
	createProjectFailureNotice: '新建项目文件夹失败，请打开开发者控制台查看详情。',
	createProjectInvalidCharacterNotice: '项目名称包含文件名不允许使用的字符。',
	createProjectParentFolderConflictNotice: (targetPath) => `无法新建项目，因为“${targetPath}”是文件而不是文件夹。`,
	createProjectPathSeparatorNotice: '项目名称不能包含斜杠。',
	createProjectPromptDescription: (parentFolderPath) =>
		`项目文件夹和同名 Markdown 文件会创建在 ${parentFolderPath}。`,
	createProjectPromptPlaceholder: '输入项目名称',
	createProjectPromptTitle: '新建项目文件夹',
	createProjectReservedNameNotice: '这个项目名称是操作系统保留名称。',
	createProjectSubmitButtonLabel: '新建',
	createProjectSuccessNotice: (projectName) => `已新建项目“${projectName}”。`,
	createProjectTrailingPeriodNotice: '项目名称不能以句点结尾。',
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
	vaultRootLabel: '库根目录',
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
