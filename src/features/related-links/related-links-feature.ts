import {CachedMetadata, Component, Notice, normalizePath, TAbstractFile, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {getFileNamePropertyValue, sanitizeFileBasename} from '../file-name-sync/file-name-sync-utils';
import {
	extractMarkdownLinkpath,
	extractManagedInlineLinks,
	hasManagedInlineLinks,
	ManagedInlineLink,
	resolveMarkdownDestinationCandidates,
} from './managed-link-protocol';
import {buildRelatedLinksState} from './related-links-state-store';
import {buildDesiredLinksByTarget, buildFullSourceIndex, buildSourceContribution} from './source-index';
import {syncManagedLinksInContent} from './target-sync';
import {DesiredLinksByTarget, DesiredTargetLink, RelatedLinksState, SourceContribution} from './types';

interface FullSyncOptions {
	notifyOnError?: boolean;
}

interface PendingFileChange {
	cache: CachedMetadata | null;
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
	wasManagedTarget: boolean;
}

interface VaultConfigReader {
	getConfig?: (key: string) => unknown;
}

const DEFAULT_FLUSH_DELAY_MS = 300;

export class RelatedLinksFeature extends Component {
	private readonly missingLinkGraceDeadlineByTargetPath = new Map<string, Map<string, number>>();
	private readonly pendingChangedFiles = new Map<string, PendingFileChange>();
	private readonly pendingCreatedFiles = new Map<string, TFile>();
	private readonly pendingDeletedFiles = new Map<string, PendingDeletedFile>();
	private readonly pendingFollowUpTargetPaths = new Set<string>();
	private readonly pendingGraceExpiredTargetPaths = new Set<string>();
	private readonly pendingRenamedFiles = new Map<string, PendingRenamedFile>();
	private readonly pendingOwnWrites = new Map<string, string>();
	private readonly pendingObsidianRenameTargetPaths = new Set<string>();
	private readonly renamedSourcePaths = new Map<string, string>();
	private readonly sourceContributionsByPath = new Map<string, SourceContribution>();
	private currentState: RelatedLinksState;
	private flushTimer: number | null = null;
	private fullSyncQueued = false;
	private hasInitialized = false;
	private missingLinkGraceTimer: number | null = null;
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
		this.currentState = this.plugin.getRelatedLinksState();
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

		if (this.missingLinkGraceTimer !== null) {
			window.clearTimeout(this.missingLinkGraceTimer);
		}
	}

	async refresh(): Promise<void> {
		this.pendingChangedFiles.clear();
		this.pendingCreatedFiles.clear();
		this.pendingDeletedFiles.clear();
		this.pendingFollowUpTargetPaths.clear();
		this.pendingGraceExpiredTargetPaths.clear();
		this.pendingRenamedFiles.clear();
		this.pendingObsidianRenameTargetPaths.clear();
		this.fullSyncQueued = false;
		this.currentState = this.plugin.getRelatedLinksState();
		this.plugin.debugLog('Refresh requested.');

		if (!this.isEnabled()) {
			this.pendingOwnWrites.clear();
			this.pendingFollowUpTargetPaths.clear();
			this.pendingGraceExpiredTargetPaths.clear();
			this.pendingObsidianRenameTargetPaths.clear();
			this.renamedSourcePaths.clear();
			this.sourceContributionsByPath.clear();
			this.clearAllMissingLinkGraceState();
			this.hasInitialized = false;
			this.plugin.debugLog('Refresh skipped because related links are disabled.');
			return;
		}

		await this.runFullSync();
	}

	async runFullSync(options: FullSyncOptions = {}): Promise<void> {
		if (!this.isEnabled()) {
			this.plugin.debugLog('Full sync skipped because related links are disabled.');
			return;
		}

		this.fullSyncQueued = false;
		this.plugin.debugLog('Starting full sync.', {
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

	private queueChangedFile(file: TFile, data: string, cache: CachedMetadata | null) {
		if (!this.isEnabled() || !this.isMarkdownFile(file)) {
			return;
		}

		if (this.pendingObsidianRenameTargetPaths.delete(file.path)) {
			this.pendingFollowUpTargetPaths.add(file.path);
			this.plugin.debugLog('Queued follow-up target sync after Obsidian-managed link update.', {
				filePath: file.path,
			});
		}

		this.pendingChangedFiles.set(file.path, {cache, data, file});
		this.plugin.debugLog('Queued metadata change.', {
			filePath: file.path,
			hasFrontmatter: Boolean(cache?.frontmatter),
			hasManagedLinks: hasManagedInlineLinks(data),
		});
		const expectedRenamePath = this.getExpectedFileNameSyncPath(file, cache);
		if (expectedRenamePath && expectedRenamePath !== file.path) {
			this.plugin.debugLog('Metadata change is expected to trigger a file name sync rename.', {
				expectedRenamePath,
				filePath: file.path,
			});
		}

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

		this.clearMissingLinkGraceForTargetPath(file.path);
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

		this.moveMissingLinkGraceTargetPath(oldPath, file.path);
		const wasManagedTarget = this.isTrackedManagedTarget(oldPath);
		const deferToObsidianLinkUpdates = this.shouldDeferToObsidianLinkUpdates();
		if (deferToObsidianLinkUpdates) {
			this.trackPendingObsidianRenameTargets(this.sourceContributionsByPath.get(oldPath) ?? null);
			if (wasManagedTarget) {
				this.pendingObsidianRenameTargetPaths.add(file.path);
			}
		}

		this.pendingRenamedFiles.set(file.path, {file, oldPath, wasManagedTarget});
		this.plugin.debugLog('Queued file rename.', {
			deferToObsidianLinkUpdates,
			filePath: file.path,
			oldPath,
			wasManagedTarget,
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
			this.pendingGraceExpiredTargetPaths.clear();
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
		const pendingGraceExpiredTargetPaths = [...this.pendingGraceExpiredTargetPaths];
		const pendingRenamedFiles = [...this.pendingRenamedFiles.values()];
		this.pendingChangedFiles.clear();
		this.pendingCreatedFiles.clear();
		this.pendingDeletedFiles.clear();
		this.pendingFollowUpTargetPaths.clear();
		this.pendingGraceExpiredTargetPaths.clear();
		this.pendingRenamedFiles.clear();
		const externalChanges: PendingFileChange[] = [];

		let hasExternalChanges = this.fullSyncQueued
			|| !this.hasInitialized
			|| pendingCreatedFiles.length > 0
			|| pendingDeletedFiles.length > 0
			|| pendingFollowUpTargetPaths.length > 0
			|| pendingGraceExpiredTargetPaths.length > 0
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
			createdFileCount: pendingCreatedFiles.length,
			deletedFileCount: pendingDeletedFiles.length,
			externalChangeCount: externalChanges.length,
			followUpTargetCount: pendingFollowUpTargetPaths.length,
			graceExpiredTargetCount: pendingGraceExpiredTargetPaths.length,
			fullSyncQueued: this.fullSyncQueued,
			hasInitialized: this.hasInitialized,
			pendingChangeCount: pendingChanges.length,
			renamedFileCount: pendingRenamedFiles.length,
		});

		if (this.fullSyncQueued || !this.hasInitialized) {
			await this.runFullSync({notifyOnError: shouldNotifyOnError});
			return;
		}

		await this.runIncrementalSync({
			changedFiles: externalChanges,
			createdFiles: pendingCreatedFiles,
			deletedFiles: pendingDeletedFiles,
			followUpTargetPaths: pendingFollowUpTargetPaths,
			graceExpiredTargetPaths: pendingGraceExpiredTargetPaths,
			renamedFiles: pendingRenamedFiles,
		}, {notifyOnError: shouldNotifyOnError});
	}

	private async syncAllRelatedLinks() {
		this.pendingObsidianRenameTargetPaths.clear();
		this.renamedSourcePaths.clear();
		const relationProperty = this.plugin.settings.relatedLinks.relationProperty.trim();
		const displayProperty = this.plugin.settings.relatedLinks.displayProperty.trim();
		const sourceIndex = buildFullSourceIndex(this.plugin.app, relationProperty, displayProperty);

		this.sourceContributionsByPath.clear();
		for (const contribution of sourceIndex.sourceContributionsByPath.values()) {
			this.sourceContributionsByPath.set(contribution.sourcePath, contribution);
		}

		const targetPathsToSync = new Set<string>([
			...sourceIndex.desiredLinksByTarget.keys(),
			...this.currentState.managedTargets,
		]);
		this.plugin.debugLog('Built full related-links source index.', {
			historicalTargetCount: this.currentState.managedTargets.length,
			sourceCount: this.sourceContributionsByPath.size,
			targetCount: targetPathsToSync.size,
		});

		for (const targetPath of [...targetPathsToSync].sort((left, right) => left.localeCompare(right))) {
			const targetFile = this.plugin.app.vault.getAbstractFileByPath(targetPath);
			if (!(targetFile instanceof TFile)) {
				continue;
			}

			await this.syncTargetFile(
				targetFile,
				sourceIndex.desiredLinksByTarget.get(targetPath) ?? new Map<string, DesiredTargetLink>(),
			);
		}

		await this.persistTrackedState();
	}

	private async runIncrementalSync(work: {
		changedFiles: PendingFileChange[];
		createdFiles: TFile[];
		deletedFiles: PendingDeletedFile[];
		followUpTargetPaths: string[];
		graceExpiredTargetPaths: string[];
		renamedFiles: PendingRenamedFile[];
	}, options: FullSyncOptions = {}): Promise<void> {
		if (
			work.changedFiles.length === 0
			&& work.createdFiles.length === 0
			&& work.deletedFiles.length === 0
			&& work.followUpTargetPaths.length === 0
			&& work.graceExpiredTargetPaths.length === 0
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
			graceExpiredTargetCount: work.graceExpiredTargetPaths.length,
			notifyOnError: options.notifyOnError ?? true,
			renameCount: work.renamedFiles.length,
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

	private async syncIncrementalWork(work: {
		changedFiles: PendingFileChange[];
		createdFiles: TFile[];
		deletedFiles: PendingDeletedFile[];
		followUpTargetPaths: string[];
		graceExpiredTargetPaths: string[];
		renamedFiles: PendingRenamedFile[];
	}) {
		const affectedTargetPaths = new Set<string>([
			...work.followUpTargetPaths,
			...work.graceExpiredTargetPaths,
		]);
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

			if (renamedFile.wasManagedTarget && !deferRenameLinkUpdatesToObsidian) {
				affectedTargetPaths.add(renamedFile.file.path);
			}

			if (deferRenameLinkUpdatesToObsidian) {
				this.removeTrackedRenameMappings(renamedFile.oldPath);
				const refreshedContribution = this.refreshTrackedSource(renamedFile.file);
				handledChangedPaths.add(renamedFile.file.path);
				this.trackPendingObsidianRenameTargets(previousContribution);
				this.trackPendingObsidianRenameTargets(refreshedContribution.nextContribution);
				const shouldSyncTargetsImmediately = await this.shouldSyncTargetsImmediatelyForDeferredRename(
					previousContribution,
					refreshedContribution.nextContribution,
				);
				if (shouldSyncTargetsImmediately) {
					this.addContributionTargets(affectedTargetPaths, previousContribution);
					this.addContributionTargets(affectedTargetPaths, refreshedContribution.nextContribution);
				}
				for (const sourcePath of this.collectTrackedSourcePathsForTargetPath(renamedFile.oldPath)) {
					sourcePathsToRefresh.add(sourcePath);
				}
				for (const sourcePath of this.collectCandidateSourcePathsForTargetFile(renamedFile.file)) {
					sourcePathsToRefresh.add(sourcePath);
				}
				this.plugin.debugLog('Deferred rename-driven link destination updates to Obsidian automatic link management.', {
					filePath: renamedFile.file.path,
					nextTargets: refreshedContribution.nextContribution?.targetPaths ?? [],
					oldPath: renamedFile.oldPath,
					previousTargets: previousContribution?.targetPaths ?? [],
					shouldSyncTargetsImmediately,
					wasManagedTarget: renamedFile.wasManagedTarget,
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
				wasManagedTarget: renamedFile.wasManagedTarget,
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

			if (this.shouldSyncChangedFileAsTarget(change.file.path, change.data)) {
				affectedTargetPaths.add(change.file.path);
			}

			const expectedRenamePath = this.getExpectedFileNameSyncPath(change.file, change.cache);
			if (deferRenameLinkUpdatesToObsidian && expectedRenamePath) {
				this.refreshTrackedSource(change.file, change.cache);
				handledChangedPaths.add(change.file.path);
				this.plugin.debugLog('Deferred metadata-driven related-link sync because file name sync is expected to rename the source file.', {
					expectedRenamePath,
					filePath: change.file.path,
				});
				continue;
			}

			const previousContribution = this.sourceContributionsByPath.get(change.file.path) ?? null;
			this.addContributionTargets(affectedTargetPaths, previousContribution);
			sourcePathsToRefresh.add(change.file.path);
			this.plugin.debugLog('Prepared incremental metadata update.', {
				expectedRenamePath,
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
			await this.persistTrackedState();
			return;
		}

		this.plugin.debugLog('Incremental sync will update affected target files.', {
			targetCount: affectedTargetPaths.size,
			targetPaths: [...affectedTargetPaths],
		});

		const desiredLinksByTarget = this.buildDesiredLinksByTargetPaths([...affectedTargetPaths]);
		for (const targetPath of [...affectedTargetPaths].sort((left, right) => left.localeCompare(right))) {
			const targetFile = this.plugin.app.vault.getAbstractFileByPath(targetPath);
			if (!(targetFile instanceof TFile)) {
				this.clearMissingLinkGraceForTargetPath(targetPath);
				this.plugin.debugLog('Skipped incremental target sync because target file no longer exists.', {
					targetPath,
				});
				continue;
			}

			await this.syncTargetFile(targetFile, desiredLinksByTarget.get(targetPath) ?? new Map<string, DesiredTargetLink>());
		}

		await this.persistTrackedState();
	}

	private async syncTargetFile(targetFile: TFile, desiredLinks: Map<string, DesiredTargetLink>) {
		const currentContent = await this.plugin.app.vault.read(targetFile);
		this.plugin.debugLog('Syncing target file.', {
			desiredLinkCount: desiredLinks.size,
			targetPath: targetFile.path,
		});
		const processedContent = syncManagedLinksInContent(currentContent, {
			debugLog: (message, details) => {
				this.plugin.debugLog(message, details);
			},
			desiredLinks,
			inboxHeading: this.plugin.settings.relatedLinks.inboxHeading,
			resolveManagedSourcePath: (link) => this.resolveManagedSourcePath(link, targetFile),
			resolveSourceFile: (sourcePath) => {
				const sourceFile = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
				return sourceFile instanceof TFile ? sourceFile : null;
			},
			shouldDeferMissingLinkInsertion: (link, currentTargetFile) =>
				this.shouldDeferMissingLinkInsertion(currentTargetFile.path, link.sourcePath),
			shouldDeferDestinationRewrite: (targetFilePath, actualDestination, canonicalDestination) =>
				this.shouldDeferManagedRenameRewrite(targetFilePath, actualDestination, canonicalDestination),
			targetFile,
		});

		this.reconcileMissingLinkGraceState(
			targetFile.path,
			desiredLinks,
			processedContent.satisfiedDesiredSourcePaths,
		);
		await this.writeFileIfChanged(targetFile, currentContent, processedContent.content);
	}

	private refreshTrackedSource(file: TFile, cache: CachedMetadata | null = this.plugin.app.metadataCache.getFileCache(file)) {
		const nextContribution = buildSourceContribution(
			this.plugin.app,
			file,
			this.plugin.settings.relatedLinks.relationProperty.trim(),
			this.plugin.settings.relatedLinks.displayProperty.trim(),
			cache,
		);
		if (nextContribution) {
			this.sourceContributionsByPath.set(file.path, nextContribution);
		} else {
			this.sourceContributionsByPath.delete(file.path);
		}

		this.plugin.debugLog('Refreshed tracked source.', {
			displayText: nextContribution?.displayText ?? file.basename,
			filePath: file.path,
			targetPaths: nextContribution?.targetPaths ?? [],
		});

		return {
			nextContribution,
		};
	}

	private removeTrackedSource(sourcePath: string): SourceContribution | null {
		const previousContribution = this.sourceContributionsByPath.get(sourcePath) ?? null;
		this.sourceContributionsByPath.delete(sourcePath);
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

		const historicalSources = Object.entries(this.currentState.sourceTargetsByPath)
			.filter(([, targetPaths]) => targetPaths.includes(targetPath))
			.map(([sourcePath]) => sourcePath);
		for (const sourcePath of historicalSources) {
			sourcePaths.add(sourcePath);
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

	private buildDesiredLinksByTargetPaths(targetPaths: string[]): DesiredLinksByTarget {
		const targetPathSet = new Set(targetPaths);
		const filteredContributions: SourceContribution[] = [];

		for (const contribution of this.sourceContributionsByPath.values()) {
			const relevantTargets = contribution.targetPaths.filter((targetPath) => targetPathSet.has(targetPath));
			if (relevantTargets.length === 0) {
				continue;
			}

			filteredContributions.push({
				...contribution,
				targetPaths: relevantTargets,
			});
		}

		return buildDesiredLinksByTarget(filteredContributions);
	}

	private resolveManagedSourcePath(link: ManagedInlineLink, targetFile: TFile): string | null {
		const linkpath = extractMarkdownLinkpath(link.destination);
		if (linkpath) {
			const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, targetFile.path);
			if (resolvedFile) {
				return resolvedFile.path;
			}
		}

		let fallbackCandidate: string | null = null;
		for (const candidatePath of resolveMarkdownDestinationCandidates(link.destination, targetFile)) {
			if (fallbackCandidate === null || candidatePath.toLowerCase().endsWith('.md')) {
				fallbackCandidate = candidatePath;
			}

			const renamedPath = this.renamedSourcePaths.get(candidatePath);
			if (renamedPath) {
				return renamedPath;
			}

			const candidateFile = this.plugin.app.vault.getAbstractFileByPath(candidatePath);
			if (candidateFile instanceof TFile) {
				return candidateFile.path;
			}

			if (candidatePath in this.currentState.sourceTargetsByPath || this.sourceContributionsByPath.has(candidatePath)) {
				return candidatePath;
			}
		}

		return fallbackCandidate;
	}

	private shouldSyncChangedFileAsTarget(filePath: string, data: string): boolean {
		return this.isTrackedManagedTarget(filePath) || hasManagedInlineLinks(data);
	}

	private isTrackedManagedTarget(filePath: string): boolean {
		return this.currentState.managedTargets.includes(filePath);
	}

	private async shouldSyncTargetsImmediatelyForDeferredRename(
		previousContribution: SourceContribution | null,
		nextContribution: SourceContribution | null,
	): Promise<boolean> {
		const candidateSourcePaths = new Set<string>();
		if (previousContribution) {
			candidateSourcePaths.add(previousContribution.sourcePath);
		}
		if (nextContribution) {
			candidateSourcePaths.add(nextContribution.sourcePath);
		}

		const targetPaths = new Set<string>([
			...(previousContribution?.targetPaths ?? []),
			...(nextContribution?.targetPaths ?? []),
		]);
		for (const targetPath of targetPaths) {
			const targetFile = this.plugin.app.vault.getAbstractFileByPath(targetPath);
			if (!(targetFile instanceof TFile)) {
				continue;
			}

			const content = await this.plugin.app.vault.cachedRead(targetFile);
			const managedLinks = extractManagedInlineLinks(content);
			const hasMatchingManagedLink = managedLinks.some((link) => {
				const sourcePath = this.resolveManagedSourcePath(link, targetFile);
				return sourcePath !== null && candidateSourcePaths.has(sourcePath);
			});
			if (!hasMatchingManagedLink) {
				return true;
			}
		}

		return false;
	}

	private shouldDeferMissingLinkInsertion(targetPath: string, sourcePath: string): boolean {
		const gracePeriodMs = this.getMissingLinkGracePeriodMs();
		if (gracePeriodMs <= 0) {
			this.clearMissingLinkGraceEntry(targetPath, sourcePath);
			return false;
		}

		const targetGraceDeadlines = this.getOrCreateMissingLinkGraceDeadlines(targetPath);
		const now = Date.now();
		const cappedExpiry = now + gracePeriodMs;
		const existingExpiry = targetGraceDeadlines.get(sourcePath);
		if (existingExpiry !== undefined) {
			const nextExpiry = Math.min(existingExpiry, cappedExpiry);
			targetGraceDeadlines.set(sourcePath, nextExpiry);
			this.scheduleMissingLinkGraceTimer();

			if (nextExpiry <= now) {
				this.plugin.debugLog('Missing managed link grace period already expired.', {
					expiresAt: nextExpiry,
					sourcePath,
					targetPath,
				});
				return false;
			}

			this.plugin.debugLog('Deferred missing managed link while grace period is active.', {
				expiresAt: nextExpiry,
				sourcePath,
				targetPath,
			});
			return true;
		}

		const expiresAt = cappedExpiry;
		targetGraceDeadlines.set(sourcePath, expiresAt);
		this.scheduleMissingLinkGraceTimer();
		this.plugin.debugLog('Started missing managed link grace period.', {
			expiresAt,
			gracePeriodMs,
			sourcePath,
			targetPath,
		});
		return true;
	}

	private reconcileMissingLinkGraceState(
		targetPath: string,
		desiredLinks: Map<string, DesiredTargetLink>,
		satisfiedDesiredSourcePaths: Set<string>,
	) {
		this.pendingGraceExpiredTargetPaths.delete(targetPath);
		const targetGraceDeadlines = this.missingLinkGraceDeadlineByTargetPath.get(targetPath);
		if (!targetGraceDeadlines) {
			return;
		}

		const desiredSourcePaths = new Set(desiredLinks.keys());
		for (const sourcePath of [...targetGraceDeadlines.keys()]) {
			if (!desiredSourcePaths.has(sourcePath) || satisfiedDesiredSourcePaths.has(sourcePath)) {
				targetGraceDeadlines.delete(sourcePath);
			}
		}

		if (targetGraceDeadlines.size === 0) {
			this.missingLinkGraceDeadlineByTargetPath.delete(targetPath);
		}

		this.scheduleMissingLinkGraceTimer();
	}

	private getMissingLinkGracePeriodMs(): number {
		return this.plugin.settings.relatedLinks.missingLinkGracePeriodSeconds * 1000;
	}

	private getOrCreateMissingLinkGraceDeadlines(targetPath: string): Map<string, number> {
		let targetGraceDeadlines = this.missingLinkGraceDeadlineByTargetPath.get(targetPath);
		if (!targetGraceDeadlines) {
			targetGraceDeadlines = new Map<string, number>();
			this.missingLinkGraceDeadlineByTargetPath.set(targetPath, targetGraceDeadlines);
		}

		return targetGraceDeadlines;
	}

	private moveMissingLinkGraceTargetPath(oldPath: string, nextPath: string) {
		if (oldPath === nextPath) {
			return;
		}

		const targetGraceDeadlines = this.missingLinkGraceDeadlineByTargetPath.get(oldPath);
		if (!targetGraceDeadlines) {
			return;
		}

		this.missingLinkGraceDeadlineByTargetPath.delete(oldPath);
		const nextTargetGraceDeadlines = this.getOrCreateMissingLinkGraceDeadlines(nextPath);
		for (const [sourcePath, expiresAt] of targetGraceDeadlines.entries()) {
			nextTargetGraceDeadlines.set(sourcePath, expiresAt);
		}

		if (this.pendingGraceExpiredTargetPaths.delete(oldPath)) {
			this.pendingGraceExpiredTargetPaths.add(nextPath);
		}

		this.scheduleMissingLinkGraceTimer();
	}

	private clearAllMissingLinkGraceState() {
		this.missingLinkGraceDeadlineByTargetPath.clear();
		this.pendingGraceExpiredTargetPaths.clear();

		if (this.missingLinkGraceTimer !== null) {
			window.clearTimeout(this.missingLinkGraceTimer);
			this.missingLinkGraceTimer = null;
		}
	}

	private clearMissingLinkGraceEntry(targetPath: string, sourcePath: string) {
		const targetGraceDeadlines = this.missingLinkGraceDeadlineByTargetPath.get(targetPath);
		if (!targetGraceDeadlines) {
			return;
		}

		targetGraceDeadlines.delete(sourcePath);
		if (targetGraceDeadlines.size === 0) {
			this.missingLinkGraceDeadlineByTargetPath.delete(targetPath);
			this.pendingGraceExpiredTargetPaths.delete(targetPath);
		}

		this.scheduleMissingLinkGraceTimer();
	}

	private clearMissingLinkGraceForTargetPath(targetPath: string) {
		if (!this.missingLinkGraceDeadlineByTargetPath.delete(targetPath) && !this.pendingGraceExpiredTargetPaths.has(targetPath)) {
			return;
		}

		this.pendingGraceExpiredTargetPaths.delete(targetPath);
		this.scheduleMissingLinkGraceTimer();
	}

	private scheduleMissingLinkGraceTimer() {
		if (this.missingLinkGraceTimer !== null) {
			window.clearTimeout(this.missingLinkGraceTimer);
			this.missingLinkGraceTimer = null;
		}

		let nextExpiry: number | null = null;
		for (const [targetPath, targetGraceDeadlines] of this.missingLinkGraceDeadlineByTargetPath.entries()) {
			if (this.pendingGraceExpiredTargetPaths.has(targetPath)) {
				continue;
			}

			for (const expiresAt of targetGraceDeadlines.values()) {
				if (nextExpiry === null || expiresAt < nextExpiry) {
					nextExpiry = expiresAt;
				}
			}
		}

		if (nextExpiry === null) {
			return;
		}

		this.missingLinkGraceTimer = window.setTimeout(() => {
			this.missingLinkGraceTimer = null;
			this.queueExpiredMissingLinkGraceTargets();
		}, Math.max(0, nextExpiry - Date.now()));
	}

	private queueExpiredMissingLinkGraceTargets() {
		const now = Date.now();
		const expiredTargetPaths: string[] = [];

		for (const [targetPath, targetGraceDeadlines] of this.missingLinkGraceDeadlineByTargetPath.entries()) {
			for (const expiresAt of targetGraceDeadlines.values()) {
				if (expiresAt > now) {
					continue;
				}

				this.pendingGraceExpiredTargetPaths.add(targetPath);
				expiredTargetPaths.push(targetPath);
				break;
			}
		}

		if (expiredTargetPaths.length > 0) {
			this.plugin.debugLog('Queued target sync because missing-link grace periods expired.', {
				targetPaths: expiredTargetPaths,
			});
			this.scheduleFlush(0);
		}

		this.scheduleMissingLinkGraceTimer();
	}

	private async persistTrackedState() {
		const nextState = buildRelatedLinksState(this.sourceContributionsByPath.values());
		this.currentState = nextState;
		await this.plugin.saveRelatedLinksState(nextState);
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

	private shouldDeferManagedRenameRewrite(
		targetFilePath: string,
		actualDestination: string,
		canonicalDestination: string,
	): boolean {
		return this.shouldDeferToObsidianLinkUpdates()
			&& this.pendingObsidianRenameTargetPaths.has(targetFilePath)
			&& actualDestination !== canonicalDestination;
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
		if (expectedContent !== change.data) {
			const difference = this.summarizeContentDifference(expectedContent, change.data);
			this.plugin.debugLog('Observed concurrent modification after a plugin-authored write.', {
				actualExcerpt: difference.actualExcerpt,
				actualLength: difference.actualLength,
				expectedExcerpt: difference.expectedExcerpt,
				expectedLength: difference.expectedLength,
				filePath: change.file.path,
				firstDifferenceIndex: difference.firstDifferenceIndex,
			});
		}

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
			nextLength: nextContent.length,
			previousLength: currentContent.length,
		});
		await this.plugin.app.vault.modify(file, nextContent);
	}

	private getExpectedFileNameSyncPath(file: TFile, cache: CachedMetadata | null): string | null {
		if (!this.plugin.settings.fileNameSync.enabled) {
			return null;
		}

		const propertyName = this.plugin.settings.fileNameSync.propertyName.trim();
		if (!propertyName) {
			return null;
		}

		const propertyValue = getFileNamePropertyValue(cache?.frontmatter, propertyName);
		if (!propertyValue) {
			return null;
		}

		const nextBasename = sanitizeFileBasename(propertyValue, {
			invalidCharacterReplacement: this.plugin.settings.fileNameSync.invalidCharacterReplacement,
			maxLength: this.plugin.settings.fileNameSync.maxFileNameLength,
		});
		if (!nextBasename || nextBasename === file.basename) {
			return null;
		}

		const parentPath = file.parent?.path ?? '';
		const nextFileName = `${nextBasename}.${file.extension}`;
		const nextPath = parentPath ? normalizePath(`${parentPath}/${nextFileName}`) : nextFileName;
		const existingFile = this.plugin.app.vault.getAbstractFileByPath(nextPath);
		if (existingFile && existingFile.path !== file.path) {
			return null;
		}

		return nextPath;
	}

	private summarizeContentDifference(expectedContent: string, actualContent: string): {
		actualExcerpt: string;
		actualLength: number;
		expectedExcerpt: string;
		expectedLength: number;
		firstDifferenceIndex: number;
	} {
		const limit = Math.min(expectedContent.length, actualContent.length);
		let firstDifferenceIndex = limit;

		for (let index = 0; index < limit; index += 1) {
			if (expectedContent[index] !== actualContent[index]) {
				firstDifferenceIndex = index;
				break;
			}
		}

		if (expectedContent.length !== actualContent.length && firstDifferenceIndex === limit) {
			firstDifferenceIndex = limit;
		}

		const start = Math.max(0, firstDifferenceIndex - 24);
		const expectedEnd = Math.min(expectedContent.length, firstDifferenceIndex + 48);
		const actualEnd = Math.min(actualContent.length, firstDifferenceIndex + 48);

		return {
			actualExcerpt: this.formatDebugExcerpt(actualContent.slice(start, actualEnd)),
			actualLength: actualContent.length,
			expectedExcerpt: this.formatDebugExcerpt(expectedContent.slice(start, expectedEnd)),
			expectedLength: expectedContent.length,
			firstDifferenceIndex,
		};
	}

	private formatDebugExcerpt(value: string): string {
		return value
			.replace(/\r/g, '\\r')
			.replace(/\n/g, '\\n');
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
