import {normalizeProjectParentFolderPath} from './project-folder-utils';

export interface ProjectFolderSettings {
	createProjectCommandEnabled: boolean;
	createProjectParentFolderPath: string;
	enabled: boolean;
}

export interface ProjectFolderSettingsInput {
	createProjectCommandEnabled?: unknown;
	createProjectParentFolderPath?: unknown;
	enabled?: unknown;
}

export const DEFAULT_PROJECT_FOLDER_SETTINGS: ProjectFolderSettings = {
	createProjectCommandEnabled: true,
	createProjectParentFolderPath: '',
	enabled: true,
};

export function normalizeProjectFolderSettings(
	settings: ProjectFolderSettingsInput | null | undefined,
): ProjectFolderSettings {
	return {
		createProjectCommandEnabled: typeof settings?.createProjectCommandEnabled === 'boolean'
			? settings.createProjectCommandEnabled
			: DEFAULT_PROJECT_FOLDER_SETTINGS.createProjectCommandEnabled,
		createProjectParentFolderPath: normalizeProjectParentFolderPath(settings?.createProjectParentFolderPath),
		enabled: typeof settings?.enabled === 'boolean'
			? settings.enabled
			: DEFAULT_PROJECT_FOLDER_SETTINGS.enabled,
	};
}
