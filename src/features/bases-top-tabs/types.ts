import type {App, IconName, TFile} from 'obsidian';
import type {SaveSettingsOptions} from '../../save-settings-options';
import type {ProjectCandidate} from '../project-routing/types';
import type {OBPMPluginSettings} from '../../settings';

export interface BasesTopTabsPluginContext {
	app: App;
	createConfiguredFolderNoteForProject(project: ProjectCandidate): Promise<void>;
	settings: OBPMPluginSettings;
	debugFeatureLog(feature: string, enabled: boolean, message: string, details?: unknown): void;
	saveSettings(options?: SaveSettingsOptions): Promise<void>;
}

export interface BasesTopTabsView {
	icon: IconName;
	index: number;
	key: string;
	name: string;
	type: string;
}

export interface ParsedBaseFile {
	file: TFile;
	filePath: string;
	views: BasesTopTabsView[];
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
