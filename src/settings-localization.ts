import {getLanguage} from 'obsidian';

export interface SettingsLocalization {
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
	projectRoutingRecognizeFilenameMatchesFolderNameName: string;
	projectRoutingRecognizeFilenameMatchesFolderNameDesc: string;
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
	projectRoutingProjectRuleHeading: 'Project file rule',
	projectRoutingProjectRuleDesc: 'Open files whose frontmatter matches this rule are treated as project files.',
	projectRoutingRecognizeFilenameMatchesFolderNameName: 'Also recognize file name = folder name',
	projectRoutingRecognizeFilenameMatchesFolderNameDesc: 'When enabled, an open markdown file is also treated as a project file if its file name exactly matches its parent folder name. This is combined with the frontmatter rule above.',
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
	projectRoutingProjectRuleHeading: '项目文件规则',
	projectRoutingProjectRuleDesc: '已打开文件中，frontmatter 命中这条规则的文件会被视为项目文件。',
	projectRoutingRecognizeFilenameMatchesFolderNameName: '同时识别“文件名等于目录名”',
	projectRoutingRecognizeFilenameMatchesFolderNameDesc: '开启后，如果某个已打开 Markdown 文件的文件名与其所在目录名完全一致，也会被视为项目文件。这条规则会与上面的 frontmatter 规则取并集。',
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
