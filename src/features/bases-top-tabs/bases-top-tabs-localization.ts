import {getLanguage} from 'obsidian';

interface BasesTopTabsLocalization {
	switchErrorNotice: string;
	tabListLabel: string;
	viewCountLabel: (count: number) => string;
}

const ENGLISH_LOCALIZATION: BasesTopTabsLocalization = {
	switchErrorNotice: 'Failed to switch Base view. Check the developer console for details.',
	tabListLabel: 'Base views',
	viewCountLabel: (count) => count === 1 ? '1 view' : `${count} views`,
};

const CHINESE_LOCALIZATION: BasesTopTabsLocalization = {
	switchErrorNotice: '切换 Base 视图失败，请打开开发者控制台查看详情。',
	tabListLabel: 'Base 视图',
	viewCountLabel: (count) => `${count} 个视图`,
};

export function getBasesTopTabsLocalization(): BasesTopTabsLocalization {
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
