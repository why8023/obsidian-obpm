import {CachedMetadata, Component, Notice, normalizePath, TAbstractFile, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {
	appendLinkLine,
	buildMarkdownLinkLine,
	buildRelativeMarkdownDestination,
	extractMarkdownLinkpath,
	getDisplayText,
	getTargetLinkpaths,
	SourceContribution,
	unescapeMarkdownLinkText,
} from './related-link-utils';

interface FullSyncOptions {
	force?: boolean;
	notifyOnError?: boolean;
}

interface PendingFileChange {
	cache: CachedMetadata;
	data: string;
	file: TFile;
}

interface PendingDeletedFile {
	file: TFile;
	prevCache: CachedMetadata | null;
}

interface PendingRenamedFile {
	file: TFile;
	oldPath: string;
}

interface DesiredTargetLink {
	displayText: string;
	sourcePath: string;
}

interface SyncModel {
	desiredLinksByTarget: Map<string, Map<string, DesiredTargetLink>>;
	sourceContributionsByPath: Map<string, SourceContribution>;
	sourceDisplayTextByPath: Map<string, string>;
}

interface ProcessedTargetContent {
	content: string;
	presentManagedSourcePaths: Set<string>;
}

interface VaultConfigReader {
	getConfig?: (key: string) => unknown;
}

const DEFAULT_FLUSH_DELAY_MS = 300;

export class RelatedLinksFeature extends Component {
	private readonly pendingChangedFiles = new Map<string, PendingFileChange>();
	private readonly pendingCreatedFiles = new Map<string, TFile>();
	private readonly pendingDeletedFiles = new Map<string, PendingDeletedFile>();
	private readonly pendingFollowUpTargetPaths = new Set<string>();
	private readonly pendingRenamedFiles = new Map<string, PendingRenamedFile>();
	private readonly pendingOwnWrites = new Map<string, string>();
	private readonly pendingObsidianRenameTargetPaths = new Set<string>();
	private readonly renamedSourcePaths = new Map<string, string>();
	private readonly sourceContributionsByPath = new Map<string, SourceContribution>();
	private readonly sourceDisplayTextByPath = new Map<string, string>();
	private flushTimer: number | null = null;
	private fullSyncQueued = false;
	private hasInitialized = false;
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload() {
		this.registerEvent(this.plugin.app.metadataCache.on('changed', (file, data, cache) => {
			this.queueChangedFile(file, data, cache);
		}));

		this.registerEvent(this.plugin.app.metadataCache.on('deleted', (file, prevCache) => {
			this.queueDeletedFile(file, prevCache);
		}));

		this.registerEvent(this.plugin.app.vault.on('create', (file) => {
			if (this.isMarkdownFile(file)) {
				this.queueCreatedFile(file);
			}
		}));

		this.registerEvent(this.plugin.app.vault.on('rename', (file, oldPath) => {
			if (this.isMarkdownFile(file)) {
				this.queueRenamedFile(file, oldPath);
			}
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
		this.pendingChangedFiles.clear();
		this.pendingCreatedFiles.clear();
		this.pendingDeletedFiles.clear();
		this.pendingFollowUpTargetPaths.clear();
		this.pendingRenamedFiles.clear();
		this.fullSyncQueued = false;
		this.plugin.debugLog('Refresh requested.');

		if (!this.isEnabled()) {
			this.pendingOwnWrites.clear();
			this.pendingFollowUpTargetPaths.clear();
			this.pendingObsidianRenameTargetPaths.clear();
			this.renamedSourcePaths.clear();
			this.sourceContributionsByPath.clear();
			this.sourceDisplayTextByPath.clear();
			this.hasInitialized = false;
			this.plugin.debugLog('Refresh skipped because related links are disabled.');
			return;
		}

		await this.runFullSync({force: true});
	}

	async runFullSync(options: FullSyncOptions = {}): Promise<void> {
		if (!this.isEnabled()) {
			this.plugin.debugLog('Full sync skipped because related links are disabled.');
			return;
		}

		this.fullSyncQueued = false;
		this.plugin.debugLog('Starting full sync.', {
			force: options.force ?? false,
			notifyOnError: options.notifyOnError ?? true,
		});
		await this.enqueue(async () => {
			try {
				await this.syncAllRelatedLinks();
				this.hasInitialized = true;
				this.plugin.debugLog('Full sync completed successfully.');
			} catch (error) {
				this.handleError(error, options.notifyOnError ?? true);
			}
		});
	}

	private queueChangedFile(file: TFile, data: string, cache: CachedMetadata) {
		if (!this.isEnabled() || !this.isMarkdownFile(file)) {
			return;
		}

		if (this.pendingObsidianRenameTargetPaths.delete(file.path)) {
			this.pendingFollowUpTargetPaths.add(file.path);
			this.plugin.debugLog('Queued follow-up target sync after Obsidian-managed link update.', {
				filePath: file.path,
			});
			this.scheduleFlush();
			return;
		}

		this.pendingChangedFiles.set(file.path, {cache, data, file});
		this.plugin.debugLog('Queued metadata change.', {
			filePath: file.path,
			hasFrontmatter: Boolean(cache.frontmatter),
		});
		this.scheduleFlush();
	}

	private queueCreatedFile(file: TFile) {
		if (!this.isEnabled()) {
			return;
		}

		this.pendingCreatedFiles.set(file.path, file);
		this.plugin.debugLog('Queued file creation.', {
			filePath: file.path,
		});
		this.scheduleFlush();
	}

	private queueDeletedFile(file: TFile, prevCache: CachedMetadata | null) {
		if (!this.isEnabled()) {
			return;
		}

		this.pendingDeletedFiles.set(file.path, {file, prevCache});
		this.plugin.debugLog('Queued file deletion.', {
			filePath: file.path,
			hasPrevCache: Boolean(prevCache),
		});
		this.scheduleFlush();
	}

	private queueRenamedFile(file: TFile, oldPath: string) {
		if (!this.isEnabled()) {
			return;
		}

		const deferToObsidianLinkUpdates = this.shouldDeferToObsidianLinkUpdates();
		if (deferToObsidianLinkUpdates) {
			const previousContribution = this.sourceContributionsByPath.get(oldPath) ?? null;
			this.trackPendingObsidianRenameTargets(previousContribution);
		}

		this.pendingRenamedFiles.set(file.path, {file, oldPath});
		this.plugin.debugLog('Queued file rename.', {
			filePath: file.path,
			oldPath,
			deferToObsidianLinkUpdates,
		});
		this.scheduleFlush();
	}

	private scheduleFlush(delayMs = DEFAULT_FLUSH_DELAY_MS) {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
		}

		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null;
			void this.flushPendingWork();
		}, delayMs);
	}

	private async flushPendingWork() {
		if (!this.isEnabled()) {
			this.pendingChangedFiles.clear();
			this.pendingCreatedFiles.clear();
			this.pendingDeletedFiles.clear();
			this.pendingFollowUpTargetPaths.clear();
			this.pendingRenamedFiles.clear();
			this.pendingObsidianRenameTargetPaths.clear();
			this.fullSyncQueued = false;
			this.plugin.debugLog('Pending work cleared because related links are disabled.');
			return;
		}

		const pendingChanges = [...this.pendingChangedFiles.values()];
		const pendingCreatedFiles = [...this.pendingCreatedFiles.values()];
		const pendingDeletedFiles = [...this.pendingDeletedFiles.values()];
		const pendingFollowUpTargetPaths = [...this.pendingFollowUpTargetPaths];
		const pendingRenamedFiles = [...this.pendingRenamedFiles.values()];
		this.pendingChangedFiles.clear();
		this.pendingCreatedFiles.clear();
		this.pendingDeletedFiles.clear();
		this.pendingFollowUpTargetPaths.clear();
		this.pendingRenamedFiles.clear();
		const externalChanges: PendingFileChange[] = [];

		let hasExternalChanges = this.fullSyncQueued
			|| !this.hasInitialized
			|| pendingCreatedFiles.length > 0
			|| pendingDeletedFiles.length > 0
			|| pendingFollowUpTargetPaths.length > 0
			|| pendingRenamedFiles.length > 0;
		for (const change of pendingChanges) {
			if (!this.shouldIgnoreOwnWrite(change)) {
				externalChanges.push(change);
				hasExternalChanges = true;
			}
		}

		if (!hasExternalChanges) {
			this.plugin.debugLog('Skipped flush because only self-authored writes were observed.');
			return;
		}

		const shouldNotifyOnError = this.hasInitialized;
		this.plugin.debugLog('Flushing pending work.', {
			pendingChangeCount: pendingChanges.length,
			externalChangeCount: externalChanges.length,
			createdFileCount: pendingCreatedFiles.length,
			deletedFileCount: pendingDeletedFiles.length,
			followUpTargetCount: pendingFollowUpTargetPaths.length,
			renamedFileCount: pendingRenamedFiles.length,
			fullSyncQueued: this.fullSyncQueued,
			hasInitialized: this.hasInitialized,
		});

		if (this.fullSyncQueued || !this.hasInitialized) {
			await this.runFullSync({force: true, notifyOnError: shouldNotifyOnError});
			return;
		}

		await this.runIncrementalSync({
			changedFiles: externalChanges,
			createdFiles: pendingCreatedFiles,
			deletedFiles: pendingDeletedFiles,
			followUpTargetPaths: pendingFollowUpTargetPaths,
			renamedFiles: pendingRenamedFiles,
		}, {notifyOnError: shouldNotifyOnError});
	}

	private async syncAllRelatedLinks() {
		this.renamedSourcePaths.clear();
		const syncModel = this.buildSyncModel();
		this.sourceContributionsByPath.clear();
		this.sourceDisplayTextByPath.clear();
		for (const [sourcePath, displayText] of syncModel.sourceDisplayTextByPath) {
			this.sourceDisplayTextByPath.set(sourcePath, displayText);
		}
		for (const contribution of syncModel.sourceContributionsByPath.values()) {
			this.sourceContributionsByPath.set(contribution.sourcePath, contribution);
		}
		this.plugin.debugLog('Built sync model.', {
			targetCount: syncModel.desiredLinksByTarget.size,
			sourceCount: syncModel.sourceDisplayTextByPath.size,
		});

		for (const targetFile of this.plugin.app.vault.getMarkdownFiles()) {
			await this.syncTargetFile(targetFile, syncModel);
		}
	}

	private async runIncrementalSync(work: {
		changedFiles: PendingFileChange[];
		createdFiles: TFile[];
		deletedFiles: PendingDeletedFile[];
		followUpTargetPaths: string[];
		renamedFiles: PendingRenamedFile[];
	}, options: FullSyncOptions = {}): Promise<void> {
		if (
			work.changedFiles.length === 0
			&& work.createdFiles.length === 0
			&& work.deletedFiles.length === 0
			&& work.followUpTargetPaths.length === 0
			&& work.renamedFiles.length === 0
		) {
			this.plugin.debugLog('Incremental sync skipped because there was no queued incremental work.');
			return;
		}

		this.plugin.debugLog('Starting incremental sync.', {
			changeCount: work.changedFiles.length,
			createCount: work.createdFiles.length,
			deleteCount: work.deletedFiles.length,
			followUpTargetCount: work.followUpTargetPaths.length,
			renameCount: work.renamedFiles.length,
			notifyOnError: options.notifyOnError ?? true,
		});
		await this.enqueue(async () => {
			try {
				await this.syncIncrementalWork(work);
				this.plugin.debugLog('Incremental sync completed successfully.');
			} catch (error) {
				this.handleError(error, options.notifyOnError ?? true);
			}
		});
	}

	private buildSyncModel(): SyncModel {
		const desiredLinksByTarget = new Map<string, Map<string, DesiredTargetLink>>();
		const sourceDisplayTextByPath = new Map<string, string>();
		const sourceContributionsByPath = new Map<string, SourceContribution>();

		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			const displayText = getDisplayText(file, cache?.frontmatter, this.plugin.settings.relatedLinks.displayProperty.trim());
			sourceDisplayTextByPath.set(file.path, displayText);
			this.plugin.debugLog('Computed source display text.', {
				filePath: file.path,
				displayText,
			});

			const contribution = this.buildSourceContribution(file, cache, displayText);
			if (!contribution) {
				continue;
			}

			sourceContributionsByPath.set(contribution.sourcePath, contribution);

			for (const targetPath of contribution.targetPaths) {
				let targetEntries = desiredLinksByTarget.get(targetPath);
				if (!targetEntries) {
					targetEntries = new Map<string, DesiredTargetLink>();
					desiredLinksByTarget.set(targetPath, targetEntries);
				}

				targetEntries.set(contribution.sourcePath, {
					displayText: contribution.displayText,
					sourcePath: contribution.sourcePath,
				});
			}

			this.plugin.debugLog('Registered desired source contribution.', contribution);
		}

		return {
			desiredLinksByTarget,
			sourceContributionsByPath,
			sourceDisplayTextByPath,
		};
	}

	private buildSourceContribution(file: TFile, cache: CachedMetadata | null, displayText: string): SourceContribution | null {
		const relationProperty = this.plugin.settings.relatedLinks.relationProperty.trim();
		if (!relationProperty) {
			this.plugin.debugLog('Skipped source contribution because relation property is empty.', {
				filePath: file.path,
			});
			return null;
		}

		const frontmatter = cache?.frontmatter;
		const targetLinkpaths = getTargetLinkpaths(frontmatter, relationProperty);
		if (targetLinkpaths.length === 0) {
			this.plugin.debugLog('No relation targets found in frontmatter.', {
				filePath: file.path,
				relationProperty,
			});
			return null;
		}

		const targetPaths = new Set<string>();
		for (const linkpath of targetLinkpaths) {
			const targetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
			if (!targetFile || targetFile.path === file.path) {
				this.plugin.debugLog('Skipped unresolved or self-referencing relation target.', {
					filePath: file.path,
					linkpath,
				});
				continue;
			}

			targetPaths.add(targetFile.path);
		}

		if (targetPaths.size === 0) {
			this.plugin.debugLog('Skipped source contribution because no valid target files remained.', {
				filePath: file.path,
			});
			return null;
		}

		return {
			displayText,
			sourcePath: file.path,
			targetPaths: [...targetPaths],
		};
	}

	private async syncTargetFile(targetFile: TFile, syncModel: SyncModel) {
		const currentContent = await this.plugin.app.vault.cachedRead(targetFile);
		const desiredLinks = syncModel.desiredLinksByTarget.get(targetFile.path) ?? new Map<string, DesiredTargetLink>();
		this.plugin.debugLog('Syncing target file.', {
			targetPath: targetFile.path,
			desiredLinkCount: desiredLinks.size,
		});
		const processedContent = this.processTargetContent(currentContent, targetFile, desiredLinks, syncModel.sourceDisplayTextByPath);

		let nextContent = processedContent.content;
		const missingLinks = [...desiredLinks.values()]
			.filter((link) => !processedContent.presentManagedSourcePaths.has(link.sourcePath))
			.sort((left, right) => {
				const displayComparison = left.displayText.localeCompare(right.displayText);
				if (displayComparison !== 0) {
					return displayComparison;
				}

				return left.sourcePath.localeCompare(right.sourcePath);
			});

		for (const missingLink of missingLinks) {
			const sourceFile = this.plugin.app.vault.getAbstractFileByPath(missingLink.sourcePath);
			if (!(sourceFile instanceof TFile)) {
				this.plugin.debugLog('Skipped missing link because source file no longer exists.', {
					targetPath: targetFile.path,
					sourcePath: missingLink.sourcePath,
				});
				continue;
			}

			const destination = buildRelativeMarkdownDestination(sourceFile, targetFile);
			const linkLine = buildMarkdownLinkLine(missingLink.displayText, destination);
			this.plugin.debugLog('Appending missing managed link.', {
				targetPath: targetFile.path,
				sourcePath: missingLink.sourcePath,
				displayText: missingLink.displayText,
				destination,
				linkLine,
			});
			nextContent = appendLinkLine(nextContent, linkLine);
		}

		await this.writeFileIfChanged(targetFile, currentContent, nextContent);
	}

	private async syncIncrementalWork(work: {
		changedFiles: PendingFileChange[];
		createdFiles: TFile[];
		deletedFiles: PendingDeletedFile[];
		followUpTargetPaths: string[];
		renamedFiles: PendingRenamedFile[];
	}) {
		const affectedTargetPaths = new Set<string>(work.followUpTargetPaths);
		const sourcePathsToRefresh = new Set<string>();
		const handledChangedPaths = new Set<string>();
		const changedFilePaths = new Set(work.changedFiles.map((change) => change.file.path));
		const deferRenameLinkUpdatesToObsidian = this.shouldDeferToObsidianLinkUpdates();

		for (const deletedFile of work.deletedFiles) {
			const previousContribution = this.removeTrackedSource(deletedFile.file.path);
			this.removeTrackedRenameMappings(deletedFile.file.path);
			this.addContributionTargets(affectedTargetPaths, previousContribution);
			for (const sourcePath of this.collectTrackedSourcePathsForTargetPath(deletedFile.file.path)) {
				sourcePathsToRefresh.add(sourcePath);
			}
			this.plugin.debugLog('Prepared incremental delete update.', {
				filePath: deletedFile.file.path,
				previousTargets: previousContribution?.targetPaths ?? [],
			});
		}

		for (const renamedFile of work.renamedFiles) {
			const previousContribution = this.sourceContributionsByPath.get(renamedFile.oldPath) ?? null;
			this.sourceContributionsByPath.delete(renamedFile.oldPath);
			this.sourceDisplayTextByPath.delete(renamedFile.oldPath);

			if (deferRenameLinkUpdatesToObsidian) {
				this.removeTrackedRenameMappings(renamedFile.oldPath);
				const refreshedContribution = this.refreshTrackedSource(renamedFile.file);
				handledChangedPaths.add(renamedFile.file.path);
				this.trackPendingObsidianRenameTargets(previousContribution);
				this.trackPendingObsidianRenameTargets(refreshedContribution.nextContribution);
				this.plugin.debugLog('Deferred rename-driven link destination updates to Obsidian automatic link management.', {
					filePath: renamedFile.file.path,
					oldPath: renamedFile.oldPath,
					previousTargets: previousContribution?.targetPaths ?? [],
					nextTargets: refreshedContribution.nextContribution?.targetPaths ?? [],
				});
				continue;
			}

			this.trackRenamedSourcePath(renamedFile.oldPath, renamedFile.file.path);
			this.addContributionTargets(affectedTargetPaths, previousContribution);

			sourcePathsToRefresh.add(renamedFile.file.path);
			for (const sourcePath of this.collectTrackedSourcePathsForTargetPath(renamedFile.oldPath)) {
				sourcePathsToRefresh.add(sourcePath);
			}
			for (const sourcePath of this.collectCandidateSourcePathsForTargetFile(renamedFile.file)) {
				sourcePathsToRefresh.add(sourcePath);
			}

			this.plugin.debugLog('Prepared incremental rename update.', {
				filePath: renamedFile.file.path,
				oldPath: renamedFile.oldPath,
				previousTargets: previousContribution?.targetPaths ?? [],
			});
		}

		for (const createdFile of work.createdFiles) {
			sourcePathsToRefresh.add(createdFile.path);
			for (const sourcePath of this.collectCandidateSourcePathsForTargetFile(createdFile)) {
				sourcePathsToRefresh.add(sourcePath);
			}
			this.plugin.debugLog('Prepared incremental create update.', {
				filePath: createdFile.path,
			});
		}

		for (const change of work.changedFiles) {
			if (handledChangedPaths.has(change.file.path)) {
				this.plugin.debugLog('Skipped metadata-driven target sync because rename handling already refreshed this file.', {
					filePath: change.file.path,
				});
				continue;
			}

			const previousContribution = this.sourceContributionsByPath.get(change.file.path) ?? null;
			this.addContributionTargets(affectedTargetPaths, previousContribution);
			sourcePathsToRefresh.add(change.file.path);
			this.plugin.debugLog('Prepared incremental metadata update.', {
				filePath: change.file.path,
				previousTargets: previousContribution?.targetPaths ?? [],
			});
		}

		for (const sourcePath of sourcePathsToRefresh) {
			if (changedFilePaths.has(sourcePath)) {
				continue;
			}

			const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
			if (!(file instanceof TFile)) {
				continue;
			}

			const refreshedContribution = this.refreshTrackedSource(file);
			this.addContributionTargets(affectedTargetPaths, refreshedContribution.nextContribution);
		}

		for (const change of work.changedFiles) {
			if (handledChangedPaths.has(change.file.path)) {
				continue;
			}

			const refreshedContribution = this.refreshTrackedSource(change.file, change.cache);
			this.addContributionTargets(affectedTargetPaths, refreshedContribution.nextContribution);
		}

		if (affectedTargetPaths.size === 0) {
			this.plugin.debugLog('Incremental sync found no affected target files.');
			return;
		}

		this.plugin.debugLog('Incremental sync will update affected target files.', {
			targetCount: affectedTargetPaths.size,
			targetPaths: [...affectedTargetPaths],
		});

		for (const targetPath of affectedTargetPaths) {
			const targetFile = this.plugin.app.vault.getAbstractFileByPath(targetPath);
			if (!(targetFile instanceof TFile)) {
				this.plugin.debugLog('Skipped incremental target sync because target file no longer exists.', {
					targetPath,
				});
				continue;
			}

			await this.syncTargetFile(targetFile, this.buildSyncModelForTargets([targetPath]));
		}
	}

	private refreshTrackedSource(file: TFile, cache: CachedMetadata | null = this.plugin.app.metadataCache.getFileCache(file)) {
		const displayText = getDisplayText(file, cache?.frontmatter, this.plugin.settings.relatedLinks.displayProperty.trim());
		this.sourceDisplayTextByPath.set(file.path, displayText);

		const nextContribution = this.buildSourceContribution(file, cache, displayText);
		if (nextContribution) {
			this.sourceContributionsByPath.set(file.path, nextContribution);
		} else {
			this.sourceContributionsByPath.delete(file.path);
		}

		this.plugin.debugLog('Refreshed tracked source.', {
			filePath: file.path,
			displayText,
			targetPaths: nextContribution?.targetPaths ?? [],
		});

		return {
			displayText,
			nextContribution,
		};
	}

	private removeTrackedSource(sourcePath: string): SourceContribution | null {
		const previousContribution = this.sourceContributionsByPath.get(sourcePath) ?? null;
		this.sourceContributionsByPath.delete(sourcePath);
		this.sourceDisplayTextByPath.delete(sourcePath);
		return previousContribution;
	}

	private addContributionTargets(targetPaths: Set<string>, contribution: SourceContribution | null) {
		for (const targetPath of contribution?.targetPaths ?? []) {
			targetPaths.add(targetPath);
		}
	}

	private collectTrackedSourcePathsForTargetPath(targetPath: string): Set<string> {
		const sourcePaths = new Set<string>();

		for (const contribution of this.sourceContributionsByPath.values()) {
			if (contribution.targetPaths.includes(targetPath)) {
				sourcePaths.add(contribution.sourcePath);
			}
		}

		return sourcePaths;
	}

	private collectCandidateSourcePathsForTargetFile(targetFile: TFile): Set<string> {
		const sourcePaths = this.collectTrackedSourcePathsForTargetPath(targetFile.path);

		for (const [sourcePath, destinations] of Object.entries(this.plugin.app.metadataCache.resolvedLinks)) {
			if (destinations[targetFile.path]) {
				sourcePaths.add(sourcePath);
			}
		}

		for (const [sourcePath, destinations] of Object.entries(this.plugin.app.metadataCache.unresolvedLinks)) {
			for (const unresolvedLinkpath of Object.keys(destinations)) {
				const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(unresolvedLinkpath, sourcePath);
				if (resolvedFile?.path === targetFile.path) {
					sourcePaths.add(sourcePath);
					break;
				}
			}
		}

		return sourcePaths;
	}

	private processTargetContent(
		content: string,
		targetFile: TFile,
		desiredLinks: Map<string, DesiredTargetLink>,
		sourceDisplayTextByPath: Map<string, string>,
	): ProcessedTargetContent {
		const markdownLinkPattern = /\[((?:[^\]\\\r\n]|\\.)*)\]\((<[^>\r\n]+>|[^)\r\n]+)\)/g;
		const presentManagedSourcePaths = new Set<string>();
		let nextContent = '';
		let lastIndex = 0;
		let hasRemovedLinks = false;
		let hasUpdatedLinks = false;
		let match: RegExpExecArray | null;

		while ((match = markdownLinkPattern.exec(content)) !== null) {
			const [fullMatch, rawDisplayText, rawDestination] = match;
			const matchIndex = match.index;
			nextContent += content.slice(lastIndex, matchIndex);
			lastIndex = matchIndex + fullMatch.length;

			if (matchIndex > 0 && content[matchIndex - 1] === '!') {
				nextContent += fullMatch;
				this.plugin.debugLog('Skipped embedded markdown link during managed-link scan.', {
					targetPath: targetFile.path,
					match: fullMatch,
				});
				continue;
			}

			if (rawDisplayText === undefined || rawDestination === undefined) {
				nextContent += fullMatch;
				this.plugin.debugLog('Skipped malformed markdown link match.', {
					targetPath: targetFile.path,
					match: fullMatch,
				});
				continue;
			}

			const actualDisplayText = unescapeMarkdownLinkText(rawDisplayText);
			const actualDestination = extractMarkdownLinkpath(rawDestination);
			const {sourcePath, matchReason} = this.resolveManagedSourcePath(
				rawDestination,
				actualDisplayText,
				targetFile,
				desiredLinks,
			);
			const sourceFile = sourcePath ? this.plugin.app.vault.getAbstractFileByPath(sourcePath) : null;
			const canonicalDestination = sourceFile instanceof TFile ? buildRelativeMarkdownDestination(sourceFile, targetFile) : null;
			const expectedDisplayText = sourcePath ? sourceDisplayTextByPath.get(sourcePath) : undefined;
			const hasCanonicalDestination = Boolean(canonicalDestination && actualDestination === canonicalDestination);
			const isManagedMatch = Boolean(
				sourcePath
				&& expectedDisplayText !== undefined
				&& (
					actualDisplayText === expectedDisplayText
					|| hasCanonicalDestination
					|| matchReason === 'renamed-source'
					|| matchReason === 'stale-display'
				),
			);
			this.plugin.debugLog('Evaluated markdown link candidate.', {
				targetPath: targetFile.path,
				match: fullMatch,
				rawDestination,
				sourcePath,
				actualDestination,
				canonicalDestination,
				actualDisplayText,
				expectedDisplayText,
				hasCanonicalDestination,
				matchReason,
				isManagedMatch,
			});

			if (!isManagedMatch || !sourcePath) {
				nextContent += fullMatch;
				continue;
			}

			if (desiredLinks.has(sourcePath)) {
				if (presentManagedSourcePaths.has(sourcePath)) {
					hasRemovedLinks = true;
					this.plugin.debugLog('Removed duplicate managed link while keeping the first occurrence.', {
						targetPath: targetFile.path,
						sourcePath,
						match: fullMatch,
					});
					continue;
				}

				presentManagedSourcePaths.add(sourcePath);
				if (this.shouldDeferManagedRenameRewrite(matchReason, actualDestination, canonicalDestination)) {
					nextContent += fullMatch;
					this.plugin.debugLog('Deferred renamed markdown destination rewrite to Obsidian automatic link updates.', {
						targetPath: targetFile.path,
						sourcePath,
						match: fullMatch,
						actualDestination,
						canonicalDestination,
						matchReason,
					});
					continue;
				}

				const desiredLink = desiredLinks.get(sourcePath);
				const normalizedMatch = desiredLink && canonicalDestination
					? buildMarkdownLinkLine(desiredLink.displayText, canonicalDestination)
					: fullMatch;
				if (normalizedMatch !== fullMatch) {
					nextContent += normalizedMatch;
					hasUpdatedLinks = true;
					this.plugin.debugLog('Updated managed link because display text or destination changed.', {
						targetPath: targetFile.path,
						sourcePath,
						previousMatch: fullMatch,
						nextMatch: normalizedMatch,
					});
				} else {
					nextContent += fullMatch;
				}
				this.plugin.debugLog('Kept matched managed link because relation still exists.', {
					targetPath: targetFile.path,
					sourcePath,
					match: fullMatch,
				});
				continue;
			}

			hasRemovedLinks = true;
			this.plugin.debugLog('Removed matched managed link because relation no longer exists.', {
				targetPath: targetFile.path,
				sourcePath,
				match: fullMatch,
			});
		}

		nextContent += content.slice(lastIndex);

		return {
			content: hasRemovedLinks
				? this.normalizeContentAfterRemoval(nextContent)
				: hasUpdatedLinks
					? nextContent
					: content,
			presentManagedSourcePaths,
		};
	}

	private resolveManagedSourcePath(
		rawDestination: string,
		actualDisplayText: string,
		targetFile: TFile,
		desiredLinks: Map<string, DesiredTargetLink>,
	): {matchReason: 'renamed-source' | 'resolved-source' | 'stale-display' | null; sourcePath: string | null} {
		const resolvedSourcePath = this.resolveMarkdownSourcePath(rawDestination, targetFile);
		if (resolvedSourcePath) {
			return {
				matchReason: 'resolved-source',
				sourcePath: resolvedSourcePath,
			};
		}

		const renamedSourcePath = this.resolveRenamedSourcePath(rawDestination, targetFile);
		if (renamedSourcePath) {
			return {
				matchReason: 'renamed-source',
				sourcePath: renamedSourcePath,
			};
		}

		const staleManagedLink = this.resolveBrokenManagedSourceByDisplayText(
			extractMarkdownLinkpath(rawDestination),
			actualDisplayText,
			desiredLinks,
		);
		if (staleManagedLink) {
			return {
				matchReason: 'stale-display',
				sourcePath: staleManagedLink.sourcePath,
			};
		}

		return {
			matchReason: null,
			sourcePath: null,
		};
	}

	private resolveMarkdownSourcePath(rawDestination: string, targetFile: TFile): string | null {
		const linkpath = extractMarkdownLinkpath(rawDestination);
		if (!linkpath) {
			this.plugin.debugLog('Failed to extract markdown link path.', {
				targetPath: targetFile.path,
				rawDestination,
			});
			return null;
		}

		for (const candidatePath of this.buildMarkdownDestinationCandidates(linkpath, targetFile)) {
			const candidateFile = this.plugin.app.vault.getAbstractFileByPath(candidatePath);
			if (candidateFile instanceof TFile) {
				this.plugin.debugLog('Resolved markdown destination from vault path candidate.', {
					targetPath: targetFile.path,
					rawDestination,
					linkpath,
					candidatePath,
					resolvedPath: candidateFile.path,
				});
				return candidateFile.path;
			}
		}

		const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, targetFile.path);
		this.plugin.debugLog('Resolved markdown destination.', {
			targetPath: targetFile.path,
			rawDestination,
			linkpath,
			resolvedPath: resolvedFile?.path ?? null,
		});
		return resolvedFile?.path ?? null;
	}

	private resolveRenamedSourcePath(rawDestination: string, targetFile: TFile): string | null {
		const linkpath = extractMarkdownLinkpath(rawDestination);
		if (!linkpath || this.isLikelyExternalDestination(linkpath)) {
			return null;
		}

		for (const candidatePath of this.buildMarkdownDestinationCandidates(linkpath, targetFile)) {
			const renamedPath = this.renamedSourcePaths.get(candidatePath);
			if (renamedPath) {
				this.plugin.debugLog('Resolved markdown destination from tracked rename.', {
					targetPath: targetFile.path,
					rawDestination,
					linkpath,
					candidatePath,
					resolvedPath: renamedPath,
				});
				return renamedPath;
			}
		}

		return null;
	}

	private buildMarkdownDestinationCandidates(linkpath: string, targetFile: TFile): string[] {
		const candidates: string[] = [];
		const seenCandidates = new Set<string>();
		const normalizedLinkpath = linkpath.replace(/\\/g, '/').trim();
		const targetDirectory = this.getParentDirectory(targetFile.path);

		const addCandidate = (candidate: string) => {
			const normalizedCandidate = normalizePath(candidate);
			if (!normalizedCandidate || seenCandidates.has(normalizedCandidate)) {
				return;
			}

			seenCandidates.add(normalizedCandidate);
			candidates.push(normalizedCandidate);

			if (!/\.[^./]+$/.test(normalizedCandidate)) {
				const markdownCandidate = normalizePath(`${normalizedCandidate}.md`);
				if (!seenCandidates.has(markdownCandidate)) {
					seenCandidates.add(markdownCandidate);
					candidates.push(markdownCandidate);
				}
			}
		};

		if (normalizedLinkpath.startsWith('/')) {
			addCandidate(normalizedLinkpath.slice(1));
			return candidates;
		}

		if (targetDirectory) {
			addCandidate(`${targetDirectory}/${normalizedLinkpath}`);
		}

		addCandidate(normalizedLinkpath);

		return candidates;
	}

	private getParentDirectory(path: string): string {
		const lastSlashIndex = path.lastIndexOf('/');
		return lastSlashIndex >= 0 ? path.slice(0, lastSlashIndex) : '';
	}

	private buildSyncModelForTargets(targetPaths: string[]): SyncModel {
		const desiredLinksByTarget = new Map<string, Map<string, DesiredTargetLink>>();
		const targetPathSet = new Set(targetPaths);

		for (const targetPath of targetPathSet) {
			desiredLinksByTarget.set(targetPath, new Map<string, DesiredTargetLink>());
		}

		for (const contribution of this.sourceContributionsByPath.values()) {
			for (const targetPath of contribution.targetPaths) {
				if (!targetPathSet.has(targetPath)) {
					continue;
				}

				const desiredLinks = desiredLinksByTarget.get(targetPath);
				if (!desiredLinks) {
					continue;
				}

				desiredLinks.set(contribution.sourcePath, {
					displayText: contribution.displayText,
					sourcePath: contribution.sourcePath,
				});
			}
		}

		return {
			desiredLinksByTarget,
			sourceContributionsByPath: new Map(this.sourceContributionsByPath),
			sourceDisplayTextByPath: new Map(this.sourceDisplayTextByPath),
		};
	}

	private resolveBrokenManagedSourceByDisplayText(
		actualDestination: string | null,
		actualDisplayText: string,
		desiredLinks: Map<string, DesiredTargetLink>,
	): DesiredTargetLink | null {
		const normalizedDisplayText = actualDisplayText.trim();
		if (!actualDestination || !normalizedDisplayText || this.isLikelyExternalDestination(actualDestination)) {
			return null;
		}

		let matchedLink: DesiredTargetLink | null = null;
		for (const desiredLink of desiredLinks.values()) {
			if (desiredLink.displayText !== normalizedDisplayText) {
				continue;
			}

			if (matchedLink) {
				return null;
			}

			matchedLink = desiredLink;
		}

		if (matchedLink) {
			this.plugin.debugLog('Resolved broken markdown link from a unique desired display text match.', {
				actualDestination,
				actualDisplayText: normalizedDisplayText,
				sourcePath: matchedLink.sourcePath,
			});
		}

		return matchedLink;
	}

	private normalizeContentAfterRemoval(content: string): string {
		const normalized = content
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trimEnd();

		return normalized ? `${normalized}\n` : '';
	}

	private shouldIgnoreOwnWrite(change: PendingFileChange): boolean {
		const expectedContent = this.pendingOwnWrites.get(change.file.path);
		if (!expectedContent) {
			return false;
		}

		this.pendingOwnWrites.delete(change.file.path);
		this.plugin.debugLog('Observed plugin-authored write.', {
			filePath: change.file.path,
			matchesExpectedContent: expectedContent === change.data,
		});
		return expectedContent === change.data;
	}

	private async writeFileIfChanged(file: TFile, currentContent: string, nextContent: string) {
		if (nextContent === currentContent) {
			this.plugin.debugLog('Skipped writing file because content did not change.', {
				filePath: file.path,
			});
			return;
		}

		this.pendingOwnWrites.set(file.path, nextContent);
		this.plugin.debugLog('Writing updated file content.', {
			filePath: file.path,
			previousLength: currentContent.length,
			nextLength: nextContent.length,
		});
		await this.plugin.app.vault.modify(file, nextContent);
	}

	private trackRenamedSourcePath(oldPath: string, nextPath: string) {
		for (const [trackedOldPath, trackedNextPath] of [...this.renamedSourcePaths.entries()]) {
			if (trackedOldPath === nextPath) {
				this.renamedSourcePaths.delete(trackedOldPath);
				continue;
			}

			if (trackedNextPath === oldPath) {
				this.renamedSourcePaths.set(trackedOldPath, nextPath);
			}
		}

		this.renamedSourcePaths.set(oldPath, nextPath);
	}

	private removeTrackedRenameMappings(path: string) {
		for (const [oldPath, nextPath] of [...this.renamedSourcePaths.entries()]) {
			if (oldPath === path || nextPath === path) {
				this.renamedSourcePaths.delete(oldPath);
			}
		}
	}

	private isLikelyExternalDestination(destination: string): boolean {
		return /^[a-z][a-z0-9+.-]*:/i.test(destination);
	}

	private shouldDeferManagedRenameRewrite(
		matchReason: 'renamed-source' | 'resolved-source' | 'stale-display' | null,
		actualDestination: string | null,
		canonicalDestination: string | null,
	): boolean {
		return this.shouldDeferToObsidianLinkUpdates()
			&& canonicalDestination !== null
			&& actualDestination !== canonicalDestination
			&& (matchReason === 'renamed-source' || matchReason === 'stale-display');
	}

	private shouldDeferToObsidianLinkUpdates(): boolean {
		const vaultConfigReader = this.plugin.app.vault as VaultConfigReader;
		return vaultConfigReader.getConfig?.('alwaysUpdateLinks') === true;
	}

	private trackPendingObsidianRenameTargets(contribution: SourceContribution | null) {
		for (const targetPath of contribution?.targetPaths ?? []) {
			this.pendingObsidianRenameTargetPaths.add(targetPath);
		}
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		this.workQueue = this.workQueue.then(task);
		return this.workQueue;
	}

	private handleError(error: unknown, notify: boolean) {
		console.error('Failed to sync related frontmatter links.', error);
		if (notify) {
			new Notice('Failed to sync related frontmatter links. Check the developer console for details.');
		}
	}

	private isEnabled(): boolean {
		return this.plugin.settings.relatedLinks.enabled;
	}

	private isMarkdownFile(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === 'md';
	}
}
