import {Notice, WorkspaceLeaf, debounce, setIcon} from 'obsidian';
import {BaseConfigAdapter} from './base-config-adapter';
import {BaseDomAdapter} from './base-dom-adapter';
import {getBasesTopTabsLocalization} from './bases-top-tabs-localization';
import {BaseViewSwitcherAdapter} from './base-view-switcher-adapter';
import {BasesTopTabsPluginContext, BasesTopTabsView, ParsedBaseFile} from './types';

const FEATURE_ID = 'bases-top-tabs';

export class BasesTabsController {
	private readonly barEl: HTMLDivElement;
	private readonly buttonsByKey = new Map<string, HTMLButtonElement>();
	private readonly countEl: HTMLDivElement;
	private disposed = false;
	private lastStructureSignature = '';
	private readonly localization = getBasesTopTabsLocalization();
	private readonly observers: MutationObserver[] = [];
	private refreshToken = 0;
	private readonly refreshView = debounce((reason: string) => {
		void this.refresh(reason);
	}, 100, true);
	private switching = false;
	private readonly tabsListEl: HTMLDivElement;

	constructor(
		private readonly plugin: BasesTopTabsPluginContext,
		private readonly leaf: WorkspaceLeaf,
		private readonly configAdapter: BaseConfigAdapter,
		private readonly domAdapter: BaseDomAdapter,
		private readonly viewSwitcherAdapter: BaseViewSwitcherAdapter,
	) {
		this.barEl = document.createElement('div');
		this.barEl.className = 'obpm-bases-tabs-bar';
		this.barEl.setAttribute('data-obpm-feature', FEATURE_ID);

		this.tabsListEl = document.createElement('div');
		this.tabsListEl.className = 'obpm-bases-tabs-list';
		this.tabsListEl.setAttribute('aria-label', this.localization.tabListLabel);
		this.tabsListEl.setAttribute('role', 'tablist');

		this.countEl = document.createElement('div');
		this.countEl.className = 'obpm-bases-tabs-count';

		this.barEl.append(this.tabsListEl, this.countEl);
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

	private applyBarState(viewCount: number, activeViewKey: string | null, actualPlacement: 'above-toolbar' | 'inside-toolbar') {
		const settings = this.plugin.settings.basesTopTabs;
		this.barEl.classList.toggle('has-count', settings.showViewCount);
		this.barEl.classList.toggle('is-scrollable', settings.scrollable);
		this.barEl.classList.toggle('mod-inside-toolbar', actualPlacement === 'inside-toolbar');
		this.countEl.hidden = !settings.showViewCount;
		this.countEl.textContent = settings.showViewCount ? this.localization.viewCountLabel(viewCount) : '';

		for (const [viewKey, buttonEl] of this.buttonsByKey) {
			const isActive = viewKey === activeViewKey;
			buttonEl.classList.toggle('is-active', isActive);
			buttonEl.setAttribute('aria-selected', String(isActive));
			buttonEl.tabIndex = isActive ? 0 : -1;
		}
	}

	private buildStructureSignature(parsedBaseFile: ParsedBaseFile): string {
		return JSON.stringify({
			filePath: parsedBaseFile.filePath,
			showIcons: this.plugin.settings.basesTopTabs.showIcons,
			views: parsedBaseFile.views.map((view) => [view.key, view.name, view.type, view.icon]),
		});
	}

	private async handleTabClick(view: BasesTopTabsView) {
		if (this.switching) {
			return;
		}

		const leafState = this.viewSwitcherAdapter.getLeafState(this.leaf);
		if (!leafState || leafState.currentViewName === view.name) {
			return;
		}

		this.switching = true;
		this.setButtonsDisabled(true);
		try {
			const switched = await this.viewSwitcherAdapter.switchToView(this.leaf, view.name);
			if (!switched) {
				new Notice(this.localization.switchErrorNotice);
			}
		} finally {
			this.switching = false;
			this.setButtonsDisabled(false);
			this.requestRefresh('view-switch');
		}
	}

	private rebuildButtons(parsedBaseFile: ParsedBaseFile) {
		const settings = this.plugin.settings.basesTopTabs;
		this.tabsListEl.empty();
		this.buttonsByKey.clear();

		for (const view of parsedBaseFile.views) {
			const buttonEl = document.createElement('button');
			buttonEl.type = 'button';
			buttonEl.className = 'obpm-bases-tab';
			buttonEl.setAttribute('data-view-name', view.name);
			buttonEl.setAttribute('data-view-type', view.type);
			buttonEl.setAttribute('role', 'tab');
			buttonEl.title = view.name;
			buttonEl.addEventListener('click', () => {
				void this.handleTabClick(view);
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

		const mountContext = this.domAdapter.resolveMountContext(this.leaf, this.plugin.settings.basesTopTabs.placement);
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

		const structureSignature = this.buildStructureSignature(parsedBaseFile);
		if (structureSignature !== this.lastStructureSignature) {
			this.rebuildButtons(parsedBaseFile);
			this.lastStructureSignature = structureSignature;
		}

		const activeViewKey = resolveActiveViewKey(parsedBaseFile, leafState.currentViewName);
		this.applyBarState(parsedBaseFile.views.length, activeViewKey, mountContext.actualPlacement);
		this.domAdapter.mountBar(this.barEl, mountContext);

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesTopTabs.debugMode, 'Rendered Base tabs.', {
			activeViewName: leafState.currentViewName,
			actualPlacement: mountContext.actualPlacement,
			duplicateViewNames: parsedBaseFile.duplicateViewNames,
			filePath: parsedBaseFile.filePath,
			reason,
			viewCount: parsedBaseFile.views.length,
		});
	}

	private removeBar() {
		this.barEl.remove();
	}

	private setButtonsDisabled(disabled: boolean) {
		for (const buttonEl of this.buttonsByKey.values()) {
			buttonEl.disabled = disabled;
		}
	}
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
