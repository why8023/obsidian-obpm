import {WorkspaceLeaf, debounce} from 'obsidian';
import {BaseViewSwitcherAdapter} from '../bases-top-tabs/base-view-switcher-adapter';
import {createViewContextKey, getViewStateKey} from './bases-group-fold-key-utils';
import {getBasesGroupFoldLocalization} from './bases-group-fold-localization';
import {BasesGroupFoldDomAdapter, DetectedBaseGroup} from './bases-group-fold-dom-adapter';
import {BasesGroupFoldStateStore} from './bases-group-fold-state-store';
import {BasesGroupFoldTableAdapter} from './bases-group-fold-table-adapter';
import {BasesGroupFoldPluginContext, BasesGroupFoldViewContext} from './types';

const FEATURE_ID = 'bases-group-fold';

export class BasesGroupFoldController {
	private disposed = false;
	private readonly localization = getBasesGroupFoldLocalization();
	private readonly observers: MutationObserver[] = [];
	private readonly refreshView = debounce((reason: string) => {
		void this.refresh(reason);
	}, 100, true);
	private refreshToken = 0;
	private readonly sessionCollapsedGroups = new Map<string, Set<string>>();

	constructor(
		private readonly plugin: BasesGroupFoldPluginContext,
		private readonly leaf: WorkspaceLeaf,
		private readonly domAdapter: BasesGroupFoldDomAdapter,
		private readonly tableAdapter: BasesGroupFoldTableAdapter,
		private readonly viewSwitcherAdapter: BaseViewSwitcherAdapter,
		private readonly stateStore: BasesGroupFoldStateStore,
	) {
		this.observers.push(...this.domAdapter.createObservers(this.leaf, () => {
			this.requestRefresh('dom-change');
		}));
	}

	destroy(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.refreshView.cancel();
		for (const observer of this.observers) {
			observer.disconnect();
		}

		this.observers.length = 0;
		this.tableAdapter.cleanup(this.leaf);
		this.domAdapter.cleanup(this.leaf);
		this.sessionCollapsedGroups.clear();
	}

	requestRefresh(reason: string): void {
		if (this.disposed) {
			return;
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesGroupFold.debugMode, 'Scheduling Bases group fold refresh.', {
			reason,
		});
		this.refreshView(reason);
	}

	private getCollapsedGroupKeys(filePath: string, viewStateKey: string): Set<string> {
		const contextKey = createViewContextKey(filePath, viewStateKey);
		let collapsedGroupKeys = this.sessionCollapsedGroups.get(contextKey);
		if (!collapsedGroupKeys) {
			collapsedGroupKeys = new Set(this.plugin.settings.basesGroupFold.rememberState
				? this.stateStore.getCollapsedGroupKeys(filePath, viewStateKey)
				: []);
			this.sessionCollapsedGroups.set(contextKey, collapsedGroupKeys);
		}

		return collapsedGroupKeys;
	}

	private async refresh(reason: string): Promise<void> {
		if (this.disposed) {
			return;
		}

		const refreshToken = ++this.refreshToken;
		const leafState = this.viewSwitcherAdapter.getLeafState(this.leaf);
		if (!leafState?.filePath) {
			this.domAdapter.cleanup(this.leaf);
			return;
		}

		const viewContext: BasesGroupFoldViewContext = {
			filePath: leafState.filePath,
			viewStateKey: getViewStateKey(leafState.currentViewName),
		};
		const collapsedGroupKeys = this.getCollapsedGroupKeys(viewContext.filePath, viewContext.viewStateKey);
		const detectedGroups = this.domAdapter.detectGroups(this.leaf);
		if (this.disposed || refreshToken !== this.refreshToken) {
			return;
		}

		if (detectedGroups.length === 0) {
			this.tableAdapter.cleanup(this.leaf);
			this.domAdapter.cleanup(this.leaf);
			return;
		}

		const validGroupKeys = new Set(detectedGroups.map((group) => group.key));
		this.pruneSessionCollapsedGroups(viewContext.filePath, viewContext.viewStateKey, validGroupKeys);
		if (this.plugin.settings.basesGroupFold.rememberState) {
			await this.stateStore.pruneViewState(viewContext.filePath, viewContext.viewStateKey, validGroupKeys);
			if (this.disposed || refreshToken !== this.refreshToken) {
				return;
			}
		}

		if (this.needsCollapsedStateSync(detectedGroups, collapsedGroupKeys)) {
			const applied = this.tableAdapter.applyCollapsedState(this.leaf, collapsedGroupKeys);
			if (applied) {
				this.requestRefresh('collapsed-state-sync');
				return;
			}
		}

		for (const group of detectedGroups) {
			const collapsed = collapsedGroupKeys.has(group.key);
			this.renderGroup(viewContext, group, collapsed);
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesGroupFold.debugMode, 'Rendered Bases group fold controls.', {
			filePath: viewContext.filePath,
			groupCount: detectedGroups.length,
			reason,
			viewStateKey: viewContext.viewStateKey,
		});
	}

	private needsCollapsedStateSync(detectedGroups: DetectedBaseGroup[], collapsedGroupKeys: ReadonlySet<string>): boolean {
		return detectedGroups.some((group) => {
			const domCollapsed = group.containerEl.dataset.obpmBasesGroupFoldCollapsed === 'true';
			const expectedCollapsed = collapsedGroupKeys.has(group.key);
			return domCollapsed !== expectedCollapsed;
		});
	}

	private pruneSessionCollapsedGroups(
		filePath: string,
		viewStateKey: string,
		validGroupKeys: Set<string>,
	): void {
		const contextKey = createViewContextKey(filePath, viewStateKey);
		const collapsedGroupKeys = this.sessionCollapsedGroups.get(contextKey);
		if (!collapsedGroupKeys) {
			return;
		}

		for (const groupKey of [...collapsedGroupKeys]) {
			if (!validGroupKeys.has(groupKey)) {
				collapsedGroupKeys.delete(groupKey);
			}
		}

		if (collapsedGroupKeys.size === 0) {
			this.sessionCollapsedGroups.delete(contextKey);
		}
	}

	private renderGroup(viewContext: BasesGroupFoldViewContext, group: DetectedBaseGroup, collapsed: boolean): void {
		this.domAdapter.ensureToggleButton(group, {
			collapsed,
			label: collapsed
				? this.localization.expandGroupLabel(group.label)
				: this.localization.collapseGroupLabel(group.label),
			onToggle: () => {
				void this.toggleGroup(viewContext, group);
			},
		});
		this.domAdapter.applyCollapsed(group, collapsed);
	}

	private async toggleGroup(viewContext: BasesGroupFoldViewContext, group: DetectedBaseGroup): Promise<void> {
		const collapsedGroupKeys = this.getCollapsedGroupKeys(viewContext.filePath, viewContext.viewStateKey);
		const nextCollapsed = !collapsedGroupKeys.has(group.key);
		if (nextCollapsed) {
			collapsedGroupKeys.add(group.key);
		} else {
			collapsedGroupKeys.delete(group.key);
		}

		const contextKey = createViewContextKey(viewContext.filePath, viewContext.viewStateKey);
		if (collapsedGroupKeys.size === 0) {
			this.sessionCollapsedGroups.delete(contextKey);
		} else {
			this.sessionCollapsedGroups.set(contextKey, collapsedGroupKeys);
		}

		const applied = this.tableAdapter.applyCollapsedState(this.leaf, collapsedGroupKeys);
		if (applied) {
			this.requestRefresh('toggle');
		} else {
			this.renderGroup(viewContext, group, nextCollapsed);
		}
		if (this.plugin.settings.basesGroupFold.rememberState) {
			await this.stateStore.setGroupCollapsed(
				viewContext.filePath,
				viewContext.viewStateKey,
				group.key,
				nextCollapsed,
			);
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesGroupFold.debugMode, 'Toggled Bases group fold state.', {
			collapsed: nextCollapsed,
			filePath: viewContext.filePath,
			groupKey: group.key,
			viewStateKey: viewContext.viewStateKey,
		});
	}
}
