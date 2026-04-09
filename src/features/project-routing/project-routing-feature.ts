import {Component, Notice, TAbstractFile, TFile, debounce, normalizePath} from 'obsidian';
import OBPMPlugin from '../../main';
import {getProjectRoutingLocalization} from './localization';
import {matchesAnyFrontmatterRule} from './matcher';
import {ProjectRoutingSuggestModal} from './modal';
import {PendingProjectRoutingQueue} from './pending-queue';
import {getOpenProjectCandidates} from './project-resolver';
import {ProjectRoutingStatusBar} from './status-bar';
import {ProjectCandidate} from './types';

const FEATURE_ID = 'project-routing';
const MAX_PENDING_FILE_AGE_MS = 120000;

export class ProjectRoutingFeature extends Component {
	private readonly localization = getProjectRoutingLocalization();
	private readonly pendingQueue = new PendingProjectRoutingQueue();
	private readonly processingPaths = new Set<string>();
	private readonly requestStatusBarRefresh = debounce(() => {
		this.statusBar.refresh();
	}, 100, true);
	private readonly statusBar: ProjectRoutingStatusBar;
	private flushTimer: number | null = null;
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
		this.statusBar = new ProjectRoutingStatusBar(plugin);
	}

	onload() {
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

		this.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
			this.requestStatusBarRefresh();
		}));

		this.registerEvent(this.plugin.app.workspace.on('file-open', () => {
			this.requestStatusBarRefresh();
		}));

		this.registerEvent(this.plugin.app.workspace.on('layout-change', () => {
			this.requestStatusBarRefresh();
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			void this.refresh();
		});
	}

	onunload() {
		this.requestStatusBarRefresh.cancel();
		this.clearFlushTimer();
		this.pendingQueue.clear();
		this.processingPaths.clear();
		this.statusBar.destroy();
	}

	async refresh(): Promise<void> {
		this.clearFlushTimer();

		if (!this.isEnabled()) {
			this.pendingQueue.clear();
			this.processingPaths.clear();
			this.requestStatusBarRefresh.cancel();
			this.statusBar.destroy();
			return;
		}

		this.statusBar.refresh();

		if (this.pendingQueue.size() > 0) {
			this.scheduleFlush();
		}
	}

	private buildTargetPath(file: TFile, targetFolderPath: string): string {
		const initialPath = joinPath(targetFolderPath, file.name);
		if (initialPath === file.path || !this.plugin.app.vault.getAbstractFileByPath(initialPath)) {
			return initialPath;
		}

		for (let suffix = 1; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
			const candidateName = `${file.basename} ${suffix}.${file.extension}`;
			const candidatePath = joinPath(targetFolderPath, candidateName);
			if (candidatePath === file.path || !this.plugin.app.vault.getAbstractFileByPath(candidatePath)) {
				return candidatePath;
			}
		}

		return initialPath;
	}

	private clearFlushTimer(): void {
		if (this.flushTimer === null) {
			return;
		}

		window.clearTimeout(this.flushTimer);
		this.flushTimer = null;
	}

	private debugLog(message: string, details?: unknown): void {
		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.projectRouting.debugLog, message, details);
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		this.workQueue = this.workQueue.then(task, task);
		return this.workQueue;
	}

	private async flushPendingWork(): Promise<void> {
		await this.enqueue(async () => {
			if (!this.isEnabled()) {
				this.pendingQueue.clear();
				this.processingPaths.clear();
				this.statusBar.destroy();
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

	private handleFileCreated(file: TAbstractFile): void {
		if (!this.isEnabled() || !this.isMarkdownFile(file)) {
			return;
		}

		this.pendingQueue.add(file.path);
		this.debugLog('Queued a new markdown file for project routing.', {
			filePath: file.path,
		});
		this.scheduleFlush();
	}

	private handleFileDeleted(file: TAbstractFile): void {
		this.pendingQueue.remove(file.path);
		this.processingPaths.delete(file.path);
		this.requestStatusBarRefresh();
	}

	private handleFileRenamed(file: TAbstractFile, oldPath: string): void {
		if (this.isMarkdownFile(file)) {
			this.pendingQueue.rename(oldPath, file.path);
			if (this.pendingQueue.has(file.path)) {
				this.debugLog('Updated pending project routing entry after rename.', {
					filePath: file.path,
					oldPath,
				});
				this.scheduleFlush();
			}
		}

		this.requestStatusBarRefresh();
	}

	private handleMetadataChanged(file: TFile): void {
		if (this.pendingQueue.has(file.path)) {
			this.pendingQueue.markReadyForImmediateRetry(file.path);
			this.debugLog('Observed metadata change for a pending project-routing file.', {
				filePath: file.path,
				hasFrontmatter: Boolean(this.plugin.app.metadataCache.getFileCache(file)?.frontmatter),
			});
			this.scheduleFlush();
		}

		this.requestStatusBarRefresh();
	}

	private isEnabled(): boolean {
		return this.plugin.settings.projectRouting.enabled;
	}

	private isMarkdownFile(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === 'md';
	}

	private async pickTargetProject(candidates: readonly ProjectCandidate[]): Promise<ProjectCandidate | null> {
		const firstCandidate = candidates[0];
		if (candidates.length === 1 && firstCandidate && this.plugin.settings.projectRouting.autoMoveWhenSingleCandidate) {
			return firstCandidate;
		}

		const modal = new ProjectRoutingSuggestModal(this.plugin.app, {
			candidates,
			localization: this.localization,
		});
		return await modal.openAndGetResult();
	}

	private async processPendingFile(filePath: string): Promise<void> {
		if (this.processingPaths.has(filePath)) {
			return;
		}

		const abstractFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
		if (!(abstractFile instanceof TFile) || abstractFile.extension !== 'md') {
			this.pendingQueue.remove(filePath);
			return;
		}

		if (this.pendingQueue.isExpired(filePath, MAX_PENDING_FILE_AGE_MS)) {
			this.pendingQueue.remove(filePath);
			this.debugLog('Stopped waiting for project-routing frontmatter because the file aged out.', {
				filePath,
			});
			return;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(abstractFile);
		if (cache && !cache.frontmatter) {
			this.pendingQueue.remove(filePath);
			this.debugLog('Metadata parsed without frontmatter, so the file left the project-routing queue.', {
				filePath,
			});
			return;
		}

		const frontmatter = cache?.frontmatter;
		if (!frontmatter) {
			const retryDelayMs = this.pendingQueue.defer(filePath);
			this.debugLog('Frontmatter is not ready yet. Scheduled another project-routing check.', {
				filePath,
				retryDelayMs,
			});
			return;
		}

		if (!matchesAnyFrontmatterRule(frontmatter, this.plugin.settings.projectRouting.routableFileRules)) {
			this.pendingQueue.remove(filePath);
			this.debugLog('Frontmatter parsed, but the file does not match any project-routing rule.', {
				filePath,
			});
			return;
		}

		this.processingPaths.add(filePath);
		try {
			await this.routeFile(abstractFile);
		} finally {
			this.processingPaths.delete(filePath);
			this.processingPaths.delete(abstractFile.path);
		}
	}

	private async routeFile(file: TFile): Promise<void> {
		const sourcePath = file.path;
		const sourceName = file.name;

		try {
			const candidates = getOpenProjectCandidates(
				this.plugin.app,
				this.plugin.settings.projectRouting.projectRule,
				{excludePath: sourcePath},
			);
			if (candidates.length === 0) {
				this.pendingQueue.remove(sourcePath);
				this.debugLog('Skipped project routing because there is no open project candidate.', {
					filePath: sourcePath,
				});
				return;
			}

			const targetProject = await this.pickTargetProject(candidates);
			this.pendingQueue.remove(sourcePath);
			if (!targetProject) {
				this.debugLog('User canceled project routing for a new file.', {
					filePath: sourcePath,
				});
				return;
			}

			const targetPath = this.buildTargetPath(file, targetProject.folderPath);
			if (targetPath === sourcePath) {
				this.debugLog('Skipped project routing because the file is already in the target project folder.', {
					filePath: sourcePath,
					targetPath,
				});
				this.requestStatusBarRefresh();
				return;
			}

			await this.plugin.app.fileManager.renameFile(file, targetPath);
			this.debugLog('Moved a new markdown file into the selected project folder.', {
				filePath: sourcePath,
				projectFilePath: targetProject.file.path,
				targetPath,
			});
			if (this.plugin.settings.projectRouting.showNoticeAfterMove) {
				new Notice(this.localization.moveNotice(sourceName, targetProject.name));
			}
			this.requestStatusBarRefresh();
		} catch (error) {
			this.pendingQueue.remove(sourcePath);
			console.error('[OBPM] Failed to move a new markdown file into a project folder.', error);
			new Notice(this.localization.moveFailureNotice);
		}
	}

	private scheduleFlush(delayMs = 0): void {
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
}

function joinPath(folderPath: string, fileName: string): string {
	return folderPath.length > 0 ? normalizePath(`${folderPath}/${fileName}`) : fileName;
}
