import {
	normalizeBaseViewName,
	normalizeConfiguredBaseFilePath,
	normalizeConfiguredFolderPath,
} from './configured-folder-note-utils';

export interface ConfiguredFolderNoteSettings {
	baseFilePath: string;
	baseViewName: string;
	enabled: boolean;
	includeFilterDefaults: boolean;
	targetFolderPath: string;
}

export interface ConfiguredFolderNoteSettingsInput {
	baseFilePath?: unknown;
	baseViewName?: unknown;
	enabled?: unknown;
	includeFilterDefaults?: unknown;
	targetFolderPath?: unknown;
}

export const DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS: ConfiguredFolderNoteSettings = {
	baseFilePath: '',
	baseViewName: '',
	enabled: false,
	includeFilterDefaults: false,
	targetFolderPath: '',
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
		targetFolderPath: normalizeConfiguredFolderPath(settings?.targetFolderPath),
	};
}
