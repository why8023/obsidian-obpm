import {getLanguage} from 'obsidian';
import type {ProjectBaseFileScope} from '../project-base/project-base-settings';

interface BasesTopTabsLocalization {
	cancelButtonLabel: string;
	confirmDeleteButtonLabel: string;
	copySuffix: string;
	deleteBlockedNotice: string;
	deleteViewConfirmDescription: (viewName: string) => string;
	deleteViewMenuItem: string;
	deleteViewTitle: (viewName: string) => string;
	duplicateViewDescription: (viewName: string) => string;
	duplicateViewMenuItem: string;
	duplicateViewPromptTitle: (viewName: string) => string;
	duplicateViewSubmitLabel: string;
	emptyViewNameNotice: string;
	moreViewsButtonLabel: (hiddenCount: number) => string;
	openProjectFileErrorNotice: string;
	openProjectFolderErrorNotice: string;
	projectFileScopeLabel: (scope: ProjectBaseFileScope) => string;
	projectFileScopeToggleLabel: (scope: ProjectBaseFileScope) => string;
	projectFileScopeUpdateErrorNotice: string;
	pinViewMenuItem: string;
	renameViewDescription: (viewName: string) => string;
	renameViewMenuItem: string;
	renameViewPromptTitle: (viewName: string) => string;
	renameViewSubmitLabel: string;
	resizeSidebarLabel: string;
	revealProjectFileErrorNotice: string;
	scrollSidebarLabel: string;
	scrollSidebarTopLabel: string;
	switchErrorNotice: string;
	unpinViewMenuItem: string;
	updateViewsErrorNotice: string;
	viewCountLabel: (count: number) => string;
	viewNamePlaceholder: string;
	viewNameTakenNotice: (viewName: string) => string;
}

const ENGLISH_LOCALIZATION: BasesTopTabsLocalization = {
	cancelButtonLabel: 'Cancel',
	confirmDeleteButtonLabel: 'Delete',
	copySuffix: 'Copy',
	deleteBlockedNotice: 'At least one Base view must remain.',
	deleteViewConfirmDescription: (viewName) => `Delete the "${viewName}" view from this Base?`,
	deleteViewMenuItem: 'Delete view',
	deleteViewTitle: (viewName) => `Delete "${viewName}"?`,
	duplicateViewDescription: (viewName) => `Create a copy of the "${viewName}" view.`,
	duplicateViewMenuItem: 'Duplicate view',
	duplicateViewPromptTitle: (viewName) => `Duplicate "${viewName}"`,
	duplicateViewSubmitLabel: 'Duplicate',
	emptyViewNameNotice: 'View name cannot be empty.',
	moreViewsButtonLabel: (hiddenCount) => hiddenCount > 0 ? `More (${hiddenCount})` : 'More',
	openProjectFileErrorNotice: 'Failed to open the project file. Check the developer console for details.',
	openProjectFolderErrorNotice: 'Failed to open the project folder. Check the developer console for details.',
	projectFileScopeLabel: (scope) => scope === 'project' ? 'Project folder' : 'Project child folder',
	projectFileScopeToggleLabel: (scope) => scope === 'project'
		? 'Current scope: whole project folder. Click to show only the project child folder.'
		: 'Current scope: project child folder. Click to show the whole project folder.',
	projectFileScopeUpdateErrorNotice: 'Failed to update the project file scope. Check the developer console for details.',
	pinViewMenuItem: 'Pin tab',
	renameViewDescription: (viewName) => `Rename the "${viewName}" view.`,
	renameViewMenuItem: 'Rename view',
	renameViewPromptTitle: (viewName) => `Rename "${viewName}"`,
	renameViewSubmitLabel: 'Rename',
	resizeSidebarLabel: 'Resize tabs sidebar',
	revealProjectFileErrorNotice: 'Failed to reveal the project file in the file tree. Check the developer console for details.',
	scrollSidebarLabel: 'Scroll Base views down',
	scrollSidebarTopLabel: 'Scroll Base views to top',
	switchErrorNotice: 'Failed to switch Base view. Check the developer console for details.',
	unpinViewMenuItem: 'Unpin tab',
	updateViewsErrorNotice: 'Failed to update the Base views. Check the developer console for details.',
	viewCountLabel: (count) => count === 1 ? '1 view' : `${count} views`,
	viewNamePlaceholder: 'Enter view name',
	viewNameTakenNotice: (viewName) => `A view named "${viewName}" already exists.`,
};

const CHINESE_LOCALIZATION: BasesTopTabsLocalization = {
	cancelButtonLabel: '取消',
	confirmDeleteButtonLabel: '删除',
	copySuffix: '副本',
	deleteBlockedNotice: '至少要保留一个 Base 视图。',
	deleteViewConfirmDescription: (viewName) => `确定要删除 Base 视图“${viewName}”吗？`,
	deleteViewMenuItem: '删除视图',
	deleteViewTitle: (viewName) => `删除“${viewName}”`,
	duplicateViewDescription: (viewName) => `为“${viewName}”创建一个视图副本。`,
	duplicateViewMenuItem: '复制视图',
	duplicateViewPromptTitle: (viewName) => `复制“${viewName}”`,
	duplicateViewSubmitLabel: '复制',
	emptyViewNameNotice: '视图名称不能为空。',
	moreViewsButtonLabel: (hiddenCount) => hiddenCount > 0 ? `更多 (${hiddenCount})` : '更多',
	openProjectFileErrorNotice: '打开项目文件失败，请打开开发者控制台查看详情。',
	openProjectFolderErrorNotice: '打开项目文件夹失败，请打开开发者控制台查看详情。',
	projectFileScopeLabel: (scope) => scope === 'project' ? '项目目录' : '项目子文件夹',
	projectFileScopeToggleLabel: (scope) => scope === 'project'
		? '当前范围：整个项目目录。点击切换为项目子文件夹。'
		: '当前范围：项目子文件夹。点击切换为整个项目目录。',
	projectFileScopeUpdateErrorNotice: '更新项目文件范围失败，请打开开发者控制台查看详情。',
	pinViewMenuItem: '固定 Tab',
	renameViewDescription: (viewName) => `重命名视图“${viewName}”。`,
	renameViewMenuItem: '重命名视图',
	renameViewPromptTitle: (viewName) => `重命名“${viewName}”`,
	renameViewSubmitLabel: '重命名',
	resizeSidebarLabel: '调整 Tabs 侧栏宽度',
	revealProjectFileErrorNotice: '在文件树中定位项目文件失败，请打开开发者控制台查看详情。',
	scrollSidebarLabel: '向下滚动 Base 视图',
	scrollSidebarTopLabel: '回到 Base 视图顶部',
	switchErrorNotice: '切换 Base 视图失败，请打开开发者控制台查看详情。',
	unpinViewMenuItem: '取消固定 Tab',
	updateViewsErrorNotice: '更新 Base 视图失败，请打开开发者控制台查看详情。',
	viewCountLabel: (count) => `${count} 个视图`,
	viewNamePlaceholder: '输入视图名称',
	viewNameTakenNotice: (viewName) => `已存在名为“${viewName}”的视图。`,
};

export function getBasesTopTabsLocalization(): BasesTopTabsLocalization {
	const language = resolveLanguage();
	return language.startsWith('zh') ? CHINESE_LOCALIZATION : ENGLISH_LOCALIZATION;
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
