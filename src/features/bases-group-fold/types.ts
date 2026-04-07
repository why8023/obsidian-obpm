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

export interface BasesTableGroupKey {
	toString?: () => string;
}

export interface BasesTableGroup {
	entries: unknown[];
	key?: BasesTableGroupKey;
}

export interface BasesTableData {
	groupedData?: BasesTableGroup[];
	groupedDataCache?: BasesTableGroup[] | null;
}

export interface BasesTableView {
	config?: {
		groupBy?: {
			property?: string;
		};
	};
	containerEl?: HTMLElement;
	data?: BasesTableData;
	display?: () => void;
	scrollEl?: HTMLElement;
	updateVirtualDisplay?: () => void;
	__obpmBasesGroupFoldGroupCountMap?: Record<string, number>;
	__obpmBasesGroupFoldOriginalGroupedData?: BasesTableGroup[];
	__obpmBasesGroupFoldOriginalUpdateVirtualDisplay?: (() => void) | null;
}
