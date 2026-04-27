import {getLanguage} from 'obsidian';

export interface SettingsLocalization {
	settingsPageTitle: string;
	settingsPageDesc: string;
	settingsTabBases: string;
	settingsTabBasesDesc: string;
	settingsTabMetadata: string;
	settingsTabMetadataDesc: string;
	settingsTabAutomation: string;
	settingsTabAutomationDesc: string;
	settingsTabProject: string;
	settingsTabProjectDesc: string;
	settingsTabWorkflow: string;
	settingsTabWorkflowDesc: string;
	basesFileRevealEnableDesc: string;
	basesFileRevealEnableName: string;
	basesFileRevealHeading: string;
	basesGroupFoldDebugModeDesc: string;
	basesGroupFoldDebugModeName: string;
	basesGroupFoldEnableDesc: string;
	basesGroupFoldEnableName: string;
	basesGroupFoldHeading: string;
	basesGroupFoldRememberStateDesc: string;
	basesGroupFoldRememberStateName: string;
	basesTopTabsAutoRefreshDesc: string;
	basesTopTabsAutoRefreshName: string;
	basesTopTabsDebugModeDesc: string;
	basesTopTabsDebugModeName: string;
	basesTopTabsEnableDesc: string;
	basesTopTabsEnableName: string;
	basesTopTabsHeading: string;
	basesTopTabsHideWhenSingleViewDesc: string;
	basesTopTabsHideWhenSingleViewName: string;
	basesTopTabsMaxVisibleTabsDesc: (min: number, max: number, defaultValue: number) => string;
	basesTopTabsMaxVisibleTabsName: string;
	basesTopTabsMaxVisibleTabsNotice: (min: number, max: number) => string;
	basesTopTabsOrientationDesc: string;
	basesTopTabsOrientationHorizontalLabel: string;
	basesTopTabsOrientationName: string;
	basesTopTabsOrientationVerticalLabel: string;
	basesTopTabsPlacementAboveToolbarLabel: string;
	basesTopTabsPlacementDesc: string;
	basesTopTabsPlacementInsideToolbarLabel: string;
	basesTopTabsPlacementName: string;
	basesTopTabsRememberLastViewDesc: string;
	basesTopTabsRememberLastViewName: string;
	basesTopTabsScrollableDesc: string;
	basesTopTabsScrollableName: string;
	basesTopTabsShowIconsDesc: string;
	basesTopTabsShowIconsName: string;
	basesTopTabsShowViewCountDesc: string;
	basesTopTabsShowViewCountName: string;
	fileContentMoveEnableDesc: string;
	fileContentMoveEnableName: string;
	fileContentMoveFileExplorerDesc: string;
	fileContentMoveFileExplorerName: string;
	fileContentMoveHeading: string;
	fileContentMoveStripSingleH1Desc: string;
	fileContentMoveStripSingleH1Name: string;
	relatedLinksHeading: string;
	enableRelatedLinksName: string;
	enableRelatedLinksDesc: string;
	relationPropertyName: string;
	relationPropertyDesc: string;
	relationPropertyPlaceholder: string;
	displayPropertyName: string;
	displayPropertyDesc: string;
	displayPropertyPlaceholder: string;
	inboxHeadingName: string;
	inboxHeadingDesc: string;
	inboxHeadingPlaceholder: string;
	includeInheritedRelatedLinksName: string;
	includeInheritedRelatedLinksDesc: string;
	missingLinkGracePeriodName: string;
	missingLinkGracePeriodDesc: (min: number, max: number, defaultValue: number) => string;
	missingLinkGracePeriodNotice: (min: number, max: number) => string;
	verboseLoggingName: string;
	verboseLoggingDesc: string;
	fileNameSyncHeading: string;
	enableFileNameSyncName: string;
	enableFileNameSyncDesc: string;
	fileNamePropertyName: string;
	fileNamePropertyDesc: string;
	fileNamePropertyPlaceholder: string;
	invalidCharacterReplacementName: string;
	invalidCharacterReplacementDesc: string;
	invalidCharacterReplacementPlaceholder: string;
	invalidCharacterReplacementNotice: string;
	maxFileNameLengthName: string;
	maxFileNameLengthDesc: (min: number, max: number, defaultValue: number) => string;
	maxFileNameLengthNotice: (min: number, max: number) => string;
	frontmatterAutomationHeading: string;
	frontmatterAutomationEnableName: string;
	frontmatterAutomationEnableDesc: string;
	frontmatterAutomationTimeFormatName: string;
	frontmatterAutomationTimeFormatDesc: string;
	frontmatterAutomationTimeFormatPlaceholder: string;
	frontmatterAutomationRulesHeading: string;
	frontmatterAutomationRulesDesc: string;
	frontmatterAutomationRuleLabel: (index: number) => string;
	frontmatterAutomationNoRules: string;
	frontmatterAutomationAddRuleName: string;
	frontmatterAutomationAddRuleDesc: string;
	frontmatterAutomationAddRuleButton: string;
	frontmatterAutomationRemoveRuleName: string;
	frontmatterAutomationRemoveRuleDesc: string;
	frontmatterAutomationRemoveRuleButton: string;
	frontmatterAutomationRuleEnabledName: string;
	frontmatterAutomationRuleEnabledDesc: string;
	frontmatterAutomationTriggerFieldName: string;
	frontmatterAutomationTriggerFieldDesc: string;
	frontmatterAutomationTriggerFieldPlaceholder: string;
	frontmatterAutomationTriggerOperatorName: string;
	frontmatterAutomationTriggerOperatorDesc: string;
	frontmatterAutomationTriggerOperatorContainsLabel: string;
	frontmatterAutomationTriggerOperatorEqualsLabel: string;
	frontmatterAutomationTriggerValueName: string;
	frontmatterAutomationTriggerValueDesc: string;
	frontmatterAutomationTriggerValuePlaceholder: string;
	frontmatterAutomationActionTypeName: string;
	frontmatterAutomationActionTypeDesc: string;
	frontmatterAutomationActionTypeCurrentTimeLabel: string;
	frontmatterAutomationActionTypeStaticValueLabel: string;
	frontmatterAutomationActionTypeProjectFolderLabel: string;
	frontmatterAutomationTargetFieldName: string;
	frontmatterAutomationTargetFieldDesc: string;
	frontmatterAutomationTargetFieldPlaceholder: string;
	frontmatterAutomationStaticValueName: string;
	frontmatterAutomationStaticValueDesc: string;
	frontmatterAutomationStaticValuePlaceholder: string;
	frontmatterAutomationTargetSubfolderPathName: string;
	frontmatterAutomationTargetSubfolderPathDesc: string;
	frontmatterAutomationTargetSubfolderPathPlaceholder: string;
	frontmatterAutomationWriteModeName: string;
	frontmatterAutomationWriteModeDesc: string;
	frontmatterAutomationWriteModeAlwaysLabel: string;
	frontmatterAutomationWriteModeWhenEmptyLabel: string;
	projectRoutingHeading: string;
	projectRoutingEnableName: string;
	projectRoutingEnableDesc: string;
	projectRoutingAutoMoveName: string;
	projectRoutingAutoMoveDesc: string;
	projectRoutingShowStatusBarName: string;
	projectRoutingShowStatusBarDesc: string;
	projectRoutingShowNoticeName: string;
	projectRoutingShowNoticeDesc: string;
	projectRoutingDebugLogName: string;
	projectRoutingDebugLogDesc: string;
	projectRoutingProjectRuleHeading: string;
	projectRoutingProjectRuleDesc: string;
	projectRoutingSubfolderPathName: string;
	projectRoutingSubfolderPathDesc: string;
	projectRoutingSubfolderPathPlaceholder: string;
	projectRoutingDuplicateProjectDetectionName: string;
	projectRoutingDuplicateProjectDetectionDesc: string;
	projectRoutingRecognizeFilenameMatchesFolderNameName: string;
	projectRoutingRecognizeFilenameMatchesFolderNameDesc: string;
	projectRoutingProjectFileRulesHeading: string;
	projectRoutingProjectFileRulesDesc: string;
	projectRoutingProjectFileRuleLabel: (index: number) => string;
	projectRoutingNoProjectFileRules: string;
	projectRoutingProjectFileAddRuleName: string;
	projectRoutingProjectFileAddRuleDesc: string;
	projectRoutingProjectFileAddRuleButton: string;
	projectRoutingProjectFileRemoveRuleName: string;
	projectRoutingProjectFileRemoveRuleDesc: string;
	projectRoutingProjectFileRemoveRuleButton: string;
	projectRoutingRuleKeyName: string;
	projectRoutingRuleKeyDesc: string;
	projectRoutingRuleKeyPlaceholder: string;
	projectRoutingRuleMatchModeName: string;
	projectRoutingRuleMatchModeDesc: string;
	projectRoutingMatchModeKeyExistsLabel: string;
	projectRoutingMatchModeKeyValueEqualsLabel: string;
	projectRoutingRuleValueName: string;
	projectRoutingRuleValueDesc: string;
	projectRoutingRuleValuePlaceholder: string;
	projectRoutingRoutableRulesHeading: string;
	projectRoutingRoutableRulesDesc: string;
	projectRoutingRoutableRuleLabel: (index: number) => string;
	projectRoutingNoRoutableRules: string;
	projectRoutingAddRuleName: string;
	projectRoutingAddRuleDesc: string;
	projectRoutingAddRuleButton: string;
	projectRoutingRemoveRuleName: string;
	projectRoutingRemoveRuleDesc: string;
	projectRoutingRemoveRuleButton: string;
	projectRoutingCurrentFileCommandHeading: string;
	projectRoutingCurrentFileCommandDesc: string;
	projectRoutingCurrentFileCommandLimitName: string;
	projectRoutingCurrentFileCommandLimitDesc: string;
	projectRoutingCurrentFileCommandRulesHeading: string;
	projectRoutingCurrentFileCommandRulesDesc: string;
	projectRoutingCurrentFileCommandRuleLabel: (index: number) => string;
	projectRoutingCurrentFileCommandNoRules: string;
	projectRoutingCurrentFileCommandAddRuleName: string;
	projectRoutingCurrentFileCommandAddRuleDesc: string;
	projectRoutingCurrentFileCommandAddRuleButton: string;
	projectRoutingCurrentFileCommandRemoveRuleName: string;
	projectRoutingCurrentFileCommandRemoveRuleDesc: string;
	projectRoutingCurrentFileCommandRemoveRuleButton: string;
	sameFolderNoteHeading: string;
	enableSameFolderNoteName: string;
	enableSameFolderNoteDesc: string;
}

const ENGLISH_SETTINGS_LOCALIZATION: SettingsLocalization = {
	settingsPageTitle: 'OBPM settings',
	settingsPageDesc: 'Browse OBPM features by scenario. Tabs reduce scrolling, and each card keeps related options together.',
	settingsTabBases: 'Bases',
	settingsTabBasesDesc: 'Enhancements for native Bases views, including file reveal, group folding, and persistent top tabs.',
	settingsTabMetadata: 'Properties',
	settingsTabMetadataDesc: 'Keep project frontmatter-derived links and filenames tidy with property-focused behaviors.',
	settingsTabAutomation: 'Automation',
	settingsTabAutomationDesc: 'Define rules that watch frontmatter changes, write values, and route files into project folders.',
	settingsTabProject: 'Projects',
	settingsTabProjectDesc: 'Configure how markdown files are recognized as project files.',
	settingsTabWorkflow: 'Workflow',
	settingsTabWorkflowDesc: 'Commands that help move content and create project-adjacent notes faster.',
	basesFileRevealEnableDesc: 'Hold Alt and click a row or file link in a native Bases table view to reveal that file in the file explorer.',
	basesFileRevealEnableName: 'Enable Bases Alt-click reveal',
	basesFileRevealHeading: 'Bases file reveal',
	basesGroupFoldDebugModeDesc: 'Write detailed Bases group fold diagnostics to the developer console.',
	basesGroupFoldDebugModeName: 'Debug mode',
	basesGroupFoldEnableDesc: 'Add collapse and expand controls to grouped native Bases table views.',
	basesGroupFoldEnableName: 'Enable Bases group fold',
	basesGroupFoldHeading: 'Bases group fold',
	basesGroupFoldRememberStateDesc: 'Remember collapsed groups for each .base file and view.',
	basesGroupFoldRememberStateName: 'Remember collapsed state',
	basesTopTabsAutoRefreshDesc: 'Automatically refresh the tabs when the current .base file changes on disk.',
	basesTopTabsAutoRefreshName: 'Auto refresh',
	basesTopTabsDebugModeDesc: 'Write detailed Bases top tabs diagnostics to the developer console.',
	basesTopTabsDebugModeName: 'Debug mode',
	basesTopTabsEnableDesc: 'Show Base views as always-visible tabs on top of native .base pages.',
	basesTopTabsEnableName: 'Enable Bases top tabs',
	basesTopTabsHeading: 'Bases top tabs',
	basesTopTabsHideWhenSingleViewDesc: 'Hide the tab bar when the current Base only has one view.',
	basesTopTabsHideWhenSingleViewName: 'Hide when there is only one view',
	basesTopTabsMaxVisibleTabsDesc: (min, max, defaultValue) =>
		`Show a More menu after this many tabs. Use ${min} to disable overflow. Range: ${min}-${max}. Default: ${defaultValue}.`,
	basesTopTabsMaxVisibleTabsName: 'Maximum visible tabs',
	basesTopTabsMaxVisibleTabsNotice: (min, max) => `Maximum visible tabs must be between ${min} and ${max}.`,
	basesTopTabsOrientationDesc: 'Choose whether the tabs are arranged horizontally or as a vertical stack.',
	basesTopTabsOrientationHorizontalLabel: 'Horizontal',
	basesTopTabsOrientationName: 'Orientation',
	basesTopTabsOrientationVerticalLabel: 'Vertical',
	basesTopTabsPlacementAboveToolbarLabel: 'Above the toolbar',
	basesTopTabsPlacementDesc: 'Choose whether the tabs appear on their own row or inside the native Bases toolbar.',
	basesTopTabsPlacementInsideToolbarLabel: 'Inside the toolbar',
	basesTopTabsPlacementName: 'Placement',
	basesTopTabsRememberLastViewDesc: 'Reopen each .base file in the last view you selected there.',
	basesTopTabsRememberLastViewName: 'Remember last view per Base',
	basesTopTabsScrollableDesc: 'Allow horizontal scrolling instead of wrapping when there are many tabs.',
	basesTopTabsScrollableName: 'Allow horizontal scrolling',
	basesTopTabsShowIconsDesc: 'Display a view icon next to each tab label when one is available.',
	basesTopTabsShowIconsName: 'Show icons',
	basesTopTabsShowViewCountDesc: 'Show the number of views in the current Base next to the tabs.',
	basesTopTabsShowViewCountName: 'Show view count',
	fileContentMoveEnableDesc: 'Add a file context-menu action that sends a Markdown file into the current editor cursor position as a list, then deletes the source file using Obsidian trash settings.',
	fileContentMoveEnableName: 'Enable send content to cursor',
	fileContentMoveFileExplorerDesc: 'Show the send action on file explorer context-menu items.',
	fileContentMoveFileExplorerName: 'Enable in file explorer',
	fileContentMoveHeading: 'Send content to cursor',
	fileContentMoveStripSingleH1Desc: 'When the source note has exactly one level-1 heading, omit that heading and promote the remaining outline under the source file name.',
	fileContentMoveStripSingleH1Name: 'Remove single level-1 heading',
	relatedLinksHeading: 'Related frontmatter links',
	enableRelatedLinksName: 'Enable related frontmatter links',
	enableRelatedLinksDesc: 'Automatically add this note into the notes referenced by a frontmatter property.',
	relationPropertyName: 'Relation property',
	relationPropertyDesc: 'Frontmatter property that points to the related notes, for example related.',
	relationPropertyPlaceholder: 'Enter relation property',
	displayPropertyName: 'Display property',
	displayPropertyDesc: 'Frontmatter property used as the link label. Falls back to the file name when empty.',
	displayPropertyPlaceholder: 'Enter display property',
	inboxHeadingName: 'Inbox heading',
	inboxHeadingDesc: 'Missing related links are inserted as list items under the first matching level-2 heading.',
	inboxHeadingPlaceholder: 'Enter Inbox heading',
	includeInheritedRelatedLinksName: 'Include inherited related links',
	includeInheritedRelatedLinksDesc: 'Nest upstream sources under their source note when rebuilding managed related-link lists.',
	missingLinkGracePeriodName: 'Missing-link grace period',
	missingLinkGracePeriodDesc: (min, max, defaultValue) =>
		`Wait this many seconds before restoring a missing managed link. Range: ${min}-${max}. Default: ${defaultValue}.`,
	missingLinkGracePeriodNotice: (min, max) => `Missing-link grace period must be between ${min} and ${max} seconds.`,
	verboseLoggingName: 'Verbose logging',
	verboseLoggingDesc: 'Write detailed related-links synchronization logs to the developer console.',
	fileNameSyncHeading: 'File names from property',
	enableFileNameSyncName: 'Enable file name sync',
	enableFileNameSyncDesc: 'Rename markdown files to match a frontmatter property when that property is present.',
	fileNamePropertyName: 'File name property',
	fileNamePropertyDesc: 'Frontmatter property used to build the file name. Files without this property are left unchanged.',
	fileNamePropertyPlaceholder: 'Enter file name property',
	invalidCharacterReplacementName: 'Invalid character replacement',
	invalidCharacterReplacementDesc: 'Replacement text for characters that are not allowed in file names. Leave empty to remove them.',
	invalidCharacterReplacementPlaceholder: 'Enter replacement text',
	invalidCharacterReplacementNotice: 'Replacement text cannot include characters that are invalid in file names.',
	maxFileNameLengthName: 'Maximum file name length',
	maxFileNameLengthDesc: (min, max, defaultValue) => `Limit the markdown file basename to ${min}-${max} characters. Default: ${defaultValue}.`,
	maxFileNameLengthNotice: (min, max) => `Maximum file name length must be between ${min} and ${max}.`,
	frontmatterAutomationHeading: 'Frontmatter automation',
	frontmatterAutomationEnableName: 'Enable Frontmatter automation',
	frontmatterAutomationEnableDesc: 'Watch parsed frontmatter changes and update the same file when a rule matches.',
	frontmatterAutomationTimeFormatName: 'Time format',
	frontmatterAutomationTimeFormatDesc: 'Format used by the set-current-time action. Supported tokens: YYYY, MM, DD, HH, mm, ss.',
	frontmatterAutomationTimeFormatPlaceholder: 'YYYY-MM-DDTHH:mm:ss',
	frontmatterAutomationRulesHeading: 'Automation rules',
	frontmatterAutomationRulesDesc: 'A rule runs only when its trigger field changes into the configured value.',
	frontmatterAutomationRuleLabel: (index) => `Automation rule ${index}`,
	frontmatterAutomationNoRules: 'No frontmatter automation rules are configured.',
	frontmatterAutomationAddRuleName: 'Add automation rule',
	frontmatterAutomationAddRuleDesc: 'Append another frontmatter automation rule.',
	frontmatterAutomationAddRuleButton: 'Add rule',
	frontmatterAutomationRemoveRuleName: 'Remove automation rule',
	frontmatterAutomationRemoveRuleDesc: 'Delete this frontmatter automation rule from the list.',
	frontmatterAutomationRemoveRuleButton: 'Remove rule',
	frontmatterAutomationRuleEnabledName: 'Rule enabled',
	frontmatterAutomationRuleEnabledDesc: 'Turn this rule on or off without deleting it.',
	frontmatterAutomationTriggerFieldName: 'Trigger field',
	frontmatterAutomationTriggerFieldDesc: 'Frontmatter field that is observed for state changes.',
	frontmatterAutomationTriggerFieldPlaceholder: 'Enter trigger field',
	frontmatterAutomationTriggerOperatorName: 'Trigger operator',
	frontmatterAutomationTriggerOperatorDesc: 'How the trigger field is matched. Contains works well for wikilink-style values.',
	frontmatterAutomationTriggerOperatorContainsLabel: 'Contains',
	frontmatterAutomationTriggerOperatorEqualsLabel: 'Equals',
	frontmatterAutomationTriggerValueName: 'Trigger value',
	frontmatterAutomationTriggerValueDesc: 'The rule runs only when the trigger field changes into this exact value.',
	frontmatterAutomationTriggerValuePlaceholder: 'Enter trigger value',
	frontmatterAutomationActionTypeName: 'Action type',
	frontmatterAutomationActionTypeDesc: 'Choose whether the rule writes frontmatter or moves the file into its project folder.',
	frontmatterAutomationActionTypeCurrentTimeLabel: 'Set current time',
	frontmatterAutomationActionTypeStaticValueLabel: 'Set static value',
	frontmatterAutomationActionTypeProjectFolderLabel: 'Move into project folder',
	frontmatterAutomationTargetFieldName: 'Target field',
	frontmatterAutomationTargetFieldDesc: 'Frontmatter field that will be written when the rule triggers.',
	frontmatterAutomationTargetFieldPlaceholder: 'Enter target field',
	frontmatterAutomationStaticValueName: 'Static value',
	frontmatterAutomationStaticValueDesc: 'Value written when the action type is set to static value.',
	frontmatterAutomationStaticValuePlaceholder: 'Enter static value',
	frontmatterAutomationTargetSubfolderPathName: 'Target subfolder',
	frontmatterAutomationTargetSubfolderPathDesc: 'When the file is outside its associated project folder, move it into this child folder under the project folder. Leave empty to use the project folder itself.',
	frontmatterAutomationTargetSubfolderPathPlaceholder: 'archive (leave empty for project folder)',
	frontmatterAutomationWriteModeName: 'Write mode',
	frontmatterAutomationWriteModeDesc: 'Always overwrite the target field, or only write when it is empty.',
	frontmatterAutomationWriteModeAlwaysLabel: 'Always',
	frontmatterAutomationWriteModeWhenEmptyLabel: 'When empty',
	projectRoutingHeading: 'Project routing',
	projectRoutingEnableName: 'Enable project routing',
	projectRoutingEnableDesc: 'Wait for new markdown files to finish frontmatter parsing, then move matching files into the selected open project folder.',
	projectRoutingAutoMoveName: 'Auto move when there is one candidate',
	projectRoutingAutoMoveDesc: 'Move directly when exactly one open project matches. Turn this off to confirm even the single candidate.',
	projectRoutingShowStatusBarName: 'Show current project in the status bar',
	projectRoutingShowStatusBarDesc: 'Display the current file\'s associated project based on the open project files.',
	projectRoutingShowNoticeName: 'Show notice after move',
	projectRoutingShowNoticeDesc: 'Show a notice after a new file is moved into a project folder.',
	projectRoutingDebugLogName: 'Debug log',
	projectRoutingDebugLogDesc: 'Write detailed project-routing diagnostics to the developer console.',
	projectRoutingProjectRuleHeading: 'Project recognition',
	projectRoutingProjectRuleDesc: 'Define how open markdown files are recognized as projects.',
	projectRoutingSubfolderPathName: 'Project subfolder path',
	projectRoutingSubfolderPathDesc: 'Move files into this child folder under the selected project folder. Leave it empty to move directly into the project folder. Missing folders are created automatically.',
	projectRoutingSubfolderPathPlaceholder: 'raw (leave empty for project folder)',
	projectRoutingDuplicateProjectDetectionName: 'Detect multiple projects in one folder',
	projectRoutingDuplicateProjectDetectionDesc: 'Show a persistent notice when one folder contains multiple markdown files recognized as projects.',
	projectRoutingRecognizeFilenameMatchesFolderNameName: 'Also recognize file name = folder name',
	projectRoutingRecognizeFilenameMatchesFolderNameDesc: 'When enabled, an open markdown file is treated as a project file if its file name exactly matches its parent folder name.',
	projectRoutingProjectFileRulesHeading: 'Project property rules',
	projectRoutingProjectFileRulesDesc: 'Open markdown files are also treated as project files when frontmatter matches any of these rules.',
	projectRoutingProjectFileRuleLabel: (index) => `Project property rule ${index}`,
	projectRoutingNoProjectFileRules: 'No project property rules are configured. Only the file-name rule can recognize project files.',
	projectRoutingProjectFileAddRuleName: 'Add project property rule',
	projectRoutingProjectFileAddRuleDesc: 'Append another frontmatter rule for recognizing project files.',
	projectRoutingProjectFileAddRuleButton: 'Add rule',
	projectRoutingProjectFileRemoveRuleName: 'Remove this project rule',
	projectRoutingProjectFileRemoveRuleDesc: 'Delete this project property rule from the list.',
	projectRoutingProjectFileRemoveRuleButton: 'Remove rule',
	projectRoutingRuleKeyName: 'Frontmatter key',
	projectRoutingRuleKeyDesc: 'Frontmatter key used by this rule.',
	projectRoutingRuleKeyPlaceholder: 'Enter a frontmatter key',
	projectRoutingRuleMatchModeName: 'Match mode',
	projectRoutingRuleMatchModeDesc: 'Match by key existence or by an exact key/value pair.',
	projectRoutingMatchModeKeyExistsLabel: 'Key exists',
	projectRoutingMatchModeKeyValueEqualsLabel: 'Key equals value',
	projectRoutingRuleValueName: 'Frontmatter value',
	projectRoutingRuleValueDesc: 'Used only when the match mode is set to key equals value.',
	projectRoutingRuleValuePlaceholder: 'Enter a frontmatter value',
	projectRoutingRoutableRulesHeading: 'Routable file rules',
	projectRoutingRoutableRulesDesc: 'Newly created markdown files are routed only when their frontmatter matches one of these rules.',
	projectRoutingRoutableRuleLabel: (index) => `Routable rule ${index}`,
	projectRoutingNoRoutableRules: 'No routable file rules are configured. New files will not be moved.',
	projectRoutingAddRuleName: 'Add routable rule',
	projectRoutingAddRuleDesc: 'Append another frontmatter rule for files that should enter the routing flow.',
	projectRoutingAddRuleButton: 'Add rule',
	projectRoutingRemoveRuleName: 'Remove this rule',
	projectRoutingRemoveRuleDesc: 'Delete this routable rule from the list.',
	projectRoutingRemoveRuleButton: 'Remove rule',
	projectRoutingCurrentFileCommandHeading: 'Move current file command',
	projectRoutingCurrentFileCommandDesc: 'This command moves the active markdown file into a selected open project folder.',
	projectRoutingCurrentFileCommandLimitName: 'Require command rule match',
	projectRoutingCurrentFileCommandLimitDesc: 'When enabled, the command only moves files whose frontmatter matches one of the rules below. Leave this off to allow any markdown file.',
	projectRoutingCurrentFileCommandRulesHeading: 'Move current file rules',
	projectRoutingCurrentFileCommandRulesDesc: 'These rules are independent from the new-file routing rules and apply only to the move-current-file command.',
	projectRoutingCurrentFileCommandRuleLabel: (index) => `Current-file rule ${index}`,
	projectRoutingCurrentFileCommandNoRules: 'No current-file command rules are configured.',
	projectRoutingCurrentFileCommandAddRuleName: 'Add current-file rule',
	projectRoutingCurrentFileCommandAddRuleDesc: 'Append another frontmatter rule for the move-current-file command.',
	projectRoutingCurrentFileCommandAddRuleButton: 'Add rule',
	projectRoutingCurrentFileCommandRemoveRuleName: 'Remove this current-file rule',
	projectRoutingCurrentFileCommandRemoveRuleDesc: 'Delete this move-current-file command rule from the list.',
	projectRoutingCurrentFileCommandRemoveRuleButton: 'Remove rule',
	sameFolderNoteHeading: 'Create note in same folder',
	enableSameFolderNoteName: 'Enable same-folder note command',
	enableSameFolderNoteDesc: 'Add a file context-menu command that creates a new markdown note next to the selected file.',
};

const CHINESE_SETTINGS_LOCALIZATION: SettingsLocalization = {
	settingsPageTitle: 'OBPM 设置',
	settingsPageDesc: '按使用场景浏览 OBPM 功能。通过标签分组减少滚动距离，也让相关选项保持在同一块里。',
	settingsTabBases: 'Bases',
	settingsTabBasesDesc: '集中管理原生 Bases 视图相关增强，包括文件定位、分组折叠和顶部 Tabs。',
	settingsTabMetadata: '属性',
	settingsTabMetadataDesc: '集中处理项目 frontmatter 派生的链接、显示文本和文件名同步等属性行为。',
	settingsTabAutomation: '自动化',
	settingsTabAutomationDesc: '配置监听 frontmatter 变化、自动回写当前文件并执行项目归档路由的规则。',
	settingsTabProject: '项目',
	settingsTabProjectDesc: '配置 Markdown 文件如何被识别为项目文件。',
	settingsTabWorkflow: '工作流',
	settingsTabWorkflowDesc: '放置移动内容和同目录新建等更偏项目流程效率的能力。',
	basesFileRevealEnableDesc: '在原生 Bases 的表格视图中按住 Alt 再点击某一行或文件链接，即可在左侧文件列表里定位该文件。',
	basesFileRevealEnableName: '启用 Bases Alt+点击定位文件',
	basesFileRevealHeading: 'Bases 文件定位',
	basesGroupFoldDebugModeDesc: '将 Bases 分组折叠的详细调试信息输出到开发者控制台。',
	basesGroupFoldDebugModeName: '调试模式',
	basesGroupFoldEnableDesc: '为原生 Bases 分组 table view 增加分组折叠与展开按钮。',
	basesGroupFoldEnableName: '启用 Bases 分组折叠',
	basesGroupFoldHeading: 'Bases 分组折叠',
	basesGroupFoldRememberStateDesc: '为每个 .base 文件和视图记住分组折叠状态。',
	basesGroupFoldRememberStateName: '记住折叠状态',
	basesTopTabsAutoRefreshDesc: '当当前 .base 文件内容变化时，自动刷新顶部 Tabs。',
	basesTopTabsAutoRefreshName: '自动刷新',
	basesTopTabsDebugModeDesc: '将 Bases 顶部 Tabs 的详细调试信息输出到开发者控制台。',
	basesTopTabsDebugModeName: '调试模式',
	basesTopTabsEnableDesc: '在原生 .base 页面顶部常驻显示视图 Tabs。',
	basesTopTabsEnableName: '启用 Bases 顶部 Tabs',
	basesTopTabsHeading: 'Bases 顶部 Tabs',
	basesTopTabsHideWhenSingleViewDesc: '当当前 Base 只有一个视图时隐藏 Tabs。',
	basesTopTabsHideWhenSingleViewName: '单视图时隐藏',
	basesTopTabsMaxVisibleTabsDesc: (min, max, defaultValue) =>
		`超过这个数量后折叠到“更多”菜单。设为 ${min} 可禁用折叠。范围：${min}-${max}。默认值：${defaultValue}。`,
	basesTopTabsMaxVisibleTabsName: '最大可见 Tabs 数量',
	basesTopTabsMaxVisibleTabsNotice: (min, max) => `最大可见 Tabs 数量必须在 ${min} 到 ${max} 之间。`,
	basesTopTabsOrientationDesc: '选择 Tabs 横向排列，还是改为纵向堆叠显示。',
	basesTopTabsOrientationHorizontalLabel: '横向',
	basesTopTabsOrientationName: '排列方向',
	basesTopTabsOrientationVerticalLabel: '纵向',
	basesTopTabsPlacementAboveToolbarLabel: '工具栏上方',
	basesTopTabsPlacementDesc: '选择 Tabs 是单独占一行，还是嵌入到原生 Bases 工具栏里。',
	basesTopTabsPlacementInsideToolbarLabel: '工具栏内',
	basesTopTabsPlacementName: '位置',
	basesTopTabsRememberLastViewDesc: '为每个 .base 文件记住上次打开的视图，并在下次打开时自动恢复。',
	basesTopTabsRememberLastViewName: '记住每个 Base 的上次视图',
	basesTopTabsScrollableDesc: '当 Tabs 过多时允许横向滚动，而不是自动换行。',
	basesTopTabsScrollableName: '允许横向滚动',
	basesTopTabsShowIconsDesc: '当视图存在图标时，在 Tab 名称旁显示图标。',
	basesTopTabsShowIconsName: '显示图标',
	basesTopTabsShowViewCountDesc: '在 Tabs 旁显示当前 Base 的视图数量。',
	basesTopTabsShowViewCountName: '显示视图数量',
	fileContentMoveEnableDesc: '在文件右键菜单中增加发送动作，将 Markdown 文件以列表形式插入当前编辑器光标处，然后按 Obsidian 的回收站设置删除源文件。',
	fileContentMoveEnableName: '启用发送内容到光标处',
	fileContentMoveFileExplorerDesc: '在文件列表项的右键菜单中显示发送动作。',
	fileContentMoveFileExplorerName: '在文件列表中启用',
	fileContentMoveHeading: '发送内容到光标处',
	fileContentMoveStripSingleH1Desc: '当源文件恰好只有一个一级标题时，移动时去掉该标题，并将后续大纲提升到源文件名下面。',
	fileContentMoveStripSingleH1Name: '去掉单一一级标题',
	relatedLinksHeading: '关联属性链接',
	enableRelatedLinksName: '启用关联属性链接',
	enableRelatedLinksDesc: '当某个属性引用了其他笔记时，自动把当前笔记回填到那些被引用笔记里。',
	relationPropertyName: '关联属性名',
	relationPropertyDesc: '指向关联笔记的属性名，例如 related。',
	relationPropertyPlaceholder: '输入关联属性名',
	displayPropertyName: '显示属性名',
	displayPropertyDesc: '用作链接显示文本的属性名。留空时回退为文件名。',
	displayPropertyPlaceholder: '输入显示属性名',
	inboxHeadingName: 'Inbox 标题',
	inboxHeadingDesc: '缺失的关联链接会以列表项形式插入到第一个匹配的二级标题下。',
	inboxHeadingPlaceholder: '输入 Inbox 标题',
	includeInheritedRelatedLinksName: '包含继承关联链接',
	includeInheritedRelatedLinksDesc: '重建托管关联链接列表时，将上游来源按源笔记层级嵌套插入。',
	missingLinkGracePeriodName: '缺失链接宽限期',
	missingLinkGracePeriodDesc: (min, max, defaultValue) =>
		`当托管链接暂时消失时，等待这么多秒后再自动补回。范围：${min}-${max}。默认值：${defaultValue}。`,
	missingLinkGracePeriodNotice: (min, max) => `缺失链接宽限期必须在 ${min} 到 ${max} 秒之间。`,
	verboseLoggingName: '详细日志',
	verboseLoggingDesc: '将关联链接同步的详细日志输出到开发者控制台。',
	fileNameSyncHeading: '根据属性同步文件名',
	enableFileNameSyncName: '启用文件名同步',
	enableFileNameSyncDesc: '当指定属性存在时，将 Markdown 文件重命名为该属性的值。',
	fileNamePropertyName: '文件名属性',
	fileNamePropertyDesc: '用于生成文件名的属性名。没有该属性的文件会保持不变。',
	fileNamePropertyPlaceholder: '输入文件名属性',
	invalidCharacterReplacementName: '非法字符替换',
	invalidCharacterReplacementDesc: '当文件名里出现非法字符时，用这里的文本替换。留空则直接移除。',
	invalidCharacterReplacementPlaceholder: '输入替换文本',
	invalidCharacterReplacementNotice: '替换文本不能包含文件名非法字符。',
	maxFileNameLengthName: '文件名最大长度',
	maxFileNameLengthDesc: (min, max, defaultValue) => `将 Markdown 文件名限制在 ${min}-${max} 个字符之间。默认值：${defaultValue}。`,
	maxFileNameLengthNotice: (min, max) => `文件名最大长度必须在 ${min} 到 ${max} 之间。`,
	frontmatterAutomationHeading: 'Frontmatter 自动联动',
	frontmatterAutomationEnableName: '启用 Frontmatter 自动联动',
	frontmatterAutomationEnableDesc: '监听已解析的 frontmatter 变化，并在规则命中时自动回写当前文件。',
	frontmatterAutomationTimeFormatName: '时间格式',
	frontmatterAutomationTimeFormatDesc: '用于“写入当前时间”动作。支持的占位符：YYYY、MM、DD、HH、mm、ss。',
	frontmatterAutomationTimeFormatPlaceholder: 'YYYY-MM-DDTHH:mm:ss',
	frontmatterAutomationRulesHeading: '自动化规则',
	frontmatterAutomationRulesDesc: '只有当触发字段变化为指定值时，规则才会执行。',
	frontmatterAutomationRuleLabel: (index) => `自动化规则 ${index}`,
	frontmatterAutomationNoRules: '当前没有配置 Frontmatter 自动联动规则。',
	frontmatterAutomationAddRuleName: '添加自动化规则',
	frontmatterAutomationAddRuleDesc: '再添加一条 Frontmatter 自动联动规则。',
	frontmatterAutomationAddRuleButton: '添加规则',
	frontmatterAutomationRemoveRuleName: '删除自动化规则',
	frontmatterAutomationRemoveRuleDesc: '从列表中移除这条 Frontmatter 自动联动规则。',
	frontmatterAutomationRemoveRuleButton: '删除规则',
	frontmatterAutomationRuleEnabledName: '启用这条规则',
	frontmatterAutomationRuleEnabledDesc: '无需删除即可临时关闭这条规则。',
	frontmatterAutomationTriggerFieldName: '触发字段',
	frontmatterAutomationTriggerFieldDesc: '用于监听状态变化的 frontmatter 字段名。',
	frontmatterAutomationTriggerFieldPlaceholder: '输入触发字段',
	frontmatterAutomationTriggerOperatorName: '触发条件',
	frontmatterAutomationTriggerOperatorDesc: '指定如何匹配触发字段。对于 wikilink 这类包装后的值，更适合使用“包含”。',
	frontmatterAutomationTriggerOperatorContainsLabel: '包含',
	frontmatterAutomationTriggerOperatorEqualsLabel: '等于',
	frontmatterAutomationTriggerValueName: '触发值',
	frontmatterAutomationTriggerValueDesc: '只有当触发字段变化为这个精确值时才执行规则。',
	frontmatterAutomationTriggerValuePlaceholder: '输入触发值',
	frontmatterAutomationActionTypeName: '动作类型',
	frontmatterAutomationActionTypeDesc: '选择回写 frontmatter，或把文件移动到所属项目文件夹。',
	frontmatterAutomationActionTypeCurrentTimeLabel: '写入当前时间',
	frontmatterAutomationActionTypeStaticValueLabel: '写入固定值',
	frontmatterAutomationActionTypeProjectFolderLabel: '移动到项目文件夹',
	frontmatterAutomationTargetFieldName: '目标字段',
	frontmatterAutomationTargetFieldDesc: '规则命中后要写入的 frontmatter 字段名。',
	frontmatterAutomationTargetFieldPlaceholder: '输入目标字段',
	frontmatterAutomationStaticValueName: '固定值',
	frontmatterAutomationStaticValueDesc: '当动作类型为“写入固定值”时使用。',
	frontmatterAutomationStaticValuePlaceholder: '输入固定值',
	frontmatterAutomationTargetSubfolderPathName: '目标子目录',
	frontmatterAutomationTargetSubfolderPathDesc: '当文件不在关联项目文件夹层级下时，把它移动到项目文件夹下的这个子目录中。留空则使用项目文件夹本身。',
	frontmatterAutomationTargetSubfolderPathPlaceholder: 'archive（留空则使用项目目录）',
	frontmatterAutomationWriteModeName: '写入策略',
	frontmatterAutomationWriteModeDesc: '始终覆盖目标字段，或仅在目标字段为空时写入。',
	frontmatterAutomationWriteModeAlwaysLabel: '总是写入',
	frontmatterAutomationWriteModeWhenEmptyLabel: '仅为空时写入',
	projectRoutingHeading: '项目归档路由',
	projectRoutingEnableName: '启用项目归档路由',
	projectRoutingEnableDesc: '等待新建 Markdown 文件完成 frontmatter 解析后，将命中规则的文件移动到所选的已打开项目目录。',
	projectRoutingAutoMoveName: '单候选项目时自动移动',
	projectRoutingAutoMoveDesc: '当且仅当只有一个已打开项目候选时，直接移动；关闭后即使只有一个候选也会先弹窗确认。',
	projectRoutingShowStatusBarName: '在状态栏显示当前项目',
	projectRoutingShowStatusBarDesc: '根据当前活动文件和已打开项目文件，在状态栏显示当前所属项目。',
	projectRoutingShowNoticeName: '移动后显示提示',
	projectRoutingShowNoticeDesc: '当新建文件被移动到项目目录后显示提示消息。',
	projectRoutingDebugLogName: '调试日志',
	projectRoutingDebugLogDesc: '将项目归档路由的详细调试信息输出到开发者控制台。',
	projectRoutingProjectRuleHeading: '项目识别规则',
	projectRoutingProjectRuleDesc: '统一配置已打开 Markdown 文件如何被识别为项目。',
	projectRoutingSubfolderPathName: '项目子目录路径',
	projectRoutingSubfolderPathDesc: '把文件移动到所选项目目录下的这个子目录中。留空时会直接移动到项目目录本身。若目录不存在，会自动创建。',
	projectRoutingSubfolderPathPlaceholder: 'raw（留空则使用项目目录）',
	projectRoutingDuplicateProjectDetectionName: '检测同目录多个项目',
	projectRoutingDuplicateProjectDetectionDesc: '当同一文件夹内存在多个被识别为项目的 Markdown 文件时，显示常驻通知。',
	projectRoutingRecognizeFilenameMatchesFolderNameName: '同时识别“文件名等于目录名”',
	projectRoutingRecognizeFilenameMatchesFolderNameDesc: '开启后，如果某个已打开 Markdown 文件的文件名与其所在目录名完全一致，也会被视为项目文件。',
	projectRoutingProjectFileRulesHeading: '项目属性规则',
	projectRoutingProjectFileRulesDesc: '当已打开 Markdown 文件的 frontmatter 命中以下任一规则时，也会被视为项目文件。',
	projectRoutingProjectFileRuleLabel: (index) => `项目属性规则 ${index}`,
	projectRoutingNoProjectFileRules: '当前没有配置项目属性规则，只会通过文件名规则识别项目文件。',
	projectRoutingProjectFileAddRuleName: '添加项目属性规则',
	projectRoutingProjectFileAddRuleDesc: '再添加一条用于识别项目文件的 frontmatter 规则。',
	projectRoutingProjectFileAddRuleButton: '添加规则',
	projectRoutingProjectFileRemoveRuleName: '删除这条项目规则',
	projectRoutingProjectFileRemoveRuleDesc: '从列表中移除这条项目属性规则。',
	projectRoutingProjectFileRemoveRuleButton: '删除规则',
	projectRoutingRuleKeyName: 'Frontmatter 键名',
	projectRoutingRuleKeyDesc: '这条规则要匹配的 frontmatter 键名。',
	projectRoutingRuleKeyPlaceholder: '输入 frontmatter 键名',
	projectRoutingRuleMatchModeName: '匹配方式',
	projectRoutingRuleMatchModeDesc: '选择只匹配键是否存在，或匹配精确的键值对。',
	projectRoutingMatchModeKeyExistsLabel: '键存在',
	projectRoutingMatchModeKeyValueEqualsLabel: '键值相等',
	projectRoutingRuleValueName: 'Frontmatter 值',
	projectRoutingRuleValueDesc: '仅当匹配方式为键值相等时使用。',
	projectRoutingRuleValuePlaceholder: '输入 frontmatter 值',
	projectRoutingRoutableRulesHeading: '待移动文件规则',
	projectRoutingRoutableRulesDesc: '只有新建 Markdown 文件的 frontmatter 命中以下任一规则时，才会进入项目归档流程。',
	projectRoutingRoutableRuleLabel: (index) => `待移动规则 ${index}`,
	projectRoutingNoRoutableRules: '当前没有配置待移动文件规则，新建文件不会被自动移动。',
	projectRoutingAddRuleName: '添加待移动规则',
	projectRoutingAddRuleDesc: '再添加一条用于识别待移动文件的 frontmatter 规则。',
	projectRoutingAddRuleButton: '添加规则',
	projectRoutingRemoveRuleName: '删除这条规则',
	projectRoutingRemoveRuleDesc: '从列表中移除这条待移动文件规则。',
	projectRoutingRemoveRuleButton: '删除规则',
	projectRoutingCurrentFileCommandHeading: '移动当前文件命令',
	projectRoutingCurrentFileCommandDesc: '这个命令会把当前活动的 Markdown 文件移动到你选择的已打开项目目录中。',
	projectRoutingCurrentFileCommandLimitName: '要求命中命令规则',
	projectRoutingCurrentFileCommandLimitDesc: '开启后，只有 frontmatter 命中下面任一规则的文件才能执行该命令；关闭时默认允许任意 Markdown 文件移动。',
	projectRoutingCurrentFileCommandRulesHeading: '移动当前文件规则',
	projectRoutingCurrentFileCommandRulesDesc: '这组规则与“新建文件归档规则”完全独立，只作用于“移动当前文件”命令。',
	projectRoutingCurrentFileCommandRuleLabel: (index) => `当前文件规则 ${index}`,
	projectRoutingCurrentFileCommandNoRules: '当前没有配置“移动当前文件”命令的规则。',
	projectRoutingCurrentFileCommandAddRuleName: '添加当前文件规则',
	projectRoutingCurrentFileCommandAddRuleDesc: '再添加一条只用于“移动当前文件”命令的 frontmatter 规则。',
	projectRoutingCurrentFileCommandAddRuleButton: '添加规则',
	projectRoutingCurrentFileCommandRemoveRuleName: '删除这条当前文件规则',
	projectRoutingCurrentFileCommandRemoveRuleDesc: '从列表中移除这条“移动当前文件”命令规则。',
	projectRoutingCurrentFileCommandRemoveRuleButton: '删除规则',
	sameFolderNoteHeading: '同目录新建笔记',
	enableSameFolderNoteName: '启用同目录新建命令',
	enableSameFolderNoteDesc: '在文件右键菜单中增加一个命令，用来在所选文件同目录下新建 Markdown 笔记。',
};

export function getSettingsLocalization(): SettingsLocalization {
	const language = resolveLanguage();
	return language.startsWith('zh') ? CHINESE_SETTINGS_LOCALIZATION : ENGLISH_SETTINGS_LOCALIZATION;
}

function resolveLanguage(): string {
	if (typeof getLanguage === 'function') {
		return normalizeLanguage(getLanguage());
	}

	if (typeof document !== 'undefined') {
		const documentLanguage = document.documentElement.lang;
		if (documentLanguage) {
			return normalizeLanguage(documentLanguage);
		}
	}

	if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
		return normalizeLanguage(navigator.language);
	}

	return 'en';
}

function normalizeLanguage(value: string): string {
	return value.trim().toLowerCase();
}
