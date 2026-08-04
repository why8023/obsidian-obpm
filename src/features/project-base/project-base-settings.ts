import {normalizeConfiguredBaseFilePath} from '../configured-folder-note/configured-folder-note-utils';

export const DEFAULT_PROJECT_BASE_PROPERTIES = [
	'obpm_archive',
	'file.name',
	'obpm_merge',
	'obpm_related',
	'member',
	'obpm_status',
	'obpm_start_time',
	'obpm_end_time',
	'formula.task_time',
	'formula.file_time',
	'file.ctime',
	'file.mtime',
];

export interface ProjectBaseSettings {
	baseFilePath: string;
	enabled: boolean;
	projectViewProperties: string[];
	totalViewProperties: string[];
}

export const DEFAULT_PROJECT_BASE_SETTINGS: ProjectBaseSettings = {
	baseFilePath: 'obpm.base',
	enabled: false,
	projectViewProperties: [...DEFAULT_PROJECT_BASE_PROPERTIES],
	totalViewProperties: [...DEFAULT_PROJECT_BASE_PROPERTIES],
};

export function normalizeProjectBaseSettings(value: unknown): ProjectBaseSettings {
	const input = isObjectRecord(value) ? value : {};
	return {
		baseFilePath: normalizeConfiguredBaseFilePath(input.baseFilePath) || DEFAULT_PROJECT_BASE_SETTINGS.baseFilePath,
		enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_PROJECT_BASE_SETTINGS.enabled,
		projectViewProperties: normalizeProjectBasePropertyList(
			input.projectViewProperties,
			DEFAULT_PROJECT_BASE_SETTINGS.projectViewProperties,
		),
		totalViewProperties: normalizeProjectBasePropertyList(
			input.totalViewProperties,
			DEFAULT_PROJECT_BASE_SETTINGS.totalViewProperties,
		),
	};
}

export function normalizeProjectBasePropertyList(
	value: unknown,
	fallback: readonly string[] = DEFAULT_PROJECT_BASE_PROPERTIES,
): string[] {
	const values = Array.isArray(value) ? value : [value];
	const normalized = values
		.flatMap((entry) => typeof entry === 'string' ? entry.split(/[\r\n,]+/) : [])
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	return [...new Set(normalized.length > 0 ? normalized : fallback)];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
