import {Component, WorkspaceLeaf, debounce} from 'obsidian';
import OBPMPlugin from '../../main';
import {BasesFileRevealController} from './bases-file-reveal-controller';

export class BasesFileRevealFeature extends Component {
	private readonly controllers = new Map<WorkspaceLeaf, BasesFileRevealController>();
	private readonly syncControllers = debounce(() => {
		this.reconcileControllers();
	}, 100, true);

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload(): void {
		this.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
			this.requestSync();
		}));

		this.registerEvent(this.plugin.app.workspace.on('layout-change', () => {
			this.requestSync();
		}));

		this.registerEvent(this.plugin.app.workspace.on('file-open', () => {
			this.requestSync();
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			this.requestSync();
		});

		this.requestSync();
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
		if (!this.plugin.settings.basesFileReveal.enabled) {
			this.destroyAllControllers();
			return;
		}

		const basesLeaves = this.plugin.app.workspace.getLeavesOfType('bases');
		const activeLeaves = new Set(basesLeaves);

		for (const [leaf, controller] of [...this.controllers.entries()]) {
			if (activeLeaves.has(leaf)) {
				continue;
			}

			controller.destroy();
			this.controllers.delete(leaf);
		}

		for (const leaf of basesLeaves) {
			if (this.controllers.has(leaf)) {
				continue;
			}

			this.controllers.set(leaf, new BasesFileRevealController(this.plugin, leaf));
		}
	}

	private requestSync(): void {
		if (!this.plugin.settings.basesFileReveal.enabled) {
			this.destroyAllControllers();
			return;
		}

		this.syncControllers();
	}
}
