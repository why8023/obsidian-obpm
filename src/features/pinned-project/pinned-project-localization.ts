import {getLanguage} from 'obsidian';

interface PinnedProjectLocalization {
	clearCommandName: string;
	clearNotice: string;
	linkFailureNotice: string;
	noProjectNotice: string;
	pinCommandName: string;
	pinMenuItemLabel: string;
	pinNotice: (projectName: string) => string;
	projectMissingNotice: string;
	statusMissingText: string;
	statusMissingTooltip: (projectPath: string) => string;
	statusText: (projectName: string) => string;
	statusTooltip: (projectPath: string) => string;
}

const ENGLISH_LOCALIZATION: PinnedProjectLocalization = {
	clearCommandName: 'Clear pinned project',
	clearNotice: 'Cleared the pinned project.',
	linkFailureNotice: 'Failed to link the new file to the pinned project. Check the developer console for details.',
	noProjectNotice: 'The current file is not a recognized project.',
	pinCommandName: 'Pin current project',
	pinMenuItemLabel: 'Pin as project',
	pinNotice: (projectName) => `Pinned project ${projectName}.`,
	projectMissingNotice: 'The pinned project file no longer exists.',
	statusMissingText: 'Pinned: Missing',
	statusMissingTooltip: (projectPath) => `Pinned project file is missing: ${projectPath}.`,
	statusText: (projectName) => `Pinned: ${projectName}`,
	statusTooltip: (projectPath) => `Pinned project: ${projectPath}.`,
};

const CHINESE_LOCALIZATION: PinnedProjectLocalization = {
	clearCommandName: '清除固定项目',
	clearNotice: '已清除固定项目。',
	linkFailureNotice: '把新文件关联到固定项目时失败，请打开开发者控制台查看详情。',
	noProjectNotice: '当前文件不是已识别的项目。',
	pinCommandName: '固定当前项目',
	pinMenuItemLabel: '固定为当前项目',
	pinNotice: (projectName) => `已固定项目 ${projectName}。`,
	projectMissingNotice: '固定项目文件已不存在。',
	statusMissingText: '固定：丢失',
	statusMissingTooltip: (projectPath) => `固定项目文件不存在：${projectPath}。`,
	statusText: (projectName) => `固定：${projectName}`,
	statusTooltip: (projectPath) => `当前固定项目：${projectPath}。`,
};

export function getPinnedProjectLocalization(): PinnedProjectLocalization {
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
