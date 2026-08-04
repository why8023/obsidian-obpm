import {getLanguage} from 'obsidian';

interface BasesGroupFoldLocalization {
	collapseAllGroupsLabel: string;
	collapseGroupLabel: (groupLabel: string) => string;
	expandAllGroupsLabel: string;
	expandGroupLabel: (groupLabel: string) => string;
}

const ENGLISH_LOCALIZATION: BasesGroupFoldLocalization = {
	collapseAllGroupsLabel: 'Collapse all groups',
	collapseGroupLabel: (groupLabel) => groupLabel
		? `Collapse group ${groupLabel}`
		: 'Collapse group',
	expandAllGroupsLabel: 'Expand all groups',
	expandGroupLabel: (groupLabel) => groupLabel
		? `Expand group ${groupLabel}`
		: 'Expand group',
};

const CHINESE_LOCALIZATION: BasesGroupFoldLocalization = {
	collapseAllGroupsLabel: '折叠全部分组',
	collapseGroupLabel: (groupLabel) => groupLabel
		? `折叠分组 ${groupLabel}`
		: '折叠分组',
	expandAllGroupsLabel: '展开全部分组',
	expandGroupLabel: (groupLabel) => groupLabel
		? `展开分组 ${groupLabel}`
		: '展开分组',
};

export function getBasesGroupFoldLocalization(): BasesGroupFoldLocalization {
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
