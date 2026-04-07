export type RefreshableFeatureId = 'basesGroupFold' | 'basesTopTabs' | 'relatedLinks' | 'fileNameSync';

export interface SaveSettingsOptions {
	refreshFeatures?: false | readonly RefreshableFeatureId[];
}
