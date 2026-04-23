import {getLanguage} from 'obsidian';

interface FileContentMoveLocalization {
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
	moveFailureNotice: 'Could not move the source file content.',
	moveNotice: (sourceName, targetName) => `Moved ${sourceName} into ${targetName}.`,
	sameFileNotice: 'Choose a different target file.',
	sourceMissingNotice: 'The dragged source file no longer exists.',
	targetMissingNotice: 'Drop onto an open Markdown editor.',
	undoCommandName: 'Undo last dragged content move',
	undoFailureNotice: 'Could not undo the last dragged content move.',
	undoNoOperationNotice: 'There is no dragged content move to undo.',
	undoSourceConflictNotice: 'The original source path is already occupied.',
	undoSuccessNotice: 'Undid the last dragged content move.',
};

const CHINESE_LOCALIZATION: FileContentMoveLocalization = {
	moveFailureNotice: '无法移动源文件内容。',
	moveNotice: (sourceName, targetName) => `已将 ${sourceName} 移入 ${targetName}。`,
	sameFileNotice: '请选择另一个目标文件。',
	sourceMissingNotice: '拖动的源文件已不存在。',
	targetMissingNotice: '请拖放到已打开的 Markdown 编辑器中。',
	undoCommandName: '撤销上一次拖拽内容移动',
	undoFailureNotice: '无法撤销上一次拖拽内容移动。',
	undoNoOperationNotice: '没有可撤销的拖拽内容移动。',
	undoSourceConflictNotice: '原始源文件路径已被占用。',
	undoSuccessNotice: '已撤销上一次拖拽内容移动。',
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
