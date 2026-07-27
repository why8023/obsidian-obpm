import {
	ProjectListSortBy,
	ProjectListSortDirection,
	normalizeBaseViewName,
	normalizeConfiguredBaseFilePath,
	normalizeConfiguredFolderPath,
} from './configured-folder-note-utils';

export interface ConfiguredFolderNoteSettings {
	baseFilePath: string;
	baseViewName: string;
	enabled: boolean;
	includeFilterDefaults: boolean;
	projectInboxFolderPath: string;
	projectListSortBy: ProjectListSortBy;
	projectListSortDirection: ProjectListSortDirection;
}

export interface ConfiguredFolderNoteSettingsInput {
	baseFilePath?: unknown;
	baseViewName?: unknown;
	enabled?: unknown;
	includeFilterDefaults?: unknown;
	projectInboxFolderPath?: unknown;
	projectListSortBy?: unknown;
	projectListSortDirection?: unknown;
	/** Legacy fixed-folder setting retained so older saved data remains valid. */
	targetFolderPath?: unknown;
}

export const DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS: ConfiguredFolderNoteSettings = {
	baseFilePath: '',
	baseViewName: '',
	enabled: false,
	includeFilterDefaults: false,
	projectInboxFolderPath: 'inbox',
	projectListSortBy: 'name',
	projectListSortDirection: 'asc',
};

export function normalizeConfiguredFolderNoteSettings(
	settings: ConfiguredFolderNoteSettingsInput | null | undefined,
): ConfiguredFolderNoteSettings {
	return {
		baseFilePath: normalizeConfiguredBaseFilePath(settings?.baseFilePath),
		baseViewName: normalizeBaseViewName(settings?.baseViewName),
		enabled: typeof settings?.enabled === 'boolean'
			? settings.enabled
			: DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS.enabled,
		includeFilterDefaults: typeof settings?.includeFilterDefaults === 'boolean'
			? settings.includeFilterDefaults
			: DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS.includeFilterDefaults,
		projectInboxFolderPath: normalizeProjectInboxFolderPath(settings?.projectInboxFolderPath),
		projectListSortBy: normalizeProjectListSortBy(settings?.projectListSortBy),
		projectListSortDirection: normalizeProjectListSortDirection(settings?.projectListSortDirection),
	};
}

export function normalizeProjectInboxFolderPath(value: unknown): string {
	return normalizeConfiguredFolderPath(value) || DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS.projectInboxFolderPath;
}

export function normalizeProjectListSortBy(value: unknown): ProjectListSortBy {
	return value === 'created' || value === 'modified' ? value : 'name';
}

export function normalizeProjectListSortDirection(value: unknown): ProjectListSortDirection {
	return value === 'desc' ? value : 'asc';
}
