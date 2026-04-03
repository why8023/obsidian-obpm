import {Menu, Notice, WorkspaceLeaf, debounce, setIcon} from 'obsidian';
import {BaseConfigAdapter} from './base-config-adapter';
import {BaseDomAdapter} from './base-dom-adapter';
import {
	BasesTopTabsConfirmModal,
	BasesTopTabsTextPromptModal,
} from './bases-top-tabs-modals';
import {BasesTopTabsStateStore} from './bases-top-tabs-state-store';
import {getBasesTopTabsLocalization} from './bases-top-tabs-localization';
import {BaseViewSwitcherAdapter} from './base-view-switcher-adapter';
import {BasesTopTabsPluginContext, BasesTopTabsView, ParsedBaseFile} from './types';

const FEATURE_ID = 'bases-top-tabs';

type DropPosition = 'after' | 'before';

interface OrderedTabView extends BasesTopTabsView {
	pinned: boolean;
}

export class BasesTabsController {
	private readonly barEl: HTMLDivElement;
	private busy = false;
	private readonly buttonsByKey = new Map<string, HTMLButtonElement>();
	private readonly countEl: HTMLDivElement;
	private currentHiddenViews: OrderedTabView[] = [];
	private currentOrderedViews: OrderedTabView[] = [];
	private currentParsedBaseFile: ParsedBaseFile | null = null;
	private disposed = false;
	private dragSourceKey: string | null = null;
	private dragTargetKey: string | null = null;
	private dragTargetPosition: DropPosition | null = null;
	private lastFilePath: string | null = null;
	private lastStructureSignature = '';
	private readonly localization = getBasesTopTabsLocalization();
	private readonly moreButtonEl: HTMLButtonElement;
	private readonly observers: MutationObserver[] = [];
	private pendingRestoreFilePath: string | null = null;
	private refreshToken = 0;
	private readonly refreshView = debounce((reason: string) => {
		void this.refresh(reason);
	}, 100, true);
	private readonly tabsListEl: HTMLDivElement;

	constructor(
		private readonly plugin: BasesTopTabsPluginContext,
		private readonly leaf: WorkspaceLeaf,
		private readonly configAdapter: BaseConfigAdapter,
		private readonly domAdapter: BaseDomAdapter,
		private readonly viewSwitcherAdapter: BaseViewSwitcherAdapter,
		private readonly stateStore: BasesTopTabsStateStore,
	) {
		this.barEl = document.createElement('div');
		this.barEl.className = 'obpm-bases-tabs-bar';
		this.barEl.setAttribute('data-obpm-feature', FEATURE_ID);

		this.tabsListEl = document.createElement('div');
		this.tabsListEl.className = 'obpm-bases-tabs-list';
		this.tabsListEl.setAttribute('aria-label', this.localization.tabListLabel);
		this.tabsListEl.setAttribute('role', 'tablist');

		this.moreButtonEl = document.createElement('button');
		this.moreButtonEl.type = 'button';
		this.moreButtonEl.className = 'obpm-bases-tabs-more';
		this.moreButtonEl.hidden = true;
		this.moreButtonEl.addEventListener('click', (event) => {
			this.openMoreMenu(event);
		});

		this.countEl = document.createElement('div');
		this.countEl.className = 'obpm-bases-tabs-count';

		this.barEl.append(this.tabsListEl, this.moreButtonEl, this.countEl);
		this.observers.push(...this.domAdapter.createObservers(this.leaf, () => {
			this.requestRefresh('dom-change');
		}));
	}

	destroy() {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.refreshView.cancel();
		for (const observer of this.observers) {
			observer.disconnect();
		}

		this.observers.length = 0;
		this.buttonsByKey.clear();
		this.barEl.remove();
	}

	requestRefresh(reason: string) {
		if (this.disposed) {
			return;
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesTopTabs.debugMode, 'Scheduling Base tabs refresh.', {
			reason,
		});
		this.refreshView(reason);
	}

	private applyBarState(
		viewCount: number,
		activeViewKey: string | null,
		actualPlacement: 'above-toolbar' | 'inside-toolbar',
	) {
		const settings = this.plugin.settings.basesTopTabs;
		const isVertical = settings.orientation === 'vertical';
		this.barEl.classList.toggle('has-count', settings.showViewCount);
		this.barEl.classList.toggle('is-scrollable', settings.scrollable);
		this.barEl.classList.toggle('mod-inside-toolbar', actualPlacement === 'inside-toolbar');
		this.barEl.classList.toggle('mod-vertical', isVertical);
		this.countEl.hidden = !settings.showViewCount;
		this.countEl.textContent = settings.showViewCount ? this.localization.viewCountLabel(viewCount) : '';

		for (const [viewKey, buttonEl] of this.buttonsByKey) {
			const isActive = viewKey === activeViewKey;
			buttonEl.classList.toggle('is-active', isActive);
			buttonEl.setAttribute('aria-selected', String(isActive));
			buttonEl.tabIndex = isActive ? 0 : -1;
		}
	}

	private buildStructureSignature(
		parsedBaseFile: ParsedBaseFile,
		visibleViews: OrderedTabView[],
		hiddenViews: OrderedTabView[],
		actualPlacement: 'above-toolbar' | 'inside-toolbar',
	): string {
		return JSON.stringify({
			actualPlacement,
			filePath: parsedBaseFile.filePath,
			maxVisibleTabs: this.plugin.settings.basesTopTabs.maxVisibleTabs,
			orientation: this.plugin.settings.basesTopTabs.orientation,
			showIcons: this.plugin.settings.basesTopTabs.showIcons,
			visibleViews: visibleViews.map((view) => [view.key, view.name, view.type, view.icon, view.pinned]),
			hiddenViews: hiddenViews.map((view) => [view.key, view.name, view.pinned]),
		});
	}

	private clearDragState() {
		this.dragSourceKey = null;
		this.dragTargetKey = null;
		this.dragTargetPosition = null;
		this.barEl.classList.remove('is-dragging');
		for (const buttonEl of this.buttonsByKey.values()) {
			buttonEl.classList.remove('is-drag-source', 'mod-drop-before', 'mod-drop-after');
		}
	}

	private async deleteView(view: OrderedTabView) {
		const parsedBaseFile = this.currentParsedBaseFile;
		if (!parsedBaseFile) {
			return;
		}

		if (parsedBaseFile.views.length <= 1) {
			new Notice(this.localization.deleteBlockedNotice);
			return;
		}

		const confirmModal = new BasesTopTabsConfirmModal(this.plugin.app, {
			cancelLabel: this.localization.cancelButtonLabel,
			confirmLabel: this.localization.confirmDeleteButtonLabel,
			description: this.localization.deleteViewConfirmDescription(view.name),
			title: this.localization.deleteViewTitle(view.name),
		});
		const confirmed = await confirmModal.openAndGetResult();
		if (!confirmed) {
			return;
		}

		const leafState = this.viewSwitcherAdapter.getLeafState(this.leaf);
		const isActiveView = leafState?.currentViewName === view.name;
		const fallbackViewName = resolveFallbackViewName(this.currentOrderedViews, view.key);
		const deleted = await this.withBusyUi(async () => {
			const updatedBaseFile = await this.configAdapter.deleteView(parsedBaseFile.file, view.key);
			return updatedBaseFile !== null;
		});

		if (!deleted) {
			new Notice(this.localization.updateViewsErrorNotice);
			return;
		}

		await this.stateStore.removeViewReference(parsedBaseFile.filePath, view.name);
		if (isActiveView && fallbackViewName) {
			await this.switchToViewByName(fallbackViewName, 'delete-view');
		}

		this.requestRefresh('delete-view');
	}

	private async duplicateView(view: OrderedTabView) {
		const parsedBaseFile = this.currentParsedBaseFile;
		if (!parsedBaseFile) {
			return;
		}

		const nextName = await this.openViewNamePrompt({
			description: this.localization.duplicateViewDescription(view.name),
			initialValue: createDuplicateViewNameSuggestion(
				parsedBaseFile.views.map((entry) => entry.name),
				view.name,
				this.localization.copySuffix,
			),
			submitLabel: this.localization.duplicateViewSubmitLabel,
			title: this.localization.duplicateViewPromptTitle(view.name),
			validate: (value) => this.validateViewName(value, parsedBaseFile.views.map((entry) => entry.name)),
		});
		if (!nextName) {
			return;
		}

		const duplicated = await this.withBusyUi(async () => {
			const updatedBaseFile = await this.configAdapter.duplicateView(parsedBaseFile.file, view.key, nextName);
			return updatedBaseFile !== null;
		});

		if (!duplicated) {
			new Notice(this.localization.updateViewsErrorNotice);
			return;
		}

		await this.switchToViewByName(nextName, 'duplicate-view');
		this.requestRefresh('duplicate-view');
	}

	private async handleTabClick(view: OrderedTabView) {
		const leafState = this.viewSwitcherAdapter.getLeafState(this.leaf);
		if (this.busy || !leafState || leafState.currentViewName === view.name) {
			return;
		}

		const switched = await this.switchToViewByName(view.name, 'view-switch');
		if (!switched) {
			new Notice(this.localization.switchErrorNotice);
		}
	}

	private handleTabContextMenu(event: MouseEvent, view: OrderedTabView) {
		event.preventDefault();
		event.stopPropagation();

		const filePath = this.currentParsedBaseFile?.filePath ?? '';
		const isPinned = filePath.length > 0 && this.stateStore.hasPinnedView(filePath, view.name);
		const menu = new Menu();
		menu.addItem((item) => item
			.setTitle(isPinned ? this.localization.unpinViewMenuItem : this.localization.pinViewMenuItem)
			.setIcon(isPinned ? 'pin-off' : 'pin')
			.onClick(() => {
				void this.togglePinnedState(view);
			}));
		menu.addSeparator();
		menu.addItem((item) => item
			.setTitle(this.localization.renameViewMenuItem)
			.setIcon('pencil')
			.onClick(() => {
				void this.renameView(view);
			}));
		menu.addItem((item) => item
			.setTitle(this.localization.duplicateViewMenuItem)
			.setIcon('copy')
			.onClick(() => {
				void this.duplicateView(view);
			}));
		menu.addItem((item) => item
			.setTitle(this.localization.deleteViewMenuItem)
			.setIcon('trash-2')
			.setWarning(true)
			.setDisabled((this.currentParsedBaseFile?.views.length ?? 0) <= 1)
			.onClick(() => {
				void this.deleteView(view);
			}));
		menu.showAtMouseEvent(event);
	}

	private handleTabDragEnd() {
		this.clearDragState();
	}

	private handleTabDragOver(event: DragEvent, targetView: OrderedTabView, buttonEl: HTMLButtonElement) {
		if (!this.dragSourceKey || this.dragSourceKey === targetView.key || this.busy) {
			return;
		}

		if (!this.canReorderWithTarget(targetView)) {
			if (this.dragTargetKey !== null || this.dragTargetPosition !== null) {
				this.dragTargetKey = null;
				this.dragTargetPosition = null;
				this.renderDropState();
			}
			return;
		}

		event.preventDefault();
		const dropPosition = resolveDropPosition(event, buttonEl, this.plugin.settings.basesTopTabs.orientation);
		this.dragTargetKey = targetView.key;
		this.dragTargetPosition = dropPosition;
		this.renderDropState();
	}

	private handleTabDragStart(event: DragEvent, sourceView: OrderedTabView) {
		if (this.busy) {
			event.preventDefault();
			return;
		}

		this.dragSourceKey = sourceView.key;
		this.barEl.classList.add('is-dragging');
		event.dataTransfer?.setData('text/plain', sourceView.key);
		event.dataTransfer?.setDragImage(event.currentTarget as HTMLElement, 12, 12);
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}

		this.renderDropState();
	}

	private openMoreMenu(event: MouseEvent) {
		if (this.currentHiddenViews.length === 0) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const activeViewName = this.viewSwitcherAdapter.getLeafState(this.leaf)?.currentViewName ?? null;
		const menu = new Menu();
		for (const view of this.currentHiddenViews) {
			menu.addItem((item) => item
				.setTitle(view.name)
				.setIcon(view.icon)
				.setChecked(activeViewName === view.name)
				.onClick(() => {
					void this.handleTabClick(view);
				}));
		}

		menu.showAtMouseEvent(event);
	}

	private async openViewNamePrompt(options: {
		description: string;
		initialValue: string;
		submitLabel: string;
		title: string;
		validate: (value: string) => string | null;
	}): Promise<string | null> {
		const modal = new BasesTopTabsTextPromptModal(this.plugin.app, {
			cancelLabel: this.localization.cancelButtonLabel,
			description: options.description,
			initialValue: options.initialValue,
			inputPlaceholder: this.localization.viewNamePlaceholder,
			submitLabel: options.submitLabel,
			title: options.title,
			validate: options.validate,
		});

		return modal.openAndGetValue();
	}

	private persistLastView(parsedBaseFile: ParsedBaseFile, activeViewName: string | null) {
		if (!this.plugin.settings.basesTopTabs.rememberLastView || !activeViewName) {
			return;
		}

		const validViewNames = new Set(parsedBaseFile.views.map((view) => view.name));
		if (!validViewNames.has(activeViewName)) {
			return;
		}

		void this.stateStore.setLastViewName(parsedBaseFile.filePath, activeViewName);
	}

	private rebuildButtons(visibleViews: OrderedTabView[]) {
		const settings = this.plugin.settings.basesTopTabs;
		this.tabsListEl.empty();
		this.buttonsByKey.clear();

		for (const view of visibleViews) {
			const buttonEl = document.createElement('button');
			buttonEl.type = 'button';
			buttonEl.className = 'obpm-bases-tab';
			buttonEl.draggable = this.currentOrderedViews.length > 1;
			buttonEl.setAttribute('data-view-name', view.name);
			buttonEl.setAttribute('data-view-type', view.type);
			buttonEl.setAttribute('data-view-key', view.key);
			buttonEl.setAttribute('role', 'tab');
			buttonEl.title = view.name;
			buttonEl.addEventListener('click', () => {
				void this.handleTabClick(view);
			});
			buttonEl.addEventListener('contextmenu', (event) => {
				this.handleTabContextMenu(event, view);
			});
			buttonEl.addEventListener('dragstart', (event) => {
				this.handleTabDragStart(event, view);
			});
			buttonEl.addEventListener('dragover', (event) => {
				this.handleTabDragOver(event, view, buttonEl);
			});
			buttonEl.addEventListener('drop', (event) => {
				void this.reorderFromDrop(event);
			});
			buttonEl.addEventListener('dragend', () => {
				this.handleTabDragEnd();
			});

			if (settings.showIcons) {
				const iconEl = document.createElement('span');
				iconEl.className = 'obpm-bases-tab-icon';
				setIcon(iconEl, view.icon);
				buttonEl.append(iconEl);
			}

			const labelEl = document.createElement('span');
			labelEl.className = 'obpm-bases-tab-label';
			labelEl.textContent = view.name;
			buttonEl.append(labelEl);

			if (view.pinned) {
				const pinEl = document.createElement('span');
				pinEl.className = 'obpm-bases-tab-pin';
				pinEl.setAttribute('aria-hidden', 'true');
				setIcon(pinEl, 'pin');
				buttonEl.append(pinEl);
			}

			this.buttonsByKey.set(view.key, buttonEl);
			this.tabsListEl.append(buttonEl);
		}
	}

	private async refresh(reason: string): Promise<void> {
		if (this.disposed) {
			return;
		}

		const refreshToken = ++this.refreshToken;
		const leafState = this.viewSwitcherAdapter.getLeafState(this.leaf);
		if (!leafState?.file || leafState.file.extension !== 'base') {
			this.removeBar();
			return;
		}

		const mountContext = this.domAdapter.resolveMountContext(
			this.leaf,
			this.plugin.settings.basesTopTabs.placement,
			this.plugin.settings.basesTopTabs.orientation,
		);
		if (!mountContext) {
			this.removeBar();
			return;
		}

		const parsedBaseFile = await this.configAdapter.readBaseFile(leafState.file);
		if (this.disposed || refreshToken !== this.refreshToken) {
			return;
		}

		if (!parsedBaseFile || parsedBaseFile.views.length === 0) {
			this.removeBar();
			return;
		}

		if (this.plugin.settings.basesTopTabs.hideWhenSingleView && parsedBaseFile.views.length <= 1) {
			this.removeBar();
			return;
		}

		if (this.lastFilePath !== parsedBaseFile.filePath) {
			this.lastFilePath = parsedBaseFile.filePath;
			this.pendingRestoreFilePath = parsedBaseFile.filePath;
		}

		const restoredLastView = await this.restoreLastViewIfNeeded(parsedBaseFile, leafState.currentViewName);
		if (restoredLastView) {
			return;
		}

		const activeViewName = this.viewSwitcherAdapter.getLeafState(this.leaf)?.currentViewName ?? leafState.currentViewName;
		const pinnedViewNames = this.stateStore.getPinnedViewNames(
			parsedBaseFile.filePath,
			parsedBaseFile.views.map((view) => view.name),
		);
		const orderedViews = orderViews(parsedBaseFile.views, pinnedViewNames);
		const {hiddenViews, visibleViews} = splitViewsForOverflow(
			orderedViews,
			this.plugin.settings.basesTopTabs.maxVisibleTabs,
			activeViewName,
		);

		this.currentParsedBaseFile = parsedBaseFile;
		this.currentOrderedViews = orderedViews;
		this.currentHiddenViews = hiddenViews;

		const structureSignature = this.buildStructureSignature(
			parsedBaseFile,
			visibleViews,
			hiddenViews,
			mountContext.actualPlacement,
		);
		if (structureSignature !== this.lastStructureSignature) {
			this.rebuildButtons(visibleViews);
			this.lastStructureSignature = structureSignature;
		}

		const activeViewKey = resolveActiveViewKey(parsedBaseFile, activeViewName);
		this.renderMoreButton(hiddenViews);
		this.applyBarState(parsedBaseFile.views.length, activeViewKey, mountContext.actualPlacement);
		this.domAdapter.mountBar(this.barEl, mountContext);
		this.persistLastView(parsedBaseFile, activeViewName);
		this.renderDropState();

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesTopTabs.debugMode, 'Rendered Base tabs.', {
			activeViewName,
			actualPlacement: mountContext.actualPlacement,
			filePath: parsedBaseFile.filePath,
			hiddenViews: hiddenViews.map((view) => view.name),
			pinnedViewNames,
			reason,
			viewCount: parsedBaseFile.views.length,
			visibleViews: visibleViews.map((view) => view.name),
		});
	}

	private removeBar() {
		this.currentHiddenViews = [];
		this.currentOrderedViews = [];
		this.currentParsedBaseFile = null;
		this.clearDragState();
		this.barEl.remove();
	}

	private async renameView(view: OrderedTabView) {
		const parsedBaseFile = this.currentParsedBaseFile;
		if (!parsedBaseFile) {
			return;
		}

		const nextName = await this.openViewNamePrompt({
			description: this.localization.renameViewDescription(view.name),
			initialValue: view.name,
			submitLabel: this.localization.renameViewSubmitLabel,
			title: this.localization.renameViewPromptTitle(view.name),
			validate: (value) => this.validateViewName(
				value,
				parsedBaseFile.views
					.map((entry) => entry.name)
					.filter((name) => name !== view.name),
			),
		});
		if (!nextName || nextName === view.name) {
			return;
		}

		const leafState = this.viewSwitcherAdapter.getLeafState(this.leaf);
		const isActiveView = leafState?.currentViewName === view.name;
		const renamed = await this.withBusyUi(async () => {
			const updatedBaseFile = await this.configAdapter.renameView(parsedBaseFile.file, view.key, nextName);
			return updatedBaseFile !== null;
		});

		if (!renamed) {
			new Notice(this.localization.updateViewsErrorNotice);
			return;
		}

		await this.stateStore.renameViewReference(parsedBaseFile.filePath, view.name, nextName);
		if (isActiveView) {
			await this.switchToViewByName(nextName, 'rename-view');
		}

		this.requestRefresh('rename-view');
	}

	private async reorderFromDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (!this.dragSourceKey || !this.dragTargetPosition || !this.dragTargetKey || this.busy) {
			this.clearDragState();
			return;
		}

		if (!this.canReorderBetweenKeys(this.dragSourceKey, this.dragTargetKey)) {
			this.clearDragState();
			return;
		}

		const nextOrderKeys = moveViewKey(
			this.currentOrderedViews.map((view) => view.key),
			this.dragSourceKey,
			this.dragTargetKey,
			this.dragTargetPosition,
		);
		this.clearDragState();
		if (!nextOrderKeys || !this.currentParsedBaseFile) {
			return;
		}

		const parsedBaseFile = this.currentParsedBaseFile;
		const reordered = await this.withBusyUi(async () => {
			const updatedBaseFile = await this.configAdapter.reorderViews(parsedBaseFile.file, nextOrderKeys);
			return updatedBaseFile !== null;
		});
		if (!reordered) {
			new Notice(this.localization.updateViewsErrorNotice);
			return;
		}

		this.requestRefresh('reorder');
	}

	private renderDropState() {
		for (const [viewKey, buttonEl] of this.buttonsByKey) {
			buttonEl.classList.toggle('is-drag-source', viewKey === this.dragSourceKey);
			buttonEl.classList.toggle(
				'mod-drop-before',
				viewKey === this.dragTargetKey && this.dragTargetPosition === 'before',
			);
			buttonEl.classList.toggle(
				'mod-drop-after',
				viewKey === this.dragTargetKey && this.dragTargetPosition === 'after',
			);
		}
	}

	private renderMoreButton(hiddenViews: OrderedTabView[]) {
		this.moreButtonEl.hidden = hiddenViews.length === 0;
		this.moreButtonEl.textContent = this.localization.moreViewsButtonLabel(hiddenViews.length);
	}

	private async restoreLastViewIfNeeded(parsedBaseFile: ParsedBaseFile, activeViewName: string | null): Promise<boolean> {
		if (!this.plugin.settings.basesTopTabs.rememberLastView) {
			this.pendingRestoreFilePath = null;
			return false;
		}

		if (this.pendingRestoreFilePath !== parsedBaseFile.filePath) {
			return false;
		}

		this.pendingRestoreFilePath = null;
		const lastViewName = this.stateStore.getLastViewName(
			parsedBaseFile.filePath,
			parsedBaseFile.views.map((view) => view.name),
		);
		if (!lastViewName || lastViewName === activeViewName) {
			return false;
		}

		const switched = await this.switchToViewByName(lastViewName, 'restore-last-view');
		if (!switched) {
			new Notice(this.localization.switchErrorNotice);
		}

		return switched;
	}

	private setButtonsDisabled(disabled: boolean) {
		for (const buttonEl of this.buttonsByKey.values()) {
			buttonEl.disabled = disabled;
			buttonEl.draggable = !disabled && this.buttonsByKey.size > 1;
		}

		this.moreButtonEl.disabled = disabled;
	}

	private async switchToViewByName(viewName: string, reason: string): Promise<boolean> {
		const leafState = this.viewSwitcherAdapter.getLeafState(this.leaf);
		if (!leafState || leafState.currentViewName === viewName) {
			return true;
		}

		const switched = await this.withBusyUi(async () => this.viewSwitcherAdapter.switchToView(this.leaf, viewName));
		if (switched) {
			this.requestRefresh(reason);
		}

		return switched;
	}

	private async togglePinnedState(view: OrderedTabView) {
		const parsedBaseFile = this.currentParsedBaseFile;
		if (!parsedBaseFile) {
			return;
		}

		const isPinned = this.stateStore.hasPinnedView(parsedBaseFile.filePath, view.name);
		await this.stateStore.setPinned(parsedBaseFile.filePath, view.name, !isPinned);
		this.requestRefresh('pin-toggle');
	}

	private validateViewName(value: string, existingNames: string[]): string | null {
		if (!value) {
			return this.localization.emptyViewNameNotice;
		}

		if (existingNames.includes(value)) {
			return this.localization.viewNameTakenNotice(value);
		}

		return null;
	}

	private async withBusyUi<T>(task: () => Promise<T>): Promise<T> {
		this.busy = true;
		this.setButtonsDisabled(true);
		try {
			return await task();
		} finally {
			this.busy = false;
			this.setButtonsDisabled(false);
		}
	}

	private canReorderBetweenKeys(sourceKey: string, targetKey: string): boolean {
		const sourceView = this.findOrderedViewByKey(sourceKey);
		const targetView = this.findOrderedViewByKey(targetKey);
		return Boolean(sourceView && targetView && sourceView.pinned === targetView.pinned);
	}

	private canReorderWithTarget(targetView: OrderedTabView): boolean {
		if (!this.dragSourceKey) {
			return false;
		}

		const sourceView = this.findOrderedViewByKey(this.dragSourceKey);
		return Boolean(sourceView && sourceView.pinned === targetView.pinned);
	}

	private findOrderedViewByKey(viewKey: string): OrderedTabView | null {
		return this.currentOrderedViews.find((view) => view.key === viewKey) ?? null;
	}
}

function createDuplicateViewNameSuggestion(existingNames: string[], sourceName: string, copySuffix: string): string {
	const candidateBaseName = `${sourceName} ${copySuffix}`.trim();
	if (!existingNames.includes(candidateBaseName)) {
		return candidateBaseName;
	}

	let counter = 2;
	while (existingNames.includes(`${candidateBaseName} ${counter}`)) {
		counter += 1;
	}

	return `${candidateBaseName} ${counter}`;
}

function moveViewKey(
	keys: string[],
	dragSourceKey: string,
	targetKey: string,
	position: DropPosition,
): string[] | null {
	const sourceIndex = keys.indexOf(dragSourceKey);
	const targetIndex = keys.indexOf(targetKey);
	if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
		return null;
	}

	const nextKeys = [...keys];
	const [movedKey] = nextKeys.splice(sourceIndex, 1);
	if (!movedKey) {
		return null;
	}

	let insertionIndex = targetIndex + (position === 'after' ? 1 : 0);
	if (sourceIndex < targetIndex) {
		insertionIndex -= 1;
	}

	nextKeys.splice(insertionIndex, 0, movedKey);
	return nextKeys.every((key, index) => key === keys[index]) ? null : nextKeys;
}

function orderViews(views: BasesTopTabsView[], pinnedViewNames: string[]): OrderedTabView[] {
	const pinnedNameSet = new Set(pinnedViewNames);
	return [...views]
		.map((view) => ({
			...view,
			pinned: pinnedNameSet.has(view.name),
		}))
		.sort((left, right) => {
			if (left.pinned !== right.pinned) {
				return left.pinned ? -1 : 1;
			}

			return left.index - right.index;
		});
}

function resolveActiveViewKey(parsedBaseFile: ParsedBaseFile, activeViewName: string | null): string | null {
	if (activeViewName) {
		const activeView = parsedBaseFile.views.find((view) => view.name === activeViewName);
		if (activeView) {
			return activeView.key;
		}
	}

	return parsedBaseFile.views[0]?.key ?? null;
}

function resolveDropPosition(
	event: DragEvent,
	buttonEl: HTMLButtonElement,
	orientation: 'horizontal' | 'vertical',
): DropPosition {
	const rect = buttonEl.getBoundingClientRect();
	if (orientation === 'vertical') {
		return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
	}

	return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}

function resolveFallbackViewName(orderedViews: OrderedTabView[], removedViewKey: string): string | null {
	const removedIndex = orderedViews.findIndex((view) => view.key === removedViewKey);
	if (removedIndex === -1) {
		return orderedViews[0]?.name ?? null;
	}

	return orderedViews[removedIndex + 1]?.name
		?? orderedViews[removedIndex - 1]?.name
		?? null;
}

function splitViewsForOverflow(
	orderedViews: OrderedTabView[],
	maxVisibleTabs: number,
	activeViewName: string | null,
): {hiddenViews: OrderedTabView[]; visibleViews: OrderedTabView[]} {
	if (maxVisibleTabs <= 0 || orderedViews.length <= maxVisibleTabs) {
		return {
			hiddenViews: [],
			visibleViews: orderedViews,
		};
	}

	const pinnedCount = orderedViews.filter((view) => view.pinned).length;
	const initialVisibleCount = Math.max(maxVisibleTabs, pinnedCount);
	const visibleSet = new Set(orderedViews.slice(0, initialVisibleCount).map((view) => view.key));
	const activeView = activeViewName
		? orderedViews.find((view) => view.name === activeViewName)
		: null;

	if (activeView && !visibleSet.has(activeView.key)) {
		const visibleViews = orderedViews.filter((view) => visibleSet.has(view.key));
		const candidateToHide = [...visibleViews]
			.reverse()
			.find((view) => !view.pinned);
		if (candidateToHide) {
			visibleSet.delete(candidateToHide.key);
		}

		visibleSet.add(activeView.key);
	}

	const visibleViews = orderedViews.filter((view) => visibleSet.has(view.key));
	const hiddenViews = orderedViews.filter((view) => !visibleSet.has(view.key));
	return {hiddenViews, visibleViews};
}
