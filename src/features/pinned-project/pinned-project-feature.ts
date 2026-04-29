import {CachedMetadata, Component, Menu, Notice, TAbstractFile, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {PendingProjectRoutingQueue} from '../project-routing/pending-queue';
import {
	appendUniqueRelationLinkValue,
	buildTargetWikilinkValue,
} from './frontmatter-relation';
import {getPinnedProjectLocalization} from './pinned-project-localization';
import {getPinnedProjectRuleDecision, PinnedProjectRuleDecision} from './pinned-project-rules';
import {PinnedProjectStatusBar} from './pinned-project-status-bar';

const FEATURE_ID = 'pinned-relation-target';
const MAX_PENDING_FILE_AGE_MS = 120000;
const PROCESS_DELAY_MS = 1200;

export class PinnedProjectFeature extends Component {
	private readonly localization = getPinnedProjectLocalization();
	private readonly pendingQueue = new PendingProjectRoutingQueue();
	private readonly processingPaths = new Set<string>();
	private readonly statusBar: PinnedProjectStatusBar;
	private eventListenersRegistered = false;
	private flushTimer: number | null = null;
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
		this.statusBar = new PinnedProjectStatusBar(plugin);
	}

	onload() {
		this.plugin.addCommand({
			id: 'pin-current-file-as-relation-target',
			name: this.localization.pinCommandName,
			callback: async () => {
				const targetFile = this.getCurrentMarkdownFile();
				if (!targetFile) {
					new Notice(this.localization.noTargetNotice);
					return;
				}

				await this.pinTarget(targetFile);
			},
		});

		this.plugin.addCommand({
			id: 'clear-pinned-relation-target',
			name: this.localization.clearCommandName,
			callback: async () => {
				await this.clearPinnedTarget(true);
			},
		});

		this.registerEvent(this.plugin.app.workspace.on('file-menu', (menu, file) => {
			this.registerTargetFileMenuItem(menu, file);
		}));

		this.registerEvent(this.plugin.app.workspace.on('files-menu', (menu, files) => {
			if (files.length !== 1) {
				return;
			}

			const selectedFile = files[0];
			if (!selectedFile) {
				return;
			}

			this.registerTargetFileMenuItem(menu, selectedFile);
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			this.ensureEventListenersRegistered();
			void this.refresh();
		});
	}

	onunload() {
		this.clearFlushTimer();
		this.pendingQueue.clear();
		this.processingPaths.clear();
		this.statusBar.destroy();
	}

	async refresh(): Promise<void> {
		this.clearFlushTimer();
		this.statusBar.refresh();
		if (!this.isEnabled()) {
			this.pendingQueue.clear();
			this.processingPaths.clear();
			return;
		}

		if (this.pendingQueue.size() > 0) {
			this.scheduleNextFlush();
		}
	}

	private ensureEventListenersRegistered(): void {
		if (this.eventListenersRegistered) {
			return;
		}

		this.eventListenersRegistered = true;
		this.registerEvent(this.plugin.app.vault.on('create', (file) => {
			this.handleFileCreated(file);
		}));
		this.registerEvent(this.plugin.app.metadataCache.on('changed', (file) => {
			this.handleMetadataChanged(file);
		}));
		this.registerEvent(this.plugin.app.vault.on('rename', (file, oldPath) => {
			this.handleFileRenamed(file, oldPath);
		}));
		this.registerEvent(this.plugin.app.vault.on('delete', (file) => {
			this.handleFileDeleted(file);
		}));
	}

	private registerTargetFileMenuItem(menu: Menu, file: TAbstractFile): void {
		if (!(file instanceof TFile) || file.extension !== 'md') {
			return;
		}

		if (this.isPinnedTargetFile(file)) {
			menu.addItem((item) => item
				.setTitle(this.localization.unpinMenuItemLabel)
				.setIcon('pin-off')
				.onClick(() => {
					void this.clearPinnedTarget(true);
				}));
			return;
		}

		menu.addItem((item) => item
			.setTitle(this.localization.pinMenuItemLabel)
			.setIcon('pin')
			.onClick(() => {
				void this.pinTarget(file);
			}));
	}

	private handleFileCreated(file: TAbstractFile): void {
		if (!this.shouldQueueFile(file)) {
			return;
		}

		this.pendingQueue.add(file.path);
		this.debugLog('Queued created markdown file for pinned relation target linking.', {
			filePath: file.path,
		});
		this.scheduleFlush();
	}

	private handleMetadataChanged(file: TFile): void {
		if (!this.pendingQueue.has(file.path)) {
			return;
		}

		this.pendingQueue.markReadyForImmediateRetry(file.path);
		this.debugLog('Metadata changed for pending pinned relation target file.', {
			filePath: file.path,
		});
		this.scheduleFlush();
	}

	private handleFileRenamed(file: TAbstractFile, oldPath: string): void {
		if (this.pendingQueue.has(oldPath)) {
			this.pendingQueue.rename(oldPath, file.path);
			this.scheduleFlush();
		}

		if (oldPath !== this.plugin.settings.pinnedRelationTarget.targetPath || !(file instanceof TFile)) {
			return;
		}

		this.plugin.settings.pinnedRelationTarget.targetPath = file.path;
		void this.plugin.saveSettings({
			refreshFeatures: false,
		});
		this.statusBar.refresh();
		this.debugLog('Updated pinned relation target path after rename.', {
			nextPath: file.path,
			oldPath,
		});
	}

	private handleFileDeleted(file: TAbstractFile): void {
		this.pendingQueue.remove(file.path);
		this.processingPaths.delete(file.path);
		if (file.path !== this.plugin.settings.pinnedRelationTarget.targetPath) {
			return;
		}

		void this.clearPinnedTarget(false);
	}

	private shouldQueueFile(file: TAbstractFile): file is TFile {
		if (!this.isEnabled() || !(file instanceof TFile) || file.extension !== 'md') {
			return false;
		}

		return file.path !== this.plugin.settings.pinnedRelationTarget.targetPath;
	}

	private async flushPendingWork(): Promise<void> {
		await this.enqueue(async () => {
			if (!this.isEnabled()) {
				this.pendingQueue.clear();
				this.processingPaths.clear();
				return;
			}

			const duePaths = this.pendingQueue.getDuePaths();
			if (duePaths.length === 0) {
				this.scheduleNextFlush();
				return;
			}

			for (const filePath of duePaths) {
				await this.processPendingFile(filePath);
			}

			this.scheduleNextFlush();
		});
	}

	private async processPendingFile(filePath: string): Promise<void> {
		if (this.processingPaths.has(filePath)) {
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile) || file.extension !== 'md') {
			this.pendingQueue.remove(filePath);
			return;
		}

		if (this.pendingQueue.isExpired(filePath, MAX_PENDING_FILE_AGE_MS)) {
			this.pendingQueue.remove(filePath);
			this.debugLog('Stopped waiting to link file because the pending entry aged out.', {
				filePath,
			});
			return;
		}

		const targetFile = this.getPinnedTargetFile();
		if (!targetFile) {
			this.pendingQueue.clear();
			this.processingPaths.clear();
			await this.clearPinnedTarget(false);
			new Notice(this.localization.targetMissingNotice);
			return;
		}

		if (targetFile.path === file.path) {
			this.pendingQueue.remove(filePath);
			return;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const decision = this.getPendingDecision(cache);
		if (decision === 'defer') {
			const retryDelayMs = this.pendingQueue.defer(filePath);
			this.debugLog('Deferred pinned relation target linking until metadata is ready.', {
				filePath,
				retryDelayMs,
			});
			return;
		}

		if (decision === 'skip') {
			this.pendingQueue.remove(filePath);
			this.debugLog('Skipped pinned relation target linking for this file.', {
				filePath,
			});
			return;
		}

		this.processingPaths.add(filePath);
		try {
			await this.appendLinkToRelationProperty(file, targetFile);
			this.pendingQueue.remove(filePath);
			this.pendingQueue.remove(file.path);
		} catch (error) {
			console.error('[OBPM] Failed to link a new file to the pinned relation target.', {
				error,
				filePath: file.path,
				targetPath: targetFile.path,
			});
			new Notice(this.localization.linkFailureNotice);
			this.pendingQueue.remove(filePath);
		} finally {
			this.processingPaths.delete(filePath);
			this.processingPaths.delete(file.path);
		}
	}

	private getPendingDecision(cache: CachedMetadata | null): PinnedProjectRuleDecision {
		return getPinnedProjectRuleDecision(cache, {
			excludeRules: this.plugin.settings.pinnedRelationTarget.excludeRules,
			includeRules: this.plugin.settings.pinnedRelationTarget.includeRules,
		});
	}

	private async appendLinkToRelationProperty(file: TFile, targetFile: TFile): Promise<void> {
		const relationProperty = this.plugin.settings.relatedLinks.relationProperty.trim();
		if (!relationProperty) {
			throw new Error('Cannot append pinned relation target because relationProperty is empty.');
		}

		const targetLinkValue = buildTargetWikilinkValue(targetFile.path);
		let changed = false;
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const frontmatterRecord = frontmatter as Record<string, unknown>;
			const appendResult = appendUniqueRelationLinkValue(
				frontmatterRecord[relationProperty],
				targetLinkValue,
				targetFile.path,
			);
			if (!appendResult.changed) {
				return;
			}

			frontmatterRecord[relationProperty] = appendResult.value;
			changed = true;
		});

		this.debugLog(changed ? 'Added pinned relation target to relation property.' : 'Relation property already included pinned relation target.', {
			filePath: file.path,
			targetPath: targetFile.path,
			relationProperty,
		});
	}

	private getCurrentMarkdownFile(): TFile | null {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		return activeFile instanceof TFile && activeFile.extension === 'md' ? activeFile : null;
	}

	private getPinnedTargetFile(): TFile | null {
		const targetPath = this.plugin.settings.pinnedRelationTarget.targetPath;
		if (!targetPath) {
			return null;
		}

		const targetFile = this.plugin.app.vault.getAbstractFileByPath(targetPath);
		return targetFile instanceof TFile && targetFile.extension === 'md' ? targetFile : null;
	}

	private isPinnedTargetFile(file: TFile): boolean {
		return this.plugin.settings.pinnedRelationTarget.enabled
			&& this.plugin.settings.pinnedRelationTarget.targetPath === file.path;
	}

	private async pinTarget(targetFile: TFile): Promise<void> {
		this.plugin.settings.pinnedRelationTarget.enabled = true;
		this.plugin.settings.pinnedRelationTarget.targetPath = targetFile.path;
		await this.plugin.saveSettings({
			refreshFeatures: ['pinnedRelationTarget'],
		});
		new Notice(this.localization.pinNotice(targetFile.basename));
		this.debugLog('Pinned relation target.', {
			targetPath: targetFile.path,
		});
	}

	private async clearPinnedTarget(showNotice: boolean): Promise<void> {
		const hadPinnedTarget = Boolean(this.plugin.settings.pinnedRelationTarget.targetPath);
		this.plugin.settings.pinnedRelationTarget.enabled = false;
		this.plugin.settings.pinnedRelationTarget.targetPath = '';
		await this.plugin.saveSettings({
			refreshFeatures: ['pinnedRelationTarget'],
		});
		if (showNotice && hadPinnedTarget) {
			new Notice(this.localization.clearNotice);
		}
		this.debugLog('Cleared pinned relation target.');
	}

	private isEnabled(): boolean {
		return this.plugin.settings.pinnedRelationTarget.enabled
			&& this.plugin.settings.pinnedRelationTarget.targetPath.length > 0;
	}

	private scheduleFlush(delayMs = PROCESS_DELAY_MS): void {
		this.clearFlushTimer();
		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null;
			void this.flushPendingWork();
		}, delayMs);
	}

	private scheduleNextFlush(): void {
		const nextDelayMs = this.pendingQueue.getNextDelay();
		if (nextDelayMs === null) {
			return;
		}

		this.scheduleFlush(nextDelayMs);
	}

	private clearFlushTimer(): void {
		if (this.flushTimer === null) {
			return;
		}

		window.clearTimeout(this.flushTimer);
		this.flushTimer = null;
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		this.workQueue = this.workQueue.then(task, task);
		return this.workQueue;
	}

	private debugLog(message: string, details?: unknown): void {
		this.plugin.debugFeatureLog(FEATURE_ID, false, message, details);
	}
}
