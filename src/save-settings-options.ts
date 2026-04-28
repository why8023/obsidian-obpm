export type RefreshableFeatureId =
	| 'basesFileReveal'
	| 'basesGroupFold'
	| 'basesTopTabs'
	| 'fileContentMove'
	| 'relatedLinks'
	| 'fileNameSync'
	| 'projectRouting'
	| 'frontmatterAutomation'
	| 'relatedDocumentWorkflow'
	| 'pinnedProject';

export interface SaveSettingsOptions {
	refreshFeatures?: false | readonly RefreshableFeatureId[];
}
