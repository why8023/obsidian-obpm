import {Component, TAbstractFile, TFile, WorkspaceLeaf, debounce} from 'obsidian';
import {BaseConfigAdapter} from './base-config-adapter';
import {BaseDomAdapter} from './base-dom-adapter';
import {BaseViewSwitcherAdapter} from './base-view-switcher-adapter';
import {BasesTabsController} from './bases-top-tabs-controller';
import {BasesTopTabsStateStore} from './bases-top-tabs-state-store';
import {BasesTopTabsPluginContext} from './types';

const FEATURE_ID = 'bases-top-tabs';

export class BasesTopTabsFeature extends Component {
	private readonly configAdapter: BaseConfigAdapter;
	private readonly controllers = new Map<WorkspaceLeaf, BasesTabsController>();
	private readonly domAdapter: BaseDomAdapter;
	private readonly stateStore: BasesTopTabsStateStore;
	private readonly syncControllers = debounce(() => {
		this.reconcileControllers();
	}, 100, true);
	private readonly viewSwitcherAdapter: BaseViewSwitcherAdapter;

	constructor(private readonly plugin: BasesTopTabsPluginContext) {
		super();

		const debugLog = (message: string, details?: unknown) => {
			this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesTopTabs.debugMode, message, details);
		};

		this.configAdapter = new BaseConfigAdapter(this.plugin.app, debugLog);
		this.domAdapter = new BaseDomAdapter(debugLog);
		this.stateStore = new BasesTopTabsStateStore(this.plugin);
		this.viewSwitcherAdapter = new BaseViewSwitcherAdapter(this.plugin.app);
	}

	onload() {
		this.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
			this.requestSync('active-leaf-change');
		}));

		this.registerEvent(this.plugin.app.workspace.on('layout-change', () => {
			this.requestSync('layout-change');
		}));

		this.registerEvent(this.plugin.app.workspace.on('file-open', () => {
			this.requestSync('file-open');
		}));

		this.registerEvent(this.plugin.app.vault.on('modify', (file) => {
			if (!this.shouldHandleModify(file)) {
				return;
			}

			this.configAdapter.forgetFile(file.path);
			this.requestRefreshForFilePaths(`modify:${file.path}`, [file.path]);
		}));

		this.registerEvent(this.plugin.app.vault.on('rename', (file, oldPath) => {
			if (isBasePath(oldPath)) {
				this.configAdapter.forgetFile(oldPath);
			}

			if (file instanceof TFile && file.extension === 'base') {
				this.configAdapter.forgetFile(file.path);
			}

			if (isBasePath(oldPath) && file instanceof TFile && file.extension === 'base') {
				void this.stateStore.moveFileState(oldPath, file.path);
			} else if (isBasePath(oldPath)) {
				void this.stateStore.clearFileState(oldPath);
			}

			if (isBasePath(oldPath) || (file instanceof TFile && file.extension === 'base')) {
				const affectedPaths = [oldPath];
				if (file instanceof TFile && file.extension === 'base') {
					affectedPaths.push(file.path);
				}

				this.requestRefreshForFilePaths(`rename:${oldPath}`, affectedPaths);
			}
		}));

		this.registerEvent(this.plugin.app.vault.on('delete', (file) => {
			if (!isBasePath(file.path)) {
				return;
			}

			this.configAdapter.forgetFile(file.path);
			void this.stateStore.clearFileState(file.path);
			this.requestRefreshForFilePaths(`delete:${file.path}`, [file.path]);
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			this.requestSync('layout-ready');
		});

		this.requestSync('feature-load');
	}

	onunload() {
		this.syncControllers.cancel();
		this.destroyAllControllers();
	}

	async refresh(): Promise<void> {
		this.syncControllers.cancel();
		this.reconcileControllers();
	}

	private destroyAllControllers() {
		for (const controller of this.controllers.values()) {
			controller.destroy();
		}

		this.controllers.clear();
	}

	private reconcileControllers() {
		if (!this.plugin.settings.basesTopTabs.enabled) {
			this.destroyAllControllers();
			return;
		}

		const basesLeaves = this.plugin.app.workspace.getLeavesOfType('bases');
		const activeLeaves = new Set(basesLeaves);
		for (const [leaf, controller] of [...this.controllers.entries()]) {
			if (activeLeaves.has(leaf)) {
				controller.requestRefresh('reconcile');
				continue;
			}

			controller.destroy();
			this.controllers.delete(leaf);
		}

		for (const leaf of basesLeaves) {
			let controller = this.controllers.get(leaf);
			if (!controller) {
				controller = new BasesTabsController(
					this.plugin,
					leaf,
					this.configAdapter,
					this.domAdapter,
					this.viewSwitcherAdapter,
					this.stateStore,
				);
				this.controllers.set(leaf, controller);
			}

			controller.requestRefresh('reconcile');
		}
	}

	private requestSync(reason: string) {
		if (!this.plugin.settings.basesTopTabs.enabled) {
			this.destroyAllControllers();
			return;
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesTopTabs.debugMode, 'Requesting Base tabs sync.', {
			reason,
		});
		this.syncControllers();
	}

	private requestRefreshForFilePaths(reason: string, filePaths: string[]) {
		if (!this.plugin.settings.basesTopTabs.enabled) {
			this.destroyAllControllers();
			return;
		}

		const normalizedPaths = new Set(filePaths.filter((filePath) => filePath.length > 0));
		if (normalizedPaths.size === 0) {
			return;
		}

		this.plugin.debugFeatureLog(
			FEATURE_ID,
			this.plugin.settings.basesTopTabs.debugMode,
			'Requesting targeted Base tabs refresh.',
			{
				filePaths: [...normalizedPaths],
				reason,
			},
		);
		for (const [leaf, controller] of this.controllers) {
			const leafState = this.viewSwitcherAdapter.getLeafState(leaf);
			if (leafState && normalizedPaths.has(leafState.filePath)) {
				controller.requestRefresh(reason);
			}
		}
	}

	private shouldHandleModify(file: TAbstractFile): file is TFile {
		return this.plugin.settings.basesTopTabs.autoRefresh
			&& file instanceof TFile
			&& file.extension === 'base';
	}
}

function isBasePath(path: string): boolean {
	return path.toLowerCase().endsWith('.base');
}
