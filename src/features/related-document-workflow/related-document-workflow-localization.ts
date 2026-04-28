import {getLanguage} from 'obsidian';

export interface RelatedDocumentWorkflowLocalization {
	commandName: string;
	disabledNotice: string;
	failureNotice: string;
	moveSummaryNotice: (movedCount: number, skippedCount: number, failedCount: number) => string;
	noRelatedDocumentsNotice: string;
	relatedLinksDisabledNotice: string;
	undoCommandName: string;
	undoFailureNotice: string;
	undoNoHistoryNotice: string;
	undoSummaryNotice: (undoneCount: number, skippedCount: number, failedCount: number) => string;
}

const ENGLISH_LOCALIZATION: RelatedDocumentWorkflowLocalization = {
	commandName: 'Move related documents into project folder',
	disabledNotice: 'Related document workflow is disabled.',
	failureNotice: 'Failed to move related documents. Check the developer console for details.',
	moveSummaryNotice: (movedCount, skippedCount, failedCount) =>
		`Moved ${movedCount} related document${movedCount === 1 ? '' : 's'}. Skipped ${skippedCount}. Failed ${failedCount}.`,
	noRelatedDocumentsNotice: 'No related documents need to be moved.',
	relatedLinksDisabledNotice: 'Enable related links before moving related documents.',
	undoCommandName: 'Undo related document move',
	undoFailureNotice: 'Failed to undo related document moves. Check the developer console for details.',
	undoNoHistoryNotice: 'No related document move is available to undo.',
	undoSummaryNotice: (undoneCount, skippedCount, failedCount) =>
		`Undid ${undoneCount} related document move${undoneCount === 1 ? '' : 's'}. Skipped ${skippedCount}. Failed ${failedCount}.`,
};

const CHINESE_LOCALIZATION: RelatedDocumentWorkflowLocalization = {
	commandName: '移动关联文档到项目文件夹',
	disabledNotice: '关联文档工作流未启用。',
	failureNotice: '移动关联文档失败，请打开开发者控制台查看详情。',
	moveSummaryNotice: (movedCount, skippedCount, failedCount) =>
		`已移动 ${movedCount} 个关联文档。跳过 ${skippedCount} 个，失败 ${failedCount} 个。`,
	noRelatedDocumentsNotice: '没有需要移动的关联文档。',
	relatedLinksDisabledNotice: '请先启用关联功能，再移动关联文档。',
	undoCommandName: '撤销上次关联文档移动',
	undoFailureNotice: '撤销关联文档移动失败，请打开开发者控制台查看详情。',
	undoNoHistoryNotice: '没有可撤销的关联文档移动。',
	undoSummaryNotice: (undoneCount, skippedCount, failedCount) =>
		`已撤销 ${undoneCount} 个关联文档移动。跳过 ${skippedCount} 个，失败 ${failedCount} 个。`,
};

export function getRelatedDocumentWorkflowLocalization(): RelatedDocumentWorkflowLocalization {
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
