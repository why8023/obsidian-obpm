import type {App} from 'obsidian';
import type {OBPMPluginSettings} from '../../settings';

export interface BasesGroupFoldPluginContext {
	app: App;
	settings: OBPMPluginSettings;
	debugFeatureLog(feature: string, enabled: boolean, message: string, details?: unknown): void;
	saveSettings(options?: {refreshFeatures?: boolean}): Promise<void>;
}

export interface BasesGroupFoldViewContext {
	filePath: string;
	viewStateKey: string;
}
