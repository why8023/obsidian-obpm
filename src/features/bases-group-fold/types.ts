import type {App} from 'obsidian';
import type {SaveSettingsOptions} from '../../save-settings-options';
import type {OBPMPluginSettings} from '../../settings';

export interface BasesGroupFoldPluginContext {
	app: App;
	settings: OBPMPluginSettings;
	debugFeatureLog(feature: string, enabled: boolean, message: string, details?: unknown): void;
	saveSettings(options?: SaveSettingsOptions): Promise<void>;
}

export interface BasesGroupFoldViewContext {
	filePath: string;
	viewStateKey: string;
}
