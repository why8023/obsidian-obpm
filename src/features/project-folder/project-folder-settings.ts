export interface ProjectFolderSettings {
	enabled: boolean;
}

export interface ProjectFolderSettingsInput {
	enabled?: unknown;
}

export const DEFAULT_PROJECT_FOLDER_SETTINGS: ProjectFolderSettings = {
	enabled: true,
};

export function normalizeProjectFolderSettings(
	settings: ProjectFolderSettingsInput | null | undefined,
): ProjectFolderSettings {
	return {
		enabled: typeof settings?.enabled === 'boolean'
			? settings.enabled
			: DEFAULT_PROJECT_FOLDER_SETTINGS.enabled,
	};
}
