export type RefreshableFeatureId =
	| 'basesFileReveal'
	| 'basesGroupFold'
	| 'basesTopTabs'
	| 'fileContentMove'
	| 'relatedLinks'
	| 'fileNameSync'
	| 'projectRouting'
	| 'frontmatterAutomation';

export interface SaveSettingsOptions {
	refreshFeatures?: false | readonly RefreshableFeatureId[];
}
