import {getLanguage} from 'obsidian';

export interface SettingsLocalization {
	relatedLinksHeading: string;
	enableRelatedLinksName: string;
	enableRelatedLinksDesc: string;
	relationPropertyName: string;
	relationPropertyDesc: string;
	relationPropertyPlaceholder: string;
	displayPropertyName: string;
	displayPropertyDesc: string;
	displayPropertyPlaceholder: string;
	verboseLoggingName: string;
	verboseLoggingDesc: string;
	fileNameSyncHeading: string;
	enableFileNameSyncName: string;
	enableFileNameSyncDesc: string;
	fileNamePropertyName: string;
	fileNamePropertyDesc: string;
	fileNamePropertyPlaceholder: string;
	invalidCharacterReplacementName: string;
	invalidCharacterReplacementDesc: string;
	invalidCharacterReplacementPlaceholder: string;
	invalidCharacterReplacementNotice: string;
	maxFileNameLengthName: string;
	maxFileNameLengthDesc: (min: number, max: number, defaultValue: number) => string;
	maxFileNameLengthNotice: (min: number, max: number) => string;
}

const ENGLISH_SETTINGS_LOCALIZATION: SettingsLocalization = {
	relatedLinksHeading: 'Related frontmatter links',
	enableRelatedLinksName: 'Enable related frontmatter links',
	enableRelatedLinksDesc: 'Automatically add this note into the notes referenced by a frontmatter property.',
	relationPropertyName: 'Relation property',
	relationPropertyDesc: 'Frontmatter property that points to the related notes, for example related.',
	relationPropertyPlaceholder: 'Enter relation property',
	displayPropertyName: 'Display property',
	displayPropertyDesc: 'Frontmatter property used as the link label. Falls back to the file name when empty.',
	displayPropertyPlaceholder: 'Enter display property',
	verboseLoggingName: 'Verbose logging',
	verboseLoggingDesc: 'Write detailed related-links synchronization logs to the developer console.',
	fileNameSyncHeading: 'File names from property',
	enableFileNameSyncName: 'Enable file name sync',
	enableFileNameSyncDesc: 'Rename markdown files to match a frontmatter property when that property is present.',
	fileNamePropertyName: 'File name property',
	fileNamePropertyDesc: 'Frontmatter property used to build the file name. Files without this property are left unchanged.',
	fileNamePropertyPlaceholder: 'Enter file name property',
	invalidCharacterReplacementName: 'Invalid character replacement',
	invalidCharacterReplacementDesc: 'Replacement text for characters that are not allowed in file names. Leave empty to remove them.',
	invalidCharacterReplacementPlaceholder: 'Enter replacement text',
	invalidCharacterReplacementNotice: 'Replacement text cannot include characters that are invalid in file names.',
	maxFileNameLengthName: 'Maximum file name length',
	maxFileNameLengthDesc: (min, max, defaultValue) => `Limit the markdown file basename to ${min}-${max} characters. Default: ${defaultValue}.`,
	maxFileNameLengthNotice: (min, max) => `Maximum file name length must be between ${min} and ${max}.`,
};

const CHINESE_SETTINGS_LOCALIZATION: SettingsLocalization = {
	relatedLinksHeading: '关联属性链接',
	enableRelatedLinksName: '启用关联属性链接',
	enableRelatedLinksDesc: '当某个属性引用了其他笔记时，自动把当前笔记回填到那些被引用笔记里。',
	relationPropertyName: '关联属性名',
	relationPropertyDesc: '指向关联笔记的属性名，例如 related。',
	relationPropertyPlaceholder: '输入关联属性名',
	displayPropertyName: '显示属性名',
	displayPropertyDesc: '用作链接显示文本的属性名。留空时回退为文件名。',
	displayPropertyPlaceholder: '输入显示属性名',
	verboseLoggingName: '详细日志',
	verboseLoggingDesc: '将关联链接同步的详细日志输出到开发者控制台。',
	fileNameSyncHeading: '根据属性同步文件名',
	enableFileNameSyncName: '启用文件名同步',
	enableFileNameSyncDesc: '当指定属性存在时，将 Markdown 文件重命名为该属性的值。',
	fileNamePropertyName: '文件名属性',
	fileNamePropertyDesc: '用于生成文件名的属性名。没有该属性的文件会保持不变。',
	fileNamePropertyPlaceholder: '输入文件名属性',
	invalidCharacterReplacementName: '非法字符替换',
	invalidCharacterReplacementDesc: '当文件名里出现非法字符时，用这里的文本替换。留空则直接移除。',
	invalidCharacterReplacementPlaceholder: '输入替换文本',
	invalidCharacterReplacementNotice: '替换文本不能包含文件名非法字符。',
	maxFileNameLengthName: '文件名最大长度',
	maxFileNameLengthDesc: (min, max, defaultValue) => `将 Markdown 文件名限制在 ${min}-${max} 个字符之间。默认值：${defaultValue}。`,
	maxFileNameLengthNotice: (min, max) => `文件名最大长度必须在 ${min} 到 ${max} 之间。`,
};

export function getSettingsLocalization(): SettingsLocalization {
	const language = resolveLanguage();
	return language.startsWith('zh') ? CHINESE_SETTINGS_LOCALIZATION : ENGLISH_SETTINGS_LOCALIZATION;
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
