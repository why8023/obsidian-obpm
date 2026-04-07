import {Component, TAbstractFile, TFile, WorkspaceLeaf, debounce} from 'obsidian';
import {BaseViewSwitcherAdapter} from '../bases-top-tabs/base-view-switcher-adapter';
import {BasesGroupFoldController} from './bases-group-fold-controller';
import {BasesGroupFoldDomAdapter} from './bases-group-fold-dom-adapter';
import {BasesGroupFoldStateStore} from './bases-group-fold-state-store';
import {BasesGroupFoldPluginContext} from './types';

const FEATURE_ID = 'bases-group-fold';

export class BasesGroupFoldFeature extends Component {
	private readonly controllers = new Map<WorkspaceLeaf, BasesGroupFoldController>();
	private readonly domAdapter: BasesGroupFoldDomAdapter;
	private readonly stateStore: BasesGroupFoldStateStore;
	private readonly syncControllers = debounce(() => {
		this.reconcileControllers();
	}, 100, true);
	private readonly viewSwitcherAdapter: BaseViewSwitcherAdapter;

	constructor(private readonly plugin: BasesGroupFoldPluginContext) {
		super();

		const debugLog = (message: string, details?: unknown) => {
			this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesGroupFold.debugMode, message, details);
		};

		this.domAdapter = new BasesGroupFoldDomAdapter(debugLog);
		this.stateStore = new BasesGroupFoldStateStore(this.plugin);
		this.viewSwitcherAdapter = new BaseViewSwitcherAdapter(this.plugin.app);
	}

	onload(): void {
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

			this.requestRefreshForFilePaths(`modify:${file.path}`, [file.path]);
		}));

		this.registerEvent(this.plugin.app.vault.on('rename', (file, oldPath) => {
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

			void this.stateStore.clearFileState(file.path);
			this.requestRefreshForFilePaths(`delete:${file.path}`, [file.path]);
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			this.requestSync('layout-ready');
		});

		this.requestSync('feature-load');
	}

	onunload(): void {
		this.syncControllers.cancel();
		this.destroyAllControllers();
	}

	async refresh(): Promise<void> {
		this.syncControllers.cancel();
		this.reconcileControllers();
	}

	private destroyAllControllers(): void {
		for (const controller of this.controllers.values()) {
			controller.destroy();
		}

		this.controllers.clear();
	}

	private reconcileControllers(): void {
		if (!this.plugin.settings.basesGroupFold.enabled) {
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
				controller = new BasesGroupFoldController(
					this.plugin,
					leaf,
					this.domAdapter,
					this.viewSwitcherAdapter,
					this.stateStore,
				);
				this.controllers.set(leaf, controller);
			}

			controller.requestRefresh('reconcile');
		}
	}

	private requestRefreshForFilePaths(reason: string, filePaths: string[]): void {
		if (!this.plugin.settings.basesGroupFold.enabled) {
			this.destroyAllControllers();
			return;
		}

		const normalizedPaths = new Set(filePaths.filter((filePath) => filePath.length > 0));
		if (normalizedPaths.size === 0) {
			return;
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesGroupFold.debugMode, 'Requesting targeted Bases group fold refresh.', {
			filePaths: [...normalizedPaths],
			reason,
		});
		for (const [leaf, controller] of this.controllers) {
			const leafState = this.viewSwitcherAdapter.getLeafState(leaf);
			if (leafState && normalizedPaths.has(leafState.filePath)) {
				controller.requestRefresh(reason);
			}
		}
	}

	private requestSync(reason: string): void {
		if (!this.plugin.settings.basesGroupFold.enabled) {
			this.destroyAllControllers();
			return;
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.basesGroupFold.debugMode, 'Requesting Bases group fold sync.', {
			reason,
		});
		this.syncControllers();
	}

	private shouldHandleModify(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === 'base';
	}
}

function isBasePath(path: string): boolean {
	return path.toLowerCase().endsWith('.base');
}
