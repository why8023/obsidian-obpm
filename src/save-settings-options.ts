export type RefreshableFeatureId =
	| 'basesFileReveal'
	| 'basesGroupFold'
	| 'basesTopTabs'
	| 'relatedLinks'
	| 'fileNameSync'
	| 'projectRouting'
	| 'frontmatterAutomation';

export interface SaveSettingsOptions {
	refreshFeatures?: false | readonly RefreshableFeatureId[];
}
