import {getLanguage} from 'obsidian';

interface ConfiguredFolderNoteLocalization {
	baseConfigIncompleteNotice: string;
	baseFileInvalidNotice: (filePath: string) => string;
	baseFileReadFailureNotice: string;
	baseViewMissingNotice: (viewName: string) => string;
	commandName: string;
	createFailureNotice: string;
	createSuccessNotice: (filePath: string) => string;
	defaultBasename: string;
	frontmatterFailureNotice: (filePath: string) => string;
	noProjectCandidatesNotice: string;
	targetFolderFailureNotice: (folderPath: string) => string;
}

const ENGLISH_LOCALIZATION: ConfiguredFolderNoteLocalization = {
	baseConfigIncompleteNotice: 'Configure both a Base file and a Base view name, or leave both empty.',
	baseFileInvalidNotice: (filePath) => `"${filePath}" is not a valid .base file.`,
	baseFileReadFailureNotice: 'Failed to read the configured Base file. Check the developer console for details.',
	baseViewMissingNotice: (viewName) => `The configured Base view "${viewName}" was not found.`,
	commandName: 'Create note in project folder',
	createFailureNotice: 'Failed to create the project note. Check the developer console for details.',
	createSuccessNotice: (filePath) => `Created "${filePath}".`,
	defaultBasename: 'Untitled',
	frontmatterFailureNotice: (filePath) =>
		`Created "${filePath}", but failed to write its initial properties. Check the developer console for details.`,
	noProjectCandidatesNotice: 'No projects match the current project recognition settings.',
	targetFolderFailureNotice: (folderPath) =>
		`Cannot create the project folder "${folderPath}". Check the path and try again.`,
};

const CHINESE_LOCALIZATION: ConfiguredFolderNoteLocalization = {
	baseConfigIncompleteNotice: '请同时配置 Base 文件和 Base 视图名，或两者都留空。',
	baseFileInvalidNotice: (filePath) => `“${filePath}”不是有效的 .base 文件。`,
	baseFileReadFailureNotice: '读取已配置的 Base 文件失败，请打开开发者控制台查看详情。',
	baseViewMissingNotice: (viewName) => `没有找到已配置的 Base 视图“${viewName}”。`,
	commandName: '在项目中新建笔记',
	createFailureNotice: '在项目中新建笔记失败，请打开开发者控制台查看详情。',
	createSuccessNotice: (filePath) => `已新建“${filePath}”。`,
	defaultBasename: '未命名',
	frontmatterFailureNotice: (filePath) =>
		`已新建“${filePath}”，但写入初始属性失败。请打开开发者控制台查看详情。`,
	noProjectCandidatesNotice: '当前项目识别规则没有找到项目。',
	targetFolderFailureNotice: (folderPath) =>
		`无法创建项目子文件夹“${folderPath}”，请检查路径后重试。`,
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
