import {App, CachedMetadata, FrontMatterCache, normalizePath, TFile} from 'obsidian';
import {DesiredLinksByTarget, DesiredTargetLink, SourceContribution} from './types';

export interface SourceIndex {
	desiredLinksByTarget: DesiredLinksByTarget;
	sourceContributionsByPath: Map<string, SourceContribution>;
}

export function buildFullSourceIndex(
	app: App,
	relationProperty: string,
	displayProperty: string,
): SourceIndex {
	const sourceContributionsByPath = new Map<string, SourceContribution>();

	for (const file of app.vault.getMarkdownFiles()) {
		const contribution = buildSourceContribution(
			app,
			file,
			relationProperty,
			displayProperty,
			app.metadataCache.getFileCache(file),
		);
		if (!contribution) {
			continue;
		}

		sourceContributionsByPath.set(contribution.sourcePath, contribution);
	}

	return {
		desiredLinksByTarget: buildDesiredLinksByTarget(sourceContributionsByPath.values()),
		sourceContributionsByPath,
	};
}

export function buildDesiredLinksByTarget(contributions: Iterable<SourceContribution>): DesiredLinksByTarget {
	const desiredLinksByTarget: DesiredLinksByTarget = new Map();

	for (const contribution of contributions) {
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
	}

	return desiredLinksByTarget;
}

export function buildSourceContribution(
	app: App,
	file: TFile,
	relationProperty: string,
	displayProperty: string,
	cache: CachedMetadata | null = app.metadataCache.getFileCache(file),
): SourceContribution | null {
	if (!relationProperty) {
		return null;
	}

	const targetLinkpaths = getTargetLinkpaths(cache?.frontmatter, relationProperty);
	if (targetLinkpaths.length === 0) {
		return null;
	}

	const targetPaths = new Set<string>();
	for (const linkpath of targetLinkpaths) {
		const targetFile = resolveRelationTargetFile(app, linkpath, file.path);
		if (!targetFile || targetFile.path === file.path) {
			continue;
		}

		targetPaths.add(targetFile.path);
	}

	if (targetPaths.size === 0) {
		return null;
	}

	return {
		displayText: getDisplayText(file, cache?.frontmatter, displayProperty),
		sourcePath: file.path,
		targetPaths: [...targetPaths].sort((left, right) => left.localeCompare(right)),
	};
}

export function getDisplayText(file: TFile, frontmatter: FrontMatterCache | undefined, displayProperty: string): string {
	const fallback = file.basename;
	if (!displayProperty) {
		return fallback;
	}

	const rawValue = getFrontmatterValue(frontmatter, displayProperty);
	const values = flattenFrontmatterValues(rawValue);
	const firstValue = values[0]?.trim();

	return firstValue ? firstValue : fallback;
}

function getTargetLinkpaths(frontmatter: FrontMatterCache | undefined, relationProperty: string): string[] {
	const rawValue = getFrontmatterValue(frontmatter, relationProperty);
	const values = flattenFrontmatterValues(rawValue);
	const uniqueTargets = new Set<string>();

	for (const value of values) {
		const normalized = extractLinkpath(value);
		if (normalized) {
			uniqueTargets.add(normalized);
		}
	}

	return [...uniqueTargets];
}

function getFrontmatterValue(frontmatter: FrontMatterCache | undefined, property: string): unknown {
	if (!frontmatter || !(property in frontmatter)) {
		return undefined;
	}

	return frontmatter[property as keyof FrontMatterCache];
}

function flattenFrontmatterValues(value: unknown): string[] {
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return [String(value)];
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) => flattenFrontmatterValues(item));
	}

	return [];
}

function extractLinkpath(value: string): string | null {
	let normalized = value.trim();
	if (!normalized) {
		return null;
	}

	if (normalized.startsWith('[[') && normalized.endsWith(']]')) {
		normalized = normalized.slice(2, -2).trim();
	}

	const aliasIndex = normalized.indexOf('|');
	if (aliasIndex >= 0) {
		normalized = normalized.slice(0, aliasIndex).trim();
	}

	const headingIndex = normalized.search(/[#^]/);
	if (headingIndex >= 0) {
		normalized = normalized.slice(0, headingIndex).trim();
	}

	return normalized || null;
}

function resolveRelationTargetFile(app: App, linkpath: string, sourceFilePath: string): TFile | null {
	const resolvedFile = app.metadataCache.getFirstLinkpathDest(linkpath, sourceFilePath);
	if (resolvedFile) {
		return resolvedFile;
	}

	for (const candidatePath of buildLinkpathCandidates(linkpath, sourceFilePath)) {
		const candidateFile = app.vault.getAbstractFileByPath(candidatePath);
		if (candidateFile instanceof TFile) {
			return candidateFile;
		}
	}

	return null;
}

function buildLinkpathCandidates(linkpath: string, sourceFilePath: string): string[] {
	const candidates: string[] = [];
	const seenCandidates = new Set<string>();
	const normalizedLinkpath = linkpath.replace(/\\/g, '/').trim();
	const sourceDirectory = getParentDirectory(sourceFilePath);

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

	if (sourceDirectory) {
		addCandidate(`${sourceDirectory}/${normalizedLinkpath}`);
	}

	addCandidate(normalizedLinkpath);
	return candidates;
}

function getParentDirectory(path: string): string {
	const lastSlashIndex = path.lastIndexOf('/');
	return lastSlashIndex >= 0 ? path.slice(0, lastSlashIndex) : '';
}
