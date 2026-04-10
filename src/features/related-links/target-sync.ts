import {TFile} from 'obsidian';
import {buildManagedMarkdownLink, buildRelativeMarkdownDestination, extractManagedInlineLinks, ManagedInlineLink} from './managed-link-protocol';
import {DesiredTargetLink} from './types';

interface TargetSyncOptions {
	debugLog?: (message: string, details?: unknown) => void;
	desiredLinks: Map<string, DesiredTargetLink>;
	inboxHeading: string;
	resolveManagedSourcePath: (link: ManagedInlineLink, targetFile: TFile) => string | null;
	resolveSourceFile: (sourcePath: string) => TFile | null;
	shouldDeferMissingLinkInsertion?: (link: DesiredTargetLink, targetFile: TFile) => boolean;
	shouldDeferDestinationRewrite?: (targetFilePath: string, actualDestination: string, canonicalDestination: string) => boolean;
	targetFile: TFile;
}

interface TargetSyncResult {
	content: string;
	deferredMissingSourcePaths: Set<string>;
	satisfiedDesiredSourcePaths: Set<string>;
}

interface MarkdownHeading {
	end: number;
	level: number;
	start: number;
	text: string;
}

interface SectionRange {
	contentStart: number;
	end: number;
}

interface ManagedLinkSyncResolution {
	canonicalDestination: string | null;
	desiredLink: DesiredTargetLink | null;
	isInInboxSection: boolean;
	managedLink: ManagedInlineLink;
	sourceFile: TFile | null;
	sourcePath: string | null;
}

const DEFAULT_INBOX_HEADING = 'Inbox';
const HEADING_LINE_PATTERN = /^(?: {0,3})(#{1,6})[ \t]+(.*)$/gm;

export function syncManagedLinksInContent(content: string, options: TargetSyncOptions): TargetSyncResult {
	const satisfiedDesiredSourcePaths = new Set<string>();
	const deferredMissingSourcePaths = new Set<string>();
	const managedLinks = extractManagedInlineLinks(content);
	const normalizedInboxHeading = normalizeInboxHeading(options.inboxHeading);
	const headings = parseMarkdownHeadings(content);
	const inboxSection = findExistingInboxSection(content, headings, normalizedInboxHeading);
	const managedLinkResolutions = managedLinks.map((managedLink) => resolveManagedLinkSyncResolution(
		managedLink,
		inboxSection,
		options,
	));
	const preferredManagedLinksBySourcePath = buildPreferredManagedLinksBySourcePath(managedLinkResolutions);
	let nextContent = '';
	let lastIndex = 0;
	let hasRemovedLinks = false;
	let hasUpdatedLinks = false;

	for (const managedLinkResolution of managedLinkResolutions) {
		const {managedLink} = managedLinkResolution;
		const sourcePath = managedLinkResolution.sourcePath;
		if (!sourcePath) {
			const removalRange = getManagedLinkRemovalRange(content, managedLink);
			nextContent += content.slice(lastIndex, removalRange.start);
			lastIndex = removalRange.end;
			hasRemovedLinks = true;
			options.debugLog?.('Removed managed link because its source path could not be resolved.', {
				link: managedLink.fullMatch,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		const desiredLink = managedLinkResolution.desiredLink;
		if (!desiredLink) {
			const removalRange = getManagedLinkRemovalRange(content, managedLink);
			nextContent += content.slice(lastIndex, removalRange.start);
			lastIndex = removalRange.end;
			hasRemovedLinks = true;
			options.debugLog?.('Removed managed link because the relation no longer exists.', {
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		if (preferredManagedLinksBySourcePath.get(sourcePath) !== managedLinkResolution) {
			const removalRange = getManagedLinkRemovalRange(content, managedLink);
			nextContent += content.slice(lastIndex, removalRange.start);
			lastIndex = removalRange.end;
			hasRemovedLinks = true;
			options.debugLog?.(
				managedLinkResolution.isInInboxSection
					? 'Removed duplicate managed link while preferring a non-Inbox occurrence.'
					: 'Removed duplicate managed link while keeping the preferred occurrence.',
				{
					sourcePath,
					targetPath: options.targetFile.path,
				},
			);
			continue;
		}

		const sourceFile = managedLinkResolution.sourceFile;
		if (!sourceFile) {
			const removalRange = getManagedLinkRemovalRange(content, managedLink);
			nextContent += content.slice(lastIndex, removalRange.start);
			lastIndex = removalRange.end;
			hasRemovedLinks = true;
			options.debugLog?.('Removed managed link because the source file no longer exists.', {
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		satisfiedDesiredSourcePaths.add(sourcePath);
		const canonicalDestination = managedLinkResolution.canonicalDestination ?? buildRelativeMarkdownDestination(sourceFile, options.targetFile);
		if (options.shouldDeferDestinationRewrite?.(
			options.targetFile.path,
			managedLink.destination,
			canonicalDestination,
		)) {
			nextContent += content.slice(lastIndex, managedLink.start);
			lastIndex = managedLink.end;
			nextContent += managedLink.fullMatch;
			options.debugLog?.('Deferred destination rewrite for a managed link.', {
				actualDestination: managedLink.destination,
				canonicalDestination,
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		const normalizedLink = buildManagedMarkdownLink(desiredLink.displayText, canonicalDestination);
		if (normalizedLink !== managedLink.fullMatch) {
			nextContent += content.slice(lastIndex, managedLink.start);
			lastIndex = managedLink.end;
			nextContent += normalizedLink;
			hasUpdatedLinks = true;
			options.debugLog?.('Updated managed link to canonical form.', {
				nextMatch: normalizedLink,
				previousMatch: managedLink.fullMatch,
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		nextContent += content.slice(lastIndex, managedLink.start);
		lastIndex = managedLink.end;
		nextContent += managedLink.fullMatch;
	}

	nextContent += managedLinks.length > 0 ? content.slice(lastIndex) : content;

	const missingLinks = [...options.desiredLinks.values()]
		.filter((link) => !satisfiedDesiredSourcePaths.has(link.sourcePath))
		.sort((left, right) => {
			const displayComparison = left.displayText.localeCompare(right.displayText);
			if (displayComparison !== 0) {
				return displayComparison;
			}

			return left.sourcePath.localeCompare(right.sourcePath);
		});

	let finalContent = hasRemovedLinks
		? normalizeContentAfterRemoval(nextContent)
		: hasUpdatedLinks
			? nextContent
			: content;

	for (const missingLink of missingLinks) {
		const sourceFile = options.resolveSourceFile(missingLink.sourcePath);
		if (!sourceFile) {
			continue;
		}

		if (options.shouldDeferMissingLinkInsertion?.(missingLink, options.targetFile)) {
			deferredMissingSourcePaths.add(missingLink.sourcePath);
			options.debugLog?.('Deferred missing managed link while its grace period is still active.', {
				inboxHeading: normalizedInboxHeading,
				sourcePath: missingLink.sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		const destination = buildRelativeMarkdownDestination(sourceFile, options.targetFile);
		const linkLine = buildManagedMarkdownListItem(missingLink.displayText, destination);
		finalContent = insertLinkLineIntoInboxSection(
			finalContent,
			linkLine,
			options.inboxHeading,
		);
		satisfiedDesiredSourcePaths.add(missingLink.sourcePath);
		options.debugLog?.('Appended missing managed link.', {
			destination,
			displayText: missingLink.displayText,
			inboxHeading: normalizedInboxHeading,
			sourcePath: missingLink.sourcePath,
			targetPath: options.targetFile.path,
		});
	}

	return {
		content: finalContent,
		deferredMissingSourcePaths,
		satisfiedDesiredSourcePaths,
	};
}

function resolveManagedLinkSyncResolution(
	managedLink: ManagedInlineLink,
	inboxSection: SectionRange | null,
	options: TargetSyncOptions,
): ManagedLinkSyncResolution {
	const sourcePath = options.resolveManagedSourcePath(managedLink, options.targetFile);
	if (!sourcePath) {
		return {
			canonicalDestination: null,
			desiredLink: null,
			isInInboxSection: isManagedLinkInSection(managedLink, inboxSection),
			managedLink,
			sourceFile: null,
			sourcePath: null,
		};
	}

	const desiredLink = options.desiredLinks.get(sourcePath) ?? null;
	const sourceFile = options.resolveSourceFile(sourcePath);

	return {
		canonicalDestination: sourceFile ? buildRelativeMarkdownDestination(sourceFile, options.targetFile) : null,
		desiredLink,
		isInInboxSection: isManagedLinkInSection(managedLink, inboxSection),
		managedLink,
		sourceFile,
		sourcePath,
	};
}

function buildPreferredManagedLinksBySourcePath(
	managedLinkResolutions: ManagedLinkSyncResolution[],
): Map<string, ManagedLinkSyncResolution> {
	const preferredManagedLinksBySourcePath = new Map<string, ManagedLinkSyncResolution>();

	for (const managedLinkResolution of managedLinkResolutions) {
		if (
			managedLinkResolution.sourcePath === null
			|| managedLinkResolution.desiredLink === null
			|| managedLinkResolution.sourceFile === null
		) {
			continue;
		}

		const currentPreferred = preferredManagedLinksBySourcePath.get(managedLinkResolution.sourcePath);
		if (!currentPreferred || shouldPreferManagedLinkResolution(managedLinkResolution, currentPreferred)) {
			preferredManagedLinksBySourcePath.set(managedLinkResolution.sourcePath, managedLinkResolution);
		}
	}

	return preferredManagedLinksBySourcePath;
}

function shouldPreferManagedLinkResolution(
	candidate: ManagedLinkSyncResolution,
	currentPreferred: ManagedLinkSyncResolution,
): boolean {
	if (candidate.isInInboxSection !== currentPreferred.isInInboxSection) {
		return !candidate.isInInboxSection;
	}

	return candidate.managedLink.start < currentPreferred.managedLink.start;
}

function buildManagedMarkdownListItem(displayText: string, destination: string): string {
	return `- ${buildManagedMarkdownLink(displayText, destination)}`;
}

function insertLinkLineIntoInboxSection(content: string, linkLine: string, inboxHeading: string): string {
	const normalizedInboxHeading = normalizeInboxHeading(inboxHeading);
	const headings = parseMarkdownHeadings(content);
	const existingSection = findExistingInboxSection(content, headings, normalizedInboxHeading);
	if (existingSection) {
		const sectionContent = content.slice(existingSection.contentStart, existingSection.end);
		const nextSectionContent = appendListLineToSection(sectionContent, linkLine);
		return content.slice(0, existingSection.contentStart)
			+ nextSectionContent
			+ content.slice(existingSection.end);
	}

	const bodyStart = getBodyStart(content);
	const firstBodyHeading = headings.find((heading) => heading.start >= bodyStart) ?? null;
	const insertAt = firstBodyHeading?.level === 1
		? getInboxInsertionIndexWithinFirstH1(content, headings, firstBodyHeading)
		: bodyStart;

	return insertNewInboxSection(content, insertAt, normalizedInboxHeading, linkLine);
}

function appendListLineToSection(sectionContent: string, linkLine: string): string {
	const trimmedSectionContent = sectionContent.trimEnd();
	if (!trimmedSectionContent) {
		return `${linkLine}\n`;
	}

	return endsWithListItem(trimmedSectionContent)
		? `${trimmedSectionContent}\n${linkLine}\n`
		: `${trimmedSectionContent}\n\n${linkLine}\n`;
}

function isManagedLinkInSection(link: ManagedInlineLink, section: SectionRange | null): boolean {
	return section !== null && link.start >= section.contentStart && link.start < section.end;
}

function endsWithListItem(content: string): boolean {
	const lastLineStart = content.lastIndexOf('\n') + 1;
	const lastLine = content.slice(lastLineStart).replace(/\r$/, '');
	return /^[ \t]*[-*+][ \t]+/.test(lastLine);
}

function insertNewInboxSection(content: string, insertAt: number, inboxHeading: string, linkLine: string): string {
	const prefix = getBlockPrefix(content, insertAt);
	const suffix = getBlockSuffix(content, insertAt);
	const block = `## ${inboxHeading}\n${linkLine}\n`;

	return content.slice(0, insertAt) + prefix + block + suffix + content.slice(insertAt);
}

function getBlockPrefix(content: string, insertAt: number): string {
	if (insertAt <= 0) {
		return '';
	}

	const before = content.slice(0, insertAt);
	if (/\n[ \t]*\n[ \t]*$/.test(before)) {
		return '';
	}

	return before.endsWith('\n') ? '\n' : '\n\n';
}

function getBlockSuffix(content: string, insertAt: number): string {
	if (insertAt >= content.length) {
		return '';
	}

	return content.startsWith('\n', insertAt) ? '' : '\n';
}

function findExistingInboxSection(
	content: string,
	headings: MarkdownHeading[],
	inboxHeading: string,
): SectionRange | null {
	for (const [index, heading] of headings.entries()) {
		if (heading.level !== 2 || heading.text !== inboxHeading) {
			continue;
		}

		return {
			contentStart: heading.end,
			end: findSectionEnd(content, headings, index, 2),
		};
	}

	return null;
}

function getInboxInsertionIndexWithinFirstH1(
	content: string,
	headings: MarkdownHeading[],
	firstHeading: MarkdownHeading,
): number {
	const firstHeadingIndex = headings.findIndex((heading) => heading.start === firstHeading.start);
	if (firstHeadingIndex < 0) {
		return content.length;
	}

	const h1SectionEnd = findSectionEnd(content, headings, firstHeadingIndex, 1);

	for (let index = firstHeadingIndex + 1; index < headings.length; index += 1) {
		const heading = headings[index];
		if (!heading) {
			continue;
		}

		if (heading.start >= h1SectionEnd) {
			break;
		}

		if (heading.level === 2) {
			return heading.start;
		}
	}

	return h1SectionEnd;
}

function findSectionEnd(
	content: string,
	headings: MarkdownHeading[],
	currentHeadingIndex: number,
	maxLevel: number,
): number {
	for (let index = currentHeadingIndex + 1; index < headings.length; index += 1) {
		const heading = headings[index];
		if (!heading) {
			continue;
		}

		if (heading.level <= maxLevel) {
			return heading.start;
		}
	}

	return content.length;
}

function parseMarkdownHeadings(content: string): MarkdownHeading[] {
	const headings: MarkdownHeading[] = [];
	let match: RegExpExecArray | null;

	while ((match = HEADING_LINE_PATTERN.exec(content)) !== null) {
		const [, hashes, rawText] = match;
		if (!hashes || rawText === undefined) {
			continue;
		}

		const start = match.index;
		const lineEnd = getLineEndIndex(content, start);
		const end = lineEnd < content.length ? lineEnd + 1 : lineEnd;
		headings.push({
			end,
			level: hashes.length,
			start,
			text: normalizeHeadingText(rawText),
		});
	}

	return headings;
}

function normalizeHeadingText(value: string): string {
	return value
		.replace(/\r$/, '')
		.replace(/[ \t]+#+[ \t]*$/, '')
		.trim();
}

function getBodyStart(content: string): number {
	const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
	const contentStart = frontmatterMatch ? frontmatterMatch[0].length : 0;
	return skipLeadingBlankLines(content, contentStart);
}

function skipLeadingBlankLines(content: string, start: number): number {
	let index = start;

	while (index < content.length) {
		const lineEnd = getLineEndIndex(content, index);
		const line = content.slice(index, lineEnd).replace(/\r$/, '');
		if (line.trim().length > 0) {
			break;
		}

		index = lineEnd < content.length ? lineEnd + 1 : lineEnd;
	}

	return index;
}

function getManagedLinkRemovalRange(content: string, link: ManagedInlineLink): {end: number; start: number} {
	const lineStart = getLineStartIndex(content, link.start);
	const lineEndWithBreak = getLineEndIndex(content, link.start);
	const beforeLink = content.slice(lineStart, link.start);
	const afterLink = content.slice(link.end, lineEndWithBreak).replace(/\r$/, '');
	const isBareLinkLine = /^[ \t]*$/.test(beforeLink) && /^[ \t]*$/.test(afterLink);
	const isSingleListItemLine = /^[ \t]*[-*+][ \t]+$/.test(beforeLink) && /^[ \t]*$/.test(afterLink);

	if (!isBareLinkLine && !isSingleListItemLine) {
		return {end: link.end, start: link.start};
	}

	let removalEnd = lineEndWithBreak;
	if (removalEnd < content.length && content[removalEnd] === '\n') {
		removalEnd += 1;
	}

	return {
		end: removalEnd,
		start: lineStart,
	};
}

function getLineStartIndex(content: string, index: number): number {
	const lineStart = content.lastIndexOf('\n', Math.max(0, index - 1));
	return lineStart >= 0 ? lineStart + 1 : 0;
}

function getLineEndIndex(content: string, index: number): number {
	const nextLineBreak = content.indexOf('\n', index);
	return nextLineBreak >= 0 ? nextLineBreak : content.length;
}

function normalizeInboxHeading(value: string): string {
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : DEFAULT_INBOX_HEADING;
}

function normalizeContentAfterRemoval(content: string): string {
	const normalized = content
		.replace(/^[ \t]*[-*+][ \t]*(?:\n|$)/gm, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trimEnd();

	return normalized ? `${normalized}\n` : '';
}
