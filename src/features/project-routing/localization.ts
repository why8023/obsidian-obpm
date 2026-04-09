import {getLanguage} from 'obsidian';

export interface ProjectRoutingLocalization {
	moveFailureNotice: string;
	moveNotice: (fileName: string, projectName: string) => string;
	modalDismissInstructionPurpose: string;
	modalEmptyStateText: string;
	modalPlaceholder: string;
	modalSelectInstructionPurpose: string;
	modalTitle: string;
	rootFolderLabel: string;
	statusAmbiguousText: string;
	statusAmbiguousTooltip: (projectNames: string[]) => string;
	statusNoneText: string;
	statusNoneTooltip: string;
	statusProjectText: (projectName: string) => string;
	statusProjectTooltip: (projectName: string, folderPath: string) => string;
}

const ENGLISH_LOCALIZATION: ProjectRoutingLocalization = {
	moveFailureNotice: 'Failed to move the new file into a project folder. Check the developer console for details.',
	moveNotice: (fileName, projectName) => `Moved ${fileName} into project ${projectName}.`,
	modalDismissInstructionPurpose: 'Cancel',
	modalEmptyStateText: 'No open project file matches the current query.',
	modalPlaceholder: 'Search open projects',
	modalSelectInstructionPurpose: 'Move into selected project',
	modalTitle: 'Select a target project',
	rootFolderLabel: 'Vault root',
	statusAmbiguousText: 'Project: Unresolved',
	statusAmbiguousTooltip: (projectNames) => `Multiple open projects match the current folder: ${projectNames.join(', ')}.`,
	statusNoneText: 'Project: None',
	statusNoneTooltip: 'The current file is not associated with any open project.',
	statusProjectText: (projectName) => `Project: ${projectName}`,
	statusProjectTooltip: (projectName, folderPath) => `Current project: ${projectName} (${folderPath}).`,
};

const CHINESE_LOCALIZATION: ProjectRoutingLocalization = {
	moveFailureNotice: '移动新建文件到项目目录时失败。请打开开发者控制台查看详情。',
	moveNotice: (fileName, projectName) => `已将 ${fileName} 移动到项目 ${projectName}。`,
	modalDismissInstructionPurpose: '取消',
	modalEmptyStateText: '当前没有匹配搜索条件的已打开项目文件。',
	modalPlaceholder: '搜索已打开的项目',
	modalSelectInstructionPurpose: '移动到所选项目',
	modalTitle: '选择目标项目',
	rootFolderLabel: 'Vault 根目录',
	statusAmbiguousText: '项目：未确定',
	statusAmbiguousTooltip: (projectNames) => `当前目录匹配到多个已打开项目：${projectNames.join('、')}。`,
	statusNoneText: '项目：无',
	statusNoneTooltip: '当前文件未关联到任何已打开项目。',
	statusProjectText: (projectName) => `项目：${projectName}`,
	statusProjectTooltip: (projectName, folderPath) => `当前所属项目：${projectName}（${folderPath}）。`,
};

export function getProjectRoutingLocalization(): ProjectRoutingLocalization {
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
