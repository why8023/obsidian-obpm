import {getLanguage} from 'obsidian';

interface ConfiguredFolderNoteLocalization {
	baseConfigIncompleteNotice: string;
	baseFileInvalidNotice: (filePath: string) => string;
	baseFileReadFailureNotice: string;
	baseFolderNotMatchedNotice: string;
	baseViewMissingNotice: (viewName: string) => string;
	commandName: string;
	createFailureNotice: string;
	createSuccessNotice: (filePath: string) => string;
	defaultBasename: string;
	targetFolderFailureNotice: (folderPath: string) => string;
}

const ENGLISH_LOCALIZATION: ConfiguredFolderNoteLocalization = {
	baseConfigIncompleteNotice: 'Configure both a Base file and a Base view name, or leave both empty.',
	baseFileInvalidNotice: (filePath) => `"${filePath}" is not a valid .base file.`,
	baseFileReadFailureNotice: 'Failed to read the configured Base file. Check the developer console for details.',
	baseFolderNotMatchedNotice: 'The configured Base rules do not include the target folder.',
	baseViewMissingNotice: (viewName) => `The configured Base view "${viewName}" was not found.`,
	commandName: 'Create note in configured folder',
	createFailureNotice: 'Failed to create the configured-folder note. Check the developer console for details.',
	createSuccessNotice: (filePath) => `Created "${filePath}".`,
	defaultBasename: 'Untitled',
	targetFolderFailureNotice: (folderPath) => `Cannot create the target folder "${folderPath}". Check the path and try again.`,
};

const CHINESE_LOCALIZATION: ConfiguredFolderNoteLocalization = {
	baseConfigIncompleteNotice: '请同时配置 Base 文件和 Base 视图名，或两者都留空。',
	baseFileInvalidNotice: (filePath) => `“${filePath}”不是有效的 .base 文件。`,
	baseFileReadFailureNotice: '读取已配置的 Base 文件失败，请打开开发者控制台查看详情。',
	baseFolderNotMatchedNotice: '已配置的 Base 规则没有包含目标文件夹。',
	baseViewMissingNotice: (viewName) => `没有找到已配置的 Base 视图“${viewName}”。`,
	commandName: '在指定文件夹新建笔记',
	createFailureNotice: '在指定文件夹新建笔记失败，请打开开发者控制台查看详情。',
	createSuccessNotice: (filePath) => `已新建“${filePath}”。`,
	defaultBasename: '未命名',
	targetFolderFailureNotice: (folderPath) => `无法创建目标文件夹“${folderPath}”，请检查路径后重试。`,
};

export function getConfiguredFolderNoteLocalization(): ConfiguredFolderNoteLocalization {
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
