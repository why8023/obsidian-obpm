import {getLanguage} from 'obsidian';

export interface SettingsLocalization {
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
	sameFolderNoteHeading: string;
	enableSameFolderNoteName: string;
	enableSameFolderNoteDesc: string;
}

const ENGLISH_SETTINGS_LOCALIZATION: SettingsLocalization = {
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
	sameFolderNoteHeading: 'Create note in same folder',
	enableSameFolderNoteName: 'Enable same-folder note command',
	enableSameFolderNoteDesc: 'Add a file context-menu command that creates a new markdown note next to the selected file.',
};

const CHINESE_SETTINGS_LOCALIZATION: SettingsLocalization = {
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
