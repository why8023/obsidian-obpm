import {CachedMetadata, Component, Notice, normalizePath, TAbstractFile, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {getFileNamePropertyValue, sanitizeFileBasename} from './file-name-sync-utils';

interface PendingFileUpdate {
	cache: CachedMetadata | null;
	file: TFile;
}

export class FileNameSyncFeature extends Component {
	private readonly pendingFileUpdates = new Map<string, PendingFileUpdate>();
	private readonly pendingOwnRenames = new Map<string, string>();
	private flushTimer: number | null = null;
	private hasInitialized = false;
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload() {
		this.registerEvent(this.plugin.app.metadataCache.on('changed', (file, _data, cache) => {
			this.queueFileUpdate(file, cache);
		}));

		this.registerEvent(this.plugin.app.vault.on('create', (file) => {
			if (this.isMarkdownFile(file)) {
				this.queueFileUpdate(file);
			}
		}));

		this.registerEvent(this.plugin.app.vault.on('rename', (file, oldPath) => {
			if (!this.isMarkdownFile(file)) {
				return;
			}

			if (this.shouldIgnoreOwnRename(file, oldPath)) {
				return;
			}

			this.queueFileUpdate(file);
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			void this.refresh();
		});
	}

	onunload() {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
		}
	}

	async refresh(): Promise<void> {
		this.pendingFileUpdates.clear();

		if (!this.isEnabled()) {
			this.pendingOwnRenames.clear();
			this.hasInitialized = false;
			return;
		}

		await this.runFullSync();
	}

	async runFullSync(): Promise<void> {
		if (!this.isEnabled()) {
			return;
		}

		await this.enqueue(async () => {
			try {
				for (const file of this.plugin.app.vault.getMarkdownFiles()) {
					await this.syncFileName(file);
				}

				this.hasInitialized = true;
			} catch (error) {
				this.handleError(error);
			}
		});
	}

	private queueFileUpdate(file: TFile, cache: CachedMetadata | null = this.plugin.app.metadataCache.getFileCache(file)) {
		if (!this.isEnabled()) {
			return;
		}

		this.pendingFileUpdates.set(file.path, {cache, file});
		this.scheduleFlush();
	}

	private scheduleFlush() {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
		}

		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null;
			void this.flushPendingWork();
		}, 300);
	}

	private async flushPendingWork() {
		if (!this.isEnabled()) {
			this.pendingFileUpdates.clear();
			return;
		}

		const pendingFileUpdates = [...this.pendingFileUpdates.values()];
		this.pendingFileUpdates.clear();

		if (!this.hasInitialized) {
			await this.runFullSync();
			return;
		}

		if (pendingFileUpdates.length === 0) {
			return;
		}

		await this.enqueue(async () => {
			try {
				for (const pendingFileUpdate of pendingFileUpdates) {
					await this.syncFileName(pendingFileUpdate.file, pendingFileUpdate.cache);
				}
			} catch (error) {
				this.handleError(error);
			}
		});
	}

	private async syncFileName(file: TFile, cache: CachedMetadata | null = this.plugin.app.metadataCache.getFileCache(file)) {
		const propertyName = this.plugin.settings.fileNameSync.propertyName.trim();
		if (!propertyName) {
			return;
		}

		const propertyValue = getFileNamePropertyValue(cache?.frontmatter, propertyName);
		if (!propertyValue) {
			return;
		}

		const nextBasename = sanitizeFileBasename(propertyValue, {
			invalidCharacterReplacement: this.plugin.settings.fileNameSync.invalidCharacterReplacement,
			maxLength: this.plugin.settings.fileNameSync.maxFileNameLength,
		});
		if (!nextBasename || nextBasename === file.basename) {
			return;
		}

		const nextPath = this.buildTargetPath(file, nextBasename);
		if (nextPath === file.path) {
			return;
		}

		const existingFile = this.plugin.app.vault.getAbstractFileByPath(nextPath);
		if (existingFile && existingFile.path !== file.path) {
			console.warn('[OBPM] Skipped file name sync because the target path already exists.', {
				currentPath: file.path,
				nextPath,
				propertyName,
				propertyValue,
			});
			return;
		}

		this.pendingOwnRenames.set(file.path, nextPath);
		try {
			await this.plugin.app.fileManager.renameFile(file, nextPath);
		} catch (error) {
			this.pendingOwnRenames.delete(file.path);
			throw error;
		}
	}

	private buildTargetPath(file: TFile, nextBasename: string): string {
		const parentPath = file.parent?.path ?? '';
		const nextFileName = `${nextBasename}.${file.extension}`;
		return parentPath ? normalizePath(`${parentPath}/${nextFileName}`) : nextFileName;
	}

	private shouldIgnoreOwnRename(file: TFile, oldPath: string): boolean {
		const expectedNextPath = this.pendingOwnRenames.get(oldPath);
		if (!expectedNextPath) {
			return false;
		}

		this.pendingOwnRenames.delete(oldPath);
		return expectedNextPath === file.path;
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		this.workQueue = this.workQueue.then(task);
		return this.workQueue;
	}

	private handleError(error: unknown) {
		console.error('Failed to sync file names from a frontmatter property.', error);
		new Notice('Failed to sync file names from a frontmatter property. Check the developer console for details.');
	}

	private isEnabled(): boolean {
		return this.plugin.settings.fileNameSync.enabled;
	}

	private isMarkdownFile(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === 'md';
	}
}
