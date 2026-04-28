import {CachedMetadata, Component, Menu, Notice, TAbstractFile, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {PendingProjectRoutingQueue} from '../project-routing/pending-queue';
import {
	isProjectFile,
	ProjectFileRecognitionOptions,
	resolveCurrentProject,
} from '../project-routing/project-resolver';
import {getDisplayText} from '../related-links/source-index';
import {
	appendUniqueRelationLinkValue,
	buildProjectWikilinkValue,
} from './frontmatter-relation';
import {
	buildMarkdownListItemForWikilink,
	getHeadingSectionContent,
	insertListItemIntoHeadingSection,
	wikilinkSectionContainsPath,
} from './markdown-section';
import {getPinnedProjectLocalization} from './pinned-project-localization';
import {getPinnedProjectRuleDecision, PinnedProjectRuleDecision} from './pinned-project-rules';
import {PinnedProjectStatusBar} from './pinned-project-status-bar';

const FEATURE_ID = 'pinned-project';
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
			id: 'pin-current-project',
			name: this.localization.pinCommandName,
			callback: async () => {
				const projectFile = this.getCurrentProjectFile();
				if (!projectFile) {
					new Notice(this.localization.noProjectNotice);
					return;
				}

				await this.pinProject(projectFile);
			},
		});

		this.plugin.addCommand({
			id: 'clear-pinned-project',
			name: this.localization.clearCommandName,
			callback: async () => {
				await this.clearPinnedProject(true);
			},
		});

		this.registerEvent(this.plugin.app.workspace.on('file-menu', (menu, file) => {
			this.registerProjectFileMenuItem(menu, file);
		}));

		this.registerEvent(this.plugin.app.workspace.on('files-menu', (menu, files) => {
			if (files.length !== 1) {
				return;
			}

			const selectedFile = files[0];
			if (!selectedFile) {
				return;
			}

			this.registerProjectFileMenuItem(menu, selectedFile);
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

	private registerProjectFileMenuItem(menu: Menu, file: TAbstractFile): void {
		if (!(file instanceof TFile) || file.extension !== 'md') {
			return;
		}

		if (!isProjectFile(this.plugin.app, file, this.getProjectFileRecognitionOptions())) {
			return;
		}

		menu.addItem((item) => item
			.setTitle(this.localization.pinMenuItemLabel)
			.setIcon('pin')
			.onClick(() => {
				void this.pinProject(file);
			}));
	}

	private handleFileCreated(file: TAbstractFile): void {
		if (!this.shouldQueueFile(file)) {
			return;
		}

		this.pendingQueue.add(file.path);
		this.debugLog('Queued created markdown file for pinned-project linking.', {
			filePath: file.path,
		});
		this.scheduleFlush();
	}

	private handleMetadataChanged(file: TFile): void {
		if (!this.pendingQueue.has(file.path)) {
			return;
		}

		this.pendingQueue.markReadyForImmediateRetry(file.path);
		this.debugLog('Metadata changed for pending pinned-project file.', {
			filePath: file.path,
		});
		this.scheduleFlush();
	}

	private handleFileRenamed(file: TAbstractFile, oldPath: string): void {
		if (this.pendingQueue.has(oldPath)) {
			this.pendingQueue.rename(oldPath, file.path);
			this.scheduleFlush();
		}

		if (oldPath !== this.plugin.settings.pinnedProject.projectPath || !(file instanceof TFile)) {
			return;
		}

		this.plugin.settings.pinnedProject.projectPath = file.path;
		void this.plugin.saveSettings({
			refreshFeatures: false,
		});
		this.statusBar.refresh();
		this.debugLog('Updated pinned project path after rename.', {
			nextPath: file.path,
			oldPath,
		});
	}

	private handleFileDeleted(file: TAbstractFile): void {
		this.pendingQueue.remove(file.path);
		this.processingPaths.delete(file.path);
		if (file.path !== this.plugin.settings.pinnedProject.projectPath) {
			return;
		}

		void this.clearPinnedProject(false);
	}

	private shouldQueueFile(file: TAbstractFile): file is TFile {
		if (!this.isEnabled() || !(file instanceof TFile) || file.extension !== 'md') {
			return false;
		}

		return file.path !== this.plugin.settings.pinnedProject.projectPath;
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

		const projectFile = this.getPinnedProjectFile();
		if (!projectFile) {
			this.pendingQueue.clear();
			this.processingPaths.clear();
			await this.clearPinnedProject(false);
			new Notice(this.localization.projectMissingNotice);
			return;
		}

		if (projectFile.path === file.path) {
			this.pendingQueue.remove(filePath);
			return;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const decision = this.getPendingDecision(cache);
		if (decision === 'defer') {
			const retryDelayMs = this.pendingQueue.defer(filePath);
			this.debugLog('Deferred pinned-project linking until metadata is ready.', {
				filePath,
				retryDelayMs,
			});
			return;
		}

		if (decision === 'skip') {
			this.pendingQueue.remove(filePath);
			this.debugLog('Skipped pinned-project linking for this file.', {
				filePath,
			});
			return;
		}

		this.processingPaths.add(filePath);
		try {
			await this.linkFileToPinnedProject(file, projectFile, cache);
			this.pendingQueue.remove(filePath);
			this.pendingQueue.remove(file.path);
		} catch (error) {
			console.error('[OBPM] Failed to link a new file to the pinned project.', {
				error,
				filePath: file.path,
				projectPath: projectFile.path,
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
			excludeRules: this.plugin.settings.pinnedProject.excludeRules,
			includeRules: this.plugin.settings.pinnedProject.includeRules,
		});
	}

	private async linkFileToPinnedProject(file: TFile, projectFile: TFile, cache: CachedMetadata | null): Promise<void> {
		if (this.plugin.settings.pinnedProject.linkMode === 'project-section') {
			await this.appendLinkToProjectSection(file, projectFile, cache);
			return;
		}

		await this.appendLinkToRelationProperty(file, projectFile);
	}

	private async appendLinkToRelationProperty(file: TFile, projectFile: TFile): Promise<void> {
		const relationProperty = this.plugin.settings.relatedLinks.relationProperty.trim();
		if (!relationProperty) {
			throw new Error('Cannot append pinned project relation because relationProperty is empty.');
		}

		const projectLinkValue = buildProjectWikilinkValue(projectFile.path);
		let changed = false;
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const frontmatterRecord = frontmatter as Record<string, unknown>;
			const appendResult = appendUniqueRelationLinkValue(
				frontmatterRecord[relationProperty],
				projectLinkValue,
				projectFile.path,
			);
			if (!appendResult.changed) {
				return;
			}

			frontmatterRecord[relationProperty] = appendResult.value;
			changed = true;
		});

		this.debugLog(changed ? 'Added pinned project to relation property.' : 'Relation property already included pinned project.', {
			filePath: file.path,
			projectPath: projectFile.path,
			relationProperty,
		});
	}

	private async appendLinkToProjectSection(file: TFile, projectFile: TFile, cache: CachedMetadata | null): Promise<void> {
		const sectionHeading = this.plugin.settings.pinnedProject.sectionHeading;
		const currentContent = await this.plugin.app.vault.read(projectFile);
		const existingSectionContent = getHeadingSectionContent(currentContent, sectionHeading);
		if (existingSectionContent && wikilinkSectionContainsPath(existingSectionContent, file.path)) {
			this.debugLog('Project section already includes a link to the new file.', {
				filePath: file.path,
				projectPath: projectFile.path,
				sectionHeading,
			});
			return;
		}

		const displayText = getDisplayText(
			file,
			cache?.frontmatter,
			this.plugin.settings.relatedLinks.displayProperty.trim(),
		);
		const listItem = buildMarkdownListItemForWikilink(file.path, displayText);
		const nextContent = insertListItemIntoHeadingSection(currentContent, sectionHeading, listItem);
		if (nextContent === currentContent) {
			return;
		}

		await this.plugin.app.vault.modify(projectFile, nextContent);
		this.debugLog('Inserted pinned-project link into project section.', {
			filePath: file.path,
			projectPath: projectFile.path,
			sectionHeading,
		});
	}

	private getCurrentProjectFile(): TFile | null {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		const resolution = resolveCurrentProject(this.plugin.app, activeFile, this.getProjectFileRecognitionOptions());
		return resolution.kind === 'project' ? resolution.candidate.file : null;
	}

	private getPinnedProjectFile(): TFile | null {
		const projectPath = this.plugin.settings.pinnedProject.projectPath;
		if (!projectPath) {
			return null;
		}

		const projectFile = this.plugin.app.vault.getAbstractFileByPath(projectPath);
		return projectFile instanceof TFile && projectFile.extension === 'md' ? projectFile : null;
	}

	private getProjectFileRecognitionOptions(): ProjectFileRecognitionOptions {
		return {
			projectFileRules: this.plugin.settings.projectRouting.projectFileRules,
			projectSubfolderPath: this.plugin.settings.projectRouting.projectSubfolderPath,
			recognizeFilenameMatchesFolderAsProject:
				this.plugin.settings.projectRouting.recognizeFilenameMatchesFolderAsProject,
		};
	}

	private async pinProject(projectFile: TFile): Promise<void> {
		this.plugin.settings.pinnedProject.enabled = true;
		this.plugin.settings.pinnedProject.projectPath = projectFile.path;
		await this.plugin.saveSettings({
			refreshFeatures: ['pinnedProject'],
		});
		new Notice(this.localization.pinNotice(projectFile.basename));
		this.debugLog('Pinned project.', {
			projectPath: projectFile.path,
		});
	}

	private async clearPinnedProject(showNotice: boolean): Promise<void> {
		const hadPinnedProject = Boolean(this.plugin.settings.pinnedProject.projectPath);
		this.plugin.settings.pinnedProject.enabled = false;
		this.plugin.settings.pinnedProject.projectPath = '';
		await this.plugin.saveSettings({
			refreshFeatures: ['pinnedProject'],
		});
		if (showNotice && hadPinnedProject) {
			new Notice(this.localization.clearNotice);
		}
		this.debugLog('Cleared pinned project.');
	}

	private isEnabled(): boolean {
		return this.plugin.settings.pinnedProject.enabled
			&& this.plugin.settings.pinnedProject.projectPath.length > 0;
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
