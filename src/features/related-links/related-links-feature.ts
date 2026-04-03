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

export class RelatedLinksFeature extends Component {
	private readonly pendingChangedFiles = new Map<string, PendingFileChange>();
	private readonly pendingOwnWrites = new Map<string, string>();
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

		this.registerEvent(this.plugin.app.vault.on('create', (file) => {
			if (this.isMarkdownFile(file)) {
				this.queueFullSync();
			}
		}));

		this.registerEvent(this.plugin.app.vault.on('delete', (file) => {
			if (this.isMarkdownFile(file)) {
				this.queueFullSync();
			}
		}));

		this.registerEvent(this.plugin.app.vault.on('rename', (file) => {
			if (this.isMarkdownFile(file)) {
				this.queueFullSync();
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
		this.fullSyncQueued = false;
		this.plugin.debugLog('Refresh requested.');

		if (!this.isEnabled()) {
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

		this.pendingChangedFiles.set(file.path, {cache, data, file});
		this.plugin.debugLog('Queued metadata change.', {
			filePath: file.path,
			hasFrontmatter: Boolean(cache.frontmatter),
		});
		this.scheduleFlush();
	}

	private queueFullSync() {
		if (!this.isEnabled()) {
			return;
		}

		this.fullSyncQueued = true;
		this.plugin.debugLog('Queued full sync because of vault change.');
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
			this.pendingChangedFiles.clear();
			this.fullSyncQueued = false;
			this.plugin.debugLog('Pending work cleared because related links are disabled.');
			return;
		}

		const pendingChanges = [...this.pendingChangedFiles.values()];
		this.pendingChangedFiles.clear();
		const externalChanges: PendingFileChange[] = [];

		let hasExternalChanges = this.fullSyncQueued || !this.hasInitialized;
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
			fullSyncQueued: this.fullSyncQueued,
			hasInitialized: this.hasInitialized,
		});

		if (this.fullSyncQueued || !this.hasInitialized) {
			await this.runFullSync({force: true, notifyOnError: shouldNotifyOnError});
			return;
		}

		await this.runIncrementalSync(externalChanges, {notifyOnError: shouldNotifyOnError});
	}

	private async syncAllRelatedLinks() {
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

	private async runIncrementalSync(changes: PendingFileChange[], options: FullSyncOptions = {}): Promise<void> {
		if (changes.length === 0) {
			this.plugin.debugLog('Incremental sync skipped because there were no external metadata changes to process.');
			return;
		}

		this.plugin.debugLog('Starting incremental sync.', {
			changeCount: changes.length,
			notifyOnError: options.notifyOnError ?? true,
		});
		await this.enqueue(async () => {
			try {
				await this.syncChangedFiles(changes);
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

	private async syncChangedFiles(changes: PendingFileChange[]) {
		const affectedTargetPaths = new Set<string>();

		for (const change of changes) {
			const previousContribution = this.sourceContributionsByPath.get(change.file.path) ?? null;
			const displayText = getDisplayText(
				change.file,
				change.cache.frontmatter,
				this.plugin.settings.relatedLinks.displayProperty.trim(),
			);
			this.sourceDisplayTextByPath.set(change.file.path, displayText);

			const nextContribution = this.buildSourceContribution(change.file, change.cache, displayText);
			if (nextContribution) {
				this.sourceContributionsByPath.set(change.file.path, nextContribution);
			} else {
				this.sourceContributionsByPath.delete(change.file.path);
			}

			for (const targetPath of previousContribution?.targetPaths ?? []) {
				affectedTargetPaths.add(targetPath);
			}

			for (const targetPath of nextContribution?.targetPaths ?? []) {
				affectedTargetPaths.add(targetPath);
			}

			this.plugin.debugLog('Prepared incremental source update.', {
				filePath: change.file.path,
				previousTargets: previousContribution?.targetPaths ?? [],
				nextTargets: nextContribution?.targetPaths ?? [],
				displayText,
			});
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

			const sourcePath = this.resolveMarkdownSourcePath(rawDestination, targetFile);
			const sourceFile = sourcePath ? this.plugin.app.vault.getAbstractFileByPath(sourcePath) : null;
			const canonicalDestination = sourceFile instanceof TFile ? buildRelativeMarkdownDestination(sourceFile, targetFile) : null;
			const actualDestination = extractMarkdownLinkpath(rawDestination);
			const expectedDisplayText = sourcePath ? sourceDisplayTextByPath.get(sourcePath) : undefined;
			const actualDisplayText = unescapeMarkdownLinkText(rawDisplayText);
			const hasCanonicalDestination = Boolean(canonicalDestination && actualDestination === canonicalDestination);
			const isManagedMatch = Boolean(
				sourcePath
				&& expectedDisplayText !== undefined
				&& (actualDisplayText === expectedDisplayText || hasCanonicalDestination),
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
				const desiredLink = desiredLinks.get(sourcePath);
				const normalizedMatch = desiredLink && canonicalDestination
					? buildMarkdownLinkLine(desiredLink.displayText, canonicalDestination)
					: fullMatch;
				if (normalizedMatch !== fullMatch) {
					nextContent += normalizedMatch;
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
			content: hasRemovedLinks ? this.normalizeContentAfterRemoval(nextContent) : content,
			presentManagedSourcePaths,
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
