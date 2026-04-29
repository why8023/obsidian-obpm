import {getLanguage} from 'obsidian';

interface PinnedProjectLocalization {
	clearCommandName: string;
	clearNotice: string;
	linkFailureNotice: string;
	noTargetNotice: string;
	pinCommandName: string;
	pinMenuItemLabel: string;
	pinNotice: (targetName: string) => string;
	targetMissingNotice: string;
	statusMissingText: string;
	statusMissingTooltip: (targetPath: string) => string;
	statusText: (targetName: string) => string;
	statusTooltip: (targetPath: string) => string;
	unpinMenuItemLabel: string;
}

const ENGLISH_LOCALIZATION: PinnedProjectLocalization = {
	clearCommandName: 'Clear pinned relation target',
	clearNotice: 'Cleared the pinned relation target.',
	linkFailureNotice: 'Failed to link the new file to the pinned relation target. Check the developer console for details.',
	noTargetNotice: 'The current file is not a Markdown file.',
	pinCommandName: 'Pin current file as relation target',
	pinMenuItemLabel: 'Pin as relation target',
	pinNotice: (targetName) => `Pinned relation target ${targetName}.`,
	targetMissingNotice: 'The pinned relation target no longer exists.',
	statusMissingText: 'Pinned: Missing',
	statusMissingTooltip: (targetPath) => `Pinned relation target is missing: ${targetPath}.`,
	statusText: (targetName) => `Pinned: ${targetName}`,
	statusTooltip: (targetPath) => `Pinned relation target: ${targetPath}.`,
	unpinMenuItemLabel: 'Unpin relation target',
};

const CHINESE_LOCALIZATION: PinnedProjectLocalization = {
	clearCommandName: '清除固定关联目标',
	clearNotice: '已清除固定关联目标。',
	linkFailureNotice: '把新文件关联到固定关联目标时失败，请打开开发者控制台查看详情。',
	noTargetNotice: '当前文件不是 Markdown 文件。',
	pinCommandName: '固定当前文件为关联目标',
	pinMenuItemLabel: '固定为关联目标',
	pinNotice: (targetName) => `已固定关联目标 ${targetName}。`,
	targetMissingNotice: '固定关联目标已不存在。',
	statusMissingText: '固定：丢失',
	statusMissingTooltip: (targetPath) => `固定关联目标不存在：${targetPath}。`,
	statusText: (targetName) => `固定：${targetName}`,
	statusTooltip: (targetPath) => `当前固定关联目标：${targetPath}。`,
	unpinMenuItemLabel: '取消固定关联目标',
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
