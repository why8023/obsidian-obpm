import {getLanguage} from 'obsidian';

interface ProjectContentActionLocalization {
	ambiguousProjectNotice: string;
	failureNotice: string;
	noProjectNotice: string;
	sameFileNotice: string;
	successNotice: (sourceName: string, projectName: string) => string;
}

const ENGLISH_LOCALIZATION: ProjectContentActionLocalization = {
	ambiguousProjectNotice: 'Multiple project files match this file. Content was not sent.',
	failureNotice: 'Could not send the source content to the project file.',
	noProjectNotice: 'No project file is associated with this file.',
	sameFileNotice: 'The source file is already the target project file.',
	successNotice: (sourceName, projectName) => `Sent ${sourceName} into ${projectName}.`,
};

const CHINESE_LOCALIZATION: ProjectContentActionLocalization = {
	ambiguousProjectNotice: '当前文件匹配到多个项目文件，未发送内容。',
	failureNotice: '无法将源文件内容发送到项目文件。',
	noProjectNotice: '当前文件没有关联到项目文件。',
	sameFileNotice: '源文件已经是目标项目文件，未发送内容。',
	successNotice: (sourceName, projectName) => `已将 ${sourceName} 发送到 ${projectName}。`,
};

export function getProjectContentActionLocalization(): ProjectContentActionLocalization {
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
