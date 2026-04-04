import {getLanguage} from 'obsidian';

interface SameFolderNoteLocalization {
	cancelButtonLabel: string;
	commandName: string;
	createFailureNotice: string;
	defaultBasename: string;
	fileExistsNotice: (fileName: string) => string;
	invalidCharacterNotice: string;
	menuItemLabel: string;
	pathSeparatorNotice: string;
	promptDescription: (folderPath: string) => string;
	promptPlaceholder: string;
	promptTitle: (referenceFileName: string) => string;
	reservedNameNotice: string;
	submitButtonLabel: string;
	trailingPeriodNotice: string;
	vaultRootLabel: string;
	emptyNameNotice: string;
}

const ENGLISH_LOCALIZATION: SameFolderNoteLocalization = {
	cancelButtonLabel: 'Cancel',
	commandName: 'Create note in same folder as current file',
	createFailureNotice: 'Failed to create the new note. Check the developer console for details.',
	defaultBasename: 'Untitled',
	emptyNameNotice: 'Note name cannot be empty.',
	fileExistsNotice: (fileName) => `A file named "${fileName}.md" already exists in this folder.`,
	invalidCharacterNotice: 'Note name contains characters that are not allowed in file names.',
	menuItemLabel: 'Create note in same folder',
	pathSeparatorNotice: 'Note name must stay in the same folder and cannot include slashes.',
	promptDescription: (folderPath) => `The new markdown note will be created in ${folderPath}.`,
	promptPlaceholder: 'Enter note name',
	promptTitle: (referenceFileName) => `Create note next to "${referenceFileName}"`,
	reservedNameNotice: 'This note name is reserved by the operating system.',
	submitButtonLabel: 'Create',
	trailingPeriodNotice: 'Note name cannot end with a period.',
	vaultRootLabel: 'the vault root',
};

const CHINESE_LOCALIZATION: SameFolderNoteLocalization = {
	cancelButtonLabel: '取消',
	commandName: '在当前文件同目录新建笔记',
	createFailureNotice: '新建笔记失败，请打开开发者控制台查看详情。',
	defaultBasename: '未命名',
	emptyNameNotice: '笔记名称不能为空。',
	fileExistsNotice: (fileName) => `当前文件夹里已经存在“${fileName}.md”。`,
	invalidCharacterNotice: '笔记名称包含文件名不允许使用的字符。',
	menuItemLabel: '在同目录新建笔记',
	pathSeparatorNotice: '笔记名称必须保留在当前目录，不能包含斜杠。',
	promptDescription: (folderPath) => `新的 Markdown 笔记会创建在 ${folderPath}。`,
	promptPlaceholder: '输入笔记名称',
	promptTitle: (referenceFileName) => `在“${referenceFileName}”同目录新建笔记`,
	reservedNameNotice: '这个笔记名称是操作系统保留名称。',
	submitButtonLabel: '新建',
	trailingPeriodNotice: '笔记名称不能以句点结尾。',
	vaultRootLabel: '仓库根目录',
};

export function getSameFolderNoteLocalization(): SameFolderNoteLocalization {
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
