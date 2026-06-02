export type RefreshableFeatureId =
	| 'basesFileReveal'
	| 'basesGroupFold'
	| 'basesTopTabs'
	| 'fileContentMove'
	| 'relatedLinks'
	| 'fileNameSync'
	| 'projectFolder'
	| 'projectRouting'
	| 'frontmatterAutomation'
	| 'relatedDocumentWorkflow'
	| 'pinnedRelationTarget';

export interface SaveSettingsOptions {
	refreshFeatures?: false | readonly RefreshableFeatureId[];
}
