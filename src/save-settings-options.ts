export type RefreshableFeatureId = 'basesFileReveal' | 'basesGroupFold' | 'basesTopTabs' | 'relatedLinks' | 'fileNameSync';

export interface SaveSettingsOptions {
	refreshFeatures?: false | readonly RefreshableFeatureId[];
}
