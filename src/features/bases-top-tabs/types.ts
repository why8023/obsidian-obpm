import type {App, IconName} from 'obsidian';
import type {OBPMPluginSettings} from '../../settings';

export interface BasesTopTabsPluginContext {
	app: App;
	settings: OBPMPluginSettings;
	debugFeatureLog(feature: string, enabled: boolean, message: string, details?: unknown): void;
}

export interface BasesTopTabsView {
	icon: IconName;
	key: string;
	name: string;
	type: string;
}

export interface ParsedBaseFile {
	duplicateViewNames: string[];
	filePath: string;
	views: BasesTopTabsView[];
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
