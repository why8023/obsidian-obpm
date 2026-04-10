import {CachedMetadata, Component, Notice, TAbstractFile, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {FrontmatterAutomationService} from './frontmatter-automation-service';
import {FrontmatterSnapshot} from './frontmatter-automation-types';
import {areFrontmatterSnapshotsEqual, createFrontmatterSnapshot} from './frontmatter-automation-utils';

const DEFAULT_FLUSH_DELAY_MS = 200;
const EMPTY_FRONTMATTER_SNAPSHOT: FrontmatterSnapshot = Object.freeze({});
const OWN_WRITE_TTL_MS = 5000;

interface PendingMetadataChange {
	file: TFile;
	generation: number;
	snapshot: FrontmatterSnapshot | null;
	version: number;
}

interface PendingOwnWrite {
	expectedSnapshot: FrontmatterSnapshot;
	expiresAt: number;
}

export class FrontmatterAutomationFeature extends Component {
	private readonly changeVersionByPath = new Map<string, number>();
	private readonly fileWorkQueues = new Map<string, Promise<void>>();
	private readonly pendingMetadataChanges = new Map<string, PendingMetadataChange>();
	private readonly pendingOwnWrites = new Map<string, PendingOwnWrite>();
	private readonly service = new FrontmatterAutomationService();
	private readonly stableSnapshots = new Map<string, FrontmatterSnapshot>();
	private flushTimer: number | null = null;
	private stateGeneration = 0;

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload() {
		this.registerEvent(this.plugin.app.metadataCache.on('changed', (file, _data, cache) => {
			this.handleMetadataChanged(file, cache);
		}));

		this.registerEvent(this.plugin.app.vault.on('create', (file) => {
			this.handleFileCreated(file);
		}));

		this.registerEvent(this.plugin.app.vault.on('delete', (file) => {
			this.handleFileDeleted(file);
		}));

		this.registerEvent(this.plugin.app.vault.on('rename', (file, oldPath) => {
			this.handleFileRenamed(file, oldPath);
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			void this.refresh();
		});
	}

	onunload() {
		this.clearFlushTimer();
		this.resetState();
	}

	async refresh(): Promise<void> {
		this.clearFlushTimer();
		this.resetState();

		if (!this.isEnabled()) {
			return;
		}

		this.primeSnapshotsFromMetadataCache();
	}

	private clearFileState(filePath: string): void {
		this.changeVersionByPath.delete(filePath);
		this.fileWorkQueues.delete(filePath);
		this.pendingMetadataChanges.delete(filePath);
		this.pendingOwnWrites.delete(filePath);
		this.stableSnapshots.delete(filePath);
	}

	private clearFlushTimer(): void {
		if (this.flushTimer === null) {
			return;
		}

		window.clearTimeout(this.flushTimer);
		this.flushTimer = null;
	}

	private enqueueFileWork(filePath: string, task: () => Promise<void>): Promise<void> {
		const nextTask = (this.fileWorkQueues.get(filePath) ?? Promise.resolve())
			.catch(() => undefined)
			.then(task);

		this.fileWorkQueues.set(filePath, nextTask);
		void nextTask.finally(() => {
			if (this.fileWorkQueues.get(filePath) === nextTask) {
				this.fileWorkQueues.delete(filePath);
			}
		});

		return nextTask;
	}

	private async flushPendingWork(): Promise<void> {
		if (!this.isEnabled()) {
			this.pendingMetadataChanges.clear();
			return;
		}

		const pendingChanges = [...this.pendingMetadataChanges.values()];
		this.pendingMetadataChanges.clear();

		await Promise.all(
			pendingChanges.map((change) => this.enqueueFileWork(change.file.path, async () => {
				await this.processMetadataChange(change);
			})),
		);
	}

	private handleError(filePath: string, error: unknown): void {
		console.error('[OBPM] Failed to apply frontmatter automation.', {
			error,
			filePath,
		});
		new Notice('Failed to apply frontmatter automation. Check the developer console for details.');
	}

	private handleFileCreated(file: TAbstractFile): void {
		if (!this.isEnabled() || !this.isMarkdownFile(file)) {
			return;
		}

		this.setStableSnapshot(file.path, createFrontmatterSnapshot(this.plugin.app.metadataCache.getFileCache(file)?.frontmatter));
	}

	private handleFileDeleted(file: TAbstractFile): void {
		this.clearFileState(file.path);
	}

	private handleFileRenamed(file: TAbstractFile, oldPath: string): void {
		if (!this.isMarkdownFile(file)) {
			this.clearFileState(oldPath);
			this.clearFileState(file.path);
			return;
		}

		moveMapValue(this.changeVersionByPath, oldPath, file.path);
		moveMapValue(this.pendingOwnWrites, oldPath, file.path);
		moveMapValue(this.stableSnapshots, oldPath, file.path);

		const pendingChange = this.pendingMetadataChanges.get(oldPath);
		if (pendingChange) {
			this.pendingMetadataChanges.delete(oldPath);
			this.pendingMetadataChanges.set(file.path, {
				...pendingChange,
				file,
			});
		}

		const queuedWork = this.fileWorkQueues.get(oldPath);
		if (queuedWork) {
			this.fileWorkQueues.delete(oldPath);
			this.fileWorkQueues.set(file.path, queuedWork);
		}
	}

	private handleMetadataChanged(file: TFile, cache: CachedMetadata | null): void {
		if (!this.isEnabled() || !this.isMarkdownFile(file)) {
			return;
		}

		const snapshot = createFrontmatterSnapshot(cache?.frontmatter);
		const pendingOwnWrite = this.pendingOwnWrites.get(file.path);
		if (pendingOwnWrite) {
			if (pendingOwnWrite.expiresAt <= Date.now()) {
				this.pendingOwnWrites.delete(file.path);
			} else if (areFrontmatterSnapshotsEqual(snapshot, pendingOwnWrite.expectedSnapshot)) {
				this.pendingOwnWrites.delete(file.path);
				this.setStableSnapshot(file.path, snapshot);
				return;
			} else {
				this.pendingOwnWrites.delete(file.path);
			}
		}

		const version = (this.changeVersionByPath.get(file.path) ?? 0) + 1;
		this.changeVersionByPath.set(file.path, version);
		this.pendingMetadataChanges.set(file.path, {
			file,
			generation: this.stateGeneration,
			snapshot,
			version,
		});
		this.scheduleFlush();
	}

	private isEnabled(): boolean {
		return this.plugin.settings.frontmatterAutomation.enableFrontmatterAutomation;
	}

	private isMarkdownFile(file: TAbstractFile | null): file is TFile {
		return file instanceof TFile && file.extension === 'md';
	}

	private async processMetadataChange(change: PendingMetadataChange): Promise<void> {
		if (!this.isEnabled() || change.generation !== this.stateGeneration) {
			return;
		}

		const currentVersion = this.changeVersionByPath.get(change.file.path) ?? 0;
		if (currentVersion !== change.version) {
			return;
		}

		const liveFile = this.plugin.app.vault.getAbstractFileByPath(change.file.path);
		if (!this.isMarkdownFile(liveFile)) {
			this.clearFileState(change.file.path);
			return;
		}

		if (change.snapshot === null) {
			this.setStableSnapshot(change.file.path, null);
			return;
		}

		const previousSnapshot = this.stableSnapshots.get(change.file.path);
		if (!previousSnapshot) {
			this.setStableSnapshot(change.file.path, change.snapshot);
			return;
		}

		const observedEvaluation = this.service.evaluate({
			currentSnapshot: change.snapshot,
			previousSnapshot,
			settings: this.plugin.settings.frontmatterAutomation,
		});
		if (observedEvaluation.actions.length === 0) {
			this.setStableSnapshot(change.file.path, change.snapshot);
			return;
		}

		if ((this.changeVersionByPath.get(change.file.path) ?? 0) !== change.version) {
			return;
		}

		const now = new Date();
		let didMutateFrontmatter = false;
		let resolvedSnapshot: FrontmatterSnapshot | null = null;

		try {
			await this.plugin.app.fileManager.processFrontMatter(liveFile, (frontmatter) => {
				const liveSnapshot = createFrontmatterSnapshot(frontmatter as Record<string, unknown> | null | undefined);
				if (liveSnapshot === null) {
					resolvedSnapshot = null;
					return;
				}

				if (!this.isEnabled() || change.generation !== this.stateGeneration) {
					resolvedSnapshot = liveSnapshot;
					return;
				}

				if ((this.changeVersionByPath.get(change.file.path) ?? 0) !== change.version) {
					resolvedSnapshot = liveSnapshot;
					return;
				}

				const liveEvaluation = this.service.evaluate({
					currentSnapshot: liveSnapshot,
					previousSnapshot,
					settings: this.plugin.settings.frontmatterAutomation,
					now,
				});
				if (liveEvaluation.actions.length === 0) {
					resolvedSnapshot = liveSnapshot;
					return;
				}

				this.service.applyActions(frontmatter as Record<string, unknown>, liveEvaluation.actions);
				didMutateFrontmatter = true;
				resolvedSnapshot = liveEvaluation.nextSnapshot;
			});
		} catch (error) {
			this.handleError(change.file.path, error);
			return;
		}

		if (!this.isEnabled() || change.generation !== this.stateGeneration) {
			return;
		}

		if ((this.changeVersionByPath.get(change.file.path) ?? 0) !== change.version) {
			return;
		}

		this.setStableSnapshot(change.file.path, resolvedSnapshot);
		if (!didMutateFrontmatter || resolvedSnapshot === null) {
			return;
		}

		this.pendingOwnWrites.set(change.file.path, {
			expectedSnapshot: resolvedSnapshot,
			expiresAt: Date.now() + OWN_WRITE_TTL_MS,
		});
	}

	private resetState(): void {
		this.stateGeneration += 1;
		this.changeVersionByPath.clear();
		this.fileWorkQueues.clear();
		this.pendingMetadataChanges.clear();
		this.pendingOwnWrites.clear();
		this.stableSnapshots.clear();
	}

	private primeSnapshotsFromMetadataCache(): void {
		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			this.setStableSnapshot(file.path, createFrontmatterSnapshot(this.plugin.app.metadataCache.getFileCache(file)?.frontmatter));
		}
	}

	private scheduleFlush(delayMs = DEFAULT_FLUSH_DELAY_MS): void {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
		}

		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null;
			void this.flushPendingWork();
		}, delayMs);
	}

	private setStableSnapshot(filePath: string, snapshot: FrontmatterSnapshot | null): void {
		this.stableSnapshots.set(filePath, snapshot ?? EMPTY_FRONTMATTER_SNAPSHOT);
	}
}

function moveMapValue<T>(map: Map<string, T>, fromPath: string, toPath: string): void {
	const value = map.get(fromPath);
	if (value === undefined) {
		return;
	}

	map.delete(fromPath);
	map.set(toPath, value);
}
