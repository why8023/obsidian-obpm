import {formatFrontmatterAutomationTime} from './frontmatter-automation-utils';
import {FrontmatterAutomationProjectMoveFileNameTime} from './frontmatter-automation-types';

interface BuildProjectMoveFileNameOptions {
	basename: string;
	extension: string;
	fileNameTime: FrontmatterAutomationProjectMoveFileNameTime;
	now: Date;
}

interface ProjectMoveFileName {
	basename: string;
	name: string;
}

const INVALID_FILE_NAME_CHARACTERS_PATTERN = /[\\/:*?"<>|]/g;

export function buildProjectMoveFileName(options: BuildProjectMoveFileNameOptions): ProjectMoveFileName {
	if (!options.fileNameTime.enabled) {
		return buildFileName(options.basename, options.extension);
	}

	const moveTime = formatMoveTime(options.now, options.fileNameTime.format);
	if (moveTime.length === 0) {
		return buildFileName(options.basename, options.extension);
	}

	const existingTimePattern = buildMoveTimePattern(options.fileNameTime.format);
	const basename = existingTimePattern.test(options.basename)
		? options.basename.replace(existingTimePattern, moveTime)
		: insertMoveTime(options.basename, moveTime, options.fileNameTime.position);

	return buildFileName(basename, options.extension);
}

function buildFileName(basename: string, extension: string): ProjectMoveFileName {
	return {
		basename,
		name: extension.length > 0 ? `${basename}.${extension}` : basename,
	};
}

function buildMoveTimePattern(format: string): RegExp {
	const sanitizedFormat = sanitizeFileNameText(format.trim());
	const pattern = sanitizedFormat.replace(/YYYY|MM|DD|HH|mm|ss|./g, (token) => {
		switch (token) {
			case 'YYYY':
				return '\\d{4}';
			case 'MM':
			case 'DD':
			case 'HH':
			case 'mm':
			case 'ss':
				return '\\d{2}';
			default:
				return escapeRegExp(token);
		}
	});

	return new RegExp(pattern);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatMoveTime(now: Date, format: string): string {
	return sanitizeFileNameText(formatFrontmatterAutomationTime(now, format)).trim();
}

function insertMoveTime(
	basename: string,
	moveTime: string,
	position: FrontmatterAutomationProjectMoveFileNameTime['position'],
): string {
	return position === 'prefix'
		? `${moveTime} ${basename}`
		: `${basename} ${moveTime}`;
}

function sanitizeFileNameText(value: string): string {
	return value.replace(INVALID_FILE_NAME_CHARACTERS_PATTERN, '-');
}
