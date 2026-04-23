import {getLanguage} from 'obsidian';

interface FileContentMoveLocalization {
	menuItemLabel: string;
	moveFailureNotice: string;
	moveNotice: (sourceName: string, targetName: string) => string;
	sameFileNotice: string;
	sourceMissingNotice: string;
	targetMissingNotice: string;
	undoCommandName: string;
	undoFailureNotice: string;
	undoNoOperationNotice: string;
	undoSourceConflictNotice: string;
	undoSuccessNotice: string;
}

const ENGLISH_LOCALIZATION: FileContentMoveLocalization = {
	menuItemLabel: 'Send to editor cursor',
	moveFailureNotice: 'Could not move the source file content.',
	moveNotice: (sourceName, targetName) => `Moved ${sourceName} into ${targetName}.`,
	sameFileNotice: 'Choose a different target file.',
	sourceMissingNotice: 'The selected source file no longer exists.',
	targetMissingNotice: 'Open a Markdown editor and place the cursor where the content should be inserted.',
	undoCommandName: 'Undo last sent content move',
	undoFailureNotice: 'Could not undo the last sent content move.',
	undoNoOperationNotice: 'There is no sent content move to undo.',
	undoSourceConflictNotice: 'The original source path is already occupied.',
	undoSuccessNotice: 'Undid the last sent content move.',
};

const CHINESE_LOCALIZATION: FileContentMoveLocalization = {
	menuItemLabel: '发送到编辑器光标处',
	moveFailureNotice: '无法移动源文件内容。',
	moveNotice: (sourceName, targetName) => `已将 ${sourceName} 移入 ${targetName}。`,
	sameFileNotice: '请选择另一个目标文件。',
	sourceMissingNotice: '选中的源文件已不存在。',
	targetMissingNotice: '请先打开 Markdown 编辑器，并把光标放到要插入的位置。',
	undoCommandName: '撤销上一次发送内容移动',
	undoFailureNotice: '无法撤销上一次发送内容移动。',
	undoNoOperationNotice: '没有可撤销的发送内容移动。',
	undoSourceConflictNotice: '原始源文件路径已被占用。',
	undoSuccessNotice: '已撤销上一次发送内容移动。',
};

export function getFileContentMoveLocalization(): FileContentMoveLocalization {
	return resolveLanguage().startsWith('zh') ? CHINESE_LOCALIZATION : ENGLISH_LOCALIZATION;
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
