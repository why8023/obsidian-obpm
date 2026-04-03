import {FrontMatterCache, TFile} from 'obsidian';

export interface SourceContribution {
	displayText: string;
	sourcePath: string;
	targetPaths: string[];
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

export function getTargetLinkpaths(frontmatter: FrontMatterCache | undefined, relationProperty: string): string[] {
	if (!relationProperty) {
		return [];
	}

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

export function buildMarkdownLinkLine(displayText: string, destination: string): string {
	return `[${escapeMarkdownText(displayText)}](${encodeMarkdownDestination(destination)})`;
}

export function buildRelativeMarkdownDestination(sourceFile: TFile, targetFile: TFile): string {
	const sourceSegments = sourceFile.path.split('/').filter(Boolean);
	const targetDirectorySegments = getParentDirectory(targetFile.path).split('/').filter(Boolean);
	const sharedSegmentCount = getSharedSegmentCount(sourceSegments, targetDirectorySegments);
	const upwardSegments = targetDirectorySegments.slice(sharedSegmentCount).map(() => '..');
	const downwardSegments = sourceSegments.slice(sharedSegmentCount);
	const relativeSegments = [...upwardSegments, ...downwardSegments];

	return relativeSegments.join('/') || sourceFile.path;
}

export function appendLinkLine(content: string, linkLine: string): string {
	const trimmedContent = content.trimEnd();
	if (!trimmedContent) {
		return `${linkLine}\n`;
	}

	return `${trimmedContent}\n\n${linkLine}\n`;
}

export function extractLinkpath(value: string): string | null {
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

function getFrontmatterValue(frontmatter: FrontMatterCache | undefined, property: string): unknown {
	if (!frontmatter || !(property in frontmatter)) {
		return undefined;
	}

	return frontmatter[property as keyof FrontMatterCache];
}

export function extractMarkdownLinkpath(value: string): string | null {
	let normalized = value.trim();
	if (!normalized) {
		return null;
	}

	if (normalized.startsWith('<') && normalized.endsWith('>')) {
		normalized = normalized.slice(1, -1).trim();
	}

	try {
		normalized = decodeURI(normalized);
	} catch {
		// Keep the original value when the destination is not URI-encoded.
	}

	const headingIndex = normalized.search(/[#?]/);
	if (headingIndex >= 0) {
		normalized = normalized.slice(0, headingIndex).trim();
	}

	return normalized || null;
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

export function unescapeMarkdownLinkText(value: string): string {
	return value
		.replace(/\\\\/g, '\\')
		.replace(/\\\[/g, '[')
		.replace(/\\\]/g, ']');
}

function escapeMarkdownText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/\[/g, '\\[')
		.replace(/\]/g, '\\]');
}

function encodeMarkdownDestination(value: string): string {
	return encodeURI(value)
		.replace(/\(/g, '%28')
		.replace(/\)/g, '%29')
		.replace(/#/g, '%23')
		.replace(/\?/g, '%3F');
}

function getParentDirectory(path: string): string {
	const lastSlashIndex = path.lastIndexOf('/');
	return lastSlashIndex >= 0 ? path.slice(0, lastSlashIndex) : '';
}

function getSharedSegmentCount(left: string[], right: string[]): number {
	const limit = Math.min(left.length, right.length);
	let sharedSegmentCount = 0;

	while (sharedSegmentCount < limit && left[sharedSegmentCount] === right[sharedSegmentCount]) {
		sharedSegmentCount += 1;
	}

	return sharedSegmentCount;
}
