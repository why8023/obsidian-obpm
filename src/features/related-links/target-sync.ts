import {TFile} from 'obsidian';
import {buildManagedMarkdownLink, buildRelativeMarkdownDestination, extractManagedInlineLinks, ManagedInlineLink} from './managed-link-protocol';
import {DesiredTargetLink, DesiredTargetLinkNode} from './types';

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

interface TargetTreeSyncOptions {
	debugLog?: (message: string, details?: unknown) => void;
	desiredLinkTree: DesiredTargetLinkNode[];
	inboxHeading: string;
	resolveManagedSourcePath: (link: ManagedInlineLink, targetFile: TFile) => string | null;
	resolveSourceFile: (sourcePath: string) => TFile | null;
	shouldDeferMissingLinkInsertion?: (link: DesiredTargetLink, targetFile: TFile) => boolean;
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

interface LineInfo {
	end: number;
	endWithBreak: number;
	index: number;
	start: number;
	text: string;
}

interface ParsedListItemLine {
	contentStart: number;
	indentWidth: number;
}

interface ExistingManagedTreeItem {
	blockEnd: number;
	children: ExistingManagedTreeItem[];
	itemStart: number;
	line: LineInfo;
	listItem: ParsedListItemLine;
	managedLink: ManagedInlineLink;
	parent: ExistingManagedTreeItem | null;
	pathKey: string;
	sourcePath: string;
}

interface PreservedManagedTreeContent {
	childTrailingBlocksByPathKey: Map<string, string>;
	itemIndentWidth: number;
	leadingBlock: string;
	sameLineSuffix: string;
}

interface ManagedTreeBlockRange {
	contentEnd: number;
	contentStart: number;
	end: number;
	start: number;
}

const DEFAULT_INBOX_HEADING = 'Inbox';
const HEADING_LINE_PATTERN = /^(?: {0,3})(#{1,6})[ \t]+(.*)$/gm;
const MANAGED_TREE_INDENT = '    ';
const MANAGED_TREE_INDENT_WIDTH = 4;
const MANAGED_TREE_PATH_SEPARATOR = '\0';
const RELATED_LINKS_BLOCK_START_MARKER = '<!-- obpm-related-links -->';
const RELATED_LINKS_BLOCK_END_MARKER = '<!-- /obpm-related-links -->';

export function syncManagedLinksInContent(content: string, options: TargetSyncOptions): TargetSyncResult {
	const satisfiedDesiredSourcePaths = new Set<string>();
	const deferredMissingSourcePaths = new Set<string>();
	const ignoredManagedTreeBlockRanges = findExistingManagedTreeBlockRanges(content);
	const managedLinks = extractManagedInlineLinks(content)
		.filter((managedLink) => !isIndexInContentRanges(managedLink.start, ignoredManagedTreeBlockRanges));
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

export function syncManagedLinkTreeInContent(content: string, options: TargetTreeSyncOptions): TargetSyncResult {
	const satisfiedDesiredSourcePaths = new Set<string>();
	const deferredMissingSourcePaths = new Set<string>();
	const existingBlock = findExistingManagedTreeBlock(content);
	const existingTreeState = existingBlock?.status === 'complete'
		? collectExistingManagedTreeState(
			content.slice(existingBlock.range.contentStart, existingBlock.range.contentEnd),
			options,
		)
		: existingBlock?.status === 'incomplete'
			? createEmptyManagedTreeState()
			: collectExistingManagedTreeState(content, options);
	const linkBlock = buildManagedMarkdownTreeBlock(options.desiredLinkTree, {
		deferredMissingSourcePaths,
		existingManagedSourcePaths: existingTreeState.existingManagedSourcePaths,
		pathPrefix: [options.targetFile.path],
		preservedContentByPathKey: existingTreeState.preservedContentByPathKey,
		resolveSourceFile: options.resolveSourceFile,
		shouldDeferMissingLinkInsertion: options.shouldDeferMissingLinkInsertion,
		satisfiedDesiredSourcePaths,
		targetFile: options.targetFile,
	});
	const managedBlock = linkBlock.length > 0 ? wrapManagedTreeBlock(linkBlock) : '';
	if (existingBlock?.status === 'complete') {
		return {
			content: content.slice(0, existingBlock.range.start) + managedBlock + content.slice(existingBlock.range.end),
			deferredMissingSourcePaths,
			satisfiedDesiredSourcePaths,
		};
	}

	let finalContent = existingTreeState.removalRanges.length > 0
		? normalizeContentAfterRemoval(removeContentRanges(content, existingTreeState.removalRanges))
		: content;

	if (managedBlock.length > 0) {
		finalContent = insertLinkBlockIntoInboxSection(
			finalContent,
			managedBlock,
			options.inboxHeading,
		);
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

function buildManagedMarkdownTreeBlock(
	nodes: DesiredTargetLinkNode[],
	options: {
		deferredMissingSourcePaths: Set<string>;
		existingManagedSourcePaths: ReadonlySet<string>;
		pathPrefix: string[];
		preservedContentByPathKey: ReadonlyMap<string, PreservedManagedTreeContent>;
		resolveSourceFile: (sourcePath: string) => TFile | null;
		shouldDeferMissingLinkInsertion?: (link: DesiredTargetLink, targetFile: TFile) => boolean;
		satisfiedDesiredSourcePaths: Set<string>;
		targetFile: TFile;
	},
	depth = 0,
	parentPreservedContent: PreservedManagedTreeContent | null = null,
): string {
	let block = '';
	const indent = MANAGED_TREE_INDENT.repeat(depth);
	const desiredChildPathKeys = new Set<string>();

	for (const node of nodes) {
		const sourceFile = options.resolveSourceFile(node.sourcePath);
		if (!sourceFile) {
			continue;
		}

		const path = [...options.pathPrefix, node.sourcePath];
		const pathKey = buildManagedTreePathKey(path);
		desiredChildPathKeys.add(pathKey);
		if (
			!options.existingManagedSourcePaths.has(node.sourcePath)
			&& options.shouldDeferMissingLinkInsertion?.(node, options.targetFile)
		) {
			options.deferredMissingSourcePaths.add(node.sourcePath);
			continue;
		}

		const destination = buildRelativeMarkdownDestination(sourceFile, options.targetFile);
		const preservedContent = options.preservedContentByPathKey.get(pathKey) ?? null;
		const sameLineSuffix = preservedContent?.sameLineSuffix ?? '';
		block += `${indent}- ${buildManagedMarkdownLink(node.displayText, destination)}${sameLineSuffix}\n`;
		options.satisfiedDesiredSourcePaths.add(node.sourcePath);
		if (preservedContent) {
			block += reindentPreservedBlock(
				preservedContent.leadingBlock,
				preservedContent.itemIndentWidth,
				depth * MANAGED_TREE_INDENT_WIDTH,
			);
		}

		block += buildManagedMarkdownTreeBlock(node.children, {
			...options,
			pathPrefix: path,
		}, depth + 1, preservedContent);

		if (parentPreservedContent) {
			block += reindentPreservedBlock(
				parentPreservedContent.childTrailingBlocksByPathKey.get(pathKey) ?? '',
				parentPreservedContent.itemIndentWidth,
				Math.max(0, depth - 1) * MANAGED_TREE_INDENT_WIDTH,
			);
		}
	}

	if (parentPreservedContent) {
		for (const [childPathKey, trailingBlock] of parentPreservedContent.childTrailingBlocksByPathKey.entries()) {
			if (desiredChildPathKeys.has(childPathKey)) {
				continue;
			}

			block += reindentPreservedBlock(
				trailingBlock,
				parentPreservedContent.itemIndentWidth,
				Math.max(0, depth - 1) * MANAGED_TREE_INDENT_WIDTH,
			);
		}
	}

	return block;
}

function collectExistingManagedTreeState(
	content: string,
	options: TargetTreeSyncOptions,
): {
	existingManagedSourcePaths: Set<string>;
	preservedContentByPathKey: Map<string, PreservedManagedTreeContent>;
	removalRanges: {end: number; start: number}[];
} {
	const lines = parseLines(content);
	const lineByStart = new Map<number, LineInfo>();
	for (const line of lines) {
		lineByStart.set(line.start, line);
	}

	const managedListItems: ExistingManagedTreeItem[] = [];
	const fallbackRemovalRanges: {end: number; start: number}[] = [];
	const existingManagedSourcePaths = new Set<string>();
	for (const managedLink of extractManagedInlineLinks(content)) {
		const sourcePath = options.resolveManagedSourcePath(managedLink, options.targetFile);
		if (!sourcePath) {
			fallbackRemovalRanges.push(getManagedLinkRemovalRange(content, managedLink));
			continue;
		}

		existingManagedSourcePaths.add(sourcePath);
		const lineStart = getLineStartIndex(content, managedLink.start);
		const line = lineByStart.get(lineStart);
		if (!line) {
			fallbackRemovalRanges.push(getManagedLinkRemovalRange(content, managedLink));
			continue;
		}

		const listItem = parseListItemLine(line.text);
		if (!listItem || managedLink.start < line.start + listItem.contentStart) {
			fallbackRemovalRanges.push(getManagedLinkRemovalRange(content, managedLink));
			continue;
		}

		managedListItems.push({
			blockEnd: findListItemBlockEnd(lines, line.index, listItem.indentWidth),
			children: [],
			itemStart: line.start,
			line,
			listItem,
			managedLink,
			parent: null,
			pathKey: '',
			sourcePath,
		});
	}

	const sortedManagedListItems = managedListItems
		.sort((left, right) => left.itemStart - right.itemStart);
	assignManagedTreeParents(sortedManagedListItems);
	assignManagedTreePathKeys(sortedManagedListItems, options.targetFile.path);

	const preservedContentByPathKey = new Map<string, PreservedManagedTreeContent>();
	for (const managedItem of sortedManagedListItems) {
		if (preservedContentByPathKey.has(managedItem.pathKey)) {
			continue;
		}

		preservedContentByPathKey.set(
			managedItem.pathKey,
			buildPreservedManagedTreeContent(content, managedItem),
		);
	}

	const removalRanges = mergeContentRanges([
		...fallbackRemovalRanges,
		...sortedManagedListItems
			.filter((managedItem) => managedItem.parent === null)
			.map((managedItem) => ({
				end: managedItem.blockEnd,
				start: managedItem.itemStart,
			})),
	]);

	return {
		existingManagedSourcePaths,
		preservedContentByPathKey,
		removalRanges,
	};
}

function createEmptyManagedTreeState(): {
	existingManagedSourcePaths: Set<string>;
	preservedContentByPathKey: Map<string, PreservedManagedTreeContent>;
	removalRanges: {end: number; start: number}[];
} {
	return {
		existingManagedSourcePaths: new Set<string>(),
		preservedContentByPathKey: new Map<string, PreservedManagedTreeContent>(),
		removalRanges: [],
	};
}

function findExistingManagedTreeBlock(content: string):
	| {range: ManagedTreeBlockRange; status: 'complete'}
	| {status: 'incomplete'}
	| null {
	const lines = parseLines(content);
	let startLine: LineInfo | null = null;
	let sawIncompleteMarker = false;

	for (const line of lines) {
		if (isRelatedLinksBlockStartMarker(line.text)) {
			if (!startLine) {
				startLine = line;
			} else {
				sawIncompleteMarker = true;
			}
			continue;
		}

		if (!isRelatedLinksBlockEndMarker(line.text)) {
			continue;
		}

		if (!startLine) {
			sawIncompleteMarker = true;
			continue;
		}

		return {
			range: {
				contentEnd: line.start,
				contentStart: startLine.endWithBreak,
				end: line.endWithBreak,
				start: startLine.start,
			},
			status: 'complete',
		};
	}

	return startLine || sawIncompleteMarker ? {status: 'incomplete'} : null;
}

function findExistingManagedTreeBlockRanges(content: string): {end: number; start: number}[] {
	const ranges: {end: number; start: number}[] = [];
	let searchStart = 0;

	while (searchStart < content.length) {
		const nextBlock = findExistingManagedTreeBlock(content.slice(searchStart));
		if (nextBlock?.status !== 'complete') {
			break;
		}

		ranges.push({
			end: searchStart + nextBlock.range.end,
			start: searchStart + nextBlock.range.start,
		});
		searchStart += nextBlock.range.end;
	}

	return ranges;
}

function wrapManagedTreeBlock(linkBlock: string): string {
	return `${RELATED_LINKS_BLOCK_START_MARKER}\n${linkBlock}${RELATED_LINKS_BLOCK_END_MARKER}\n`;
}

function assignManagedTreeParents(managedItems: ExistingManagedTreeItem[]) {
	const stack: ExistingManagedTreeItem[] = [];

	for (const managedItem of managedItems) {
		while (
			stack.length > 0
			&& (stack[stack.length - 1]?.listItem.indentWidth ?? 0) >= managedItem.listItem.indentWidth
		) {
			stack.pop();
		}

		const parent = stack[stack.length - 1] ?? null;
		if (parent && managedItem.itemStart < parent.blockEnd) {
			managedItem.parent = parent;
			parent.children.push(managedItem);
		}

		stack.push(managedItem);
	}
}

function assignManagedTreePathKeys(managedItems: ExistingManagedTreeItem[], targetFilePath: string) {
	for (const managedItem of managedItems) {
		const path = [targetFilePath];
		const ancestors: ExistingManagedTreeItem[] = [];
		let currentParent = managedItem.parent;
		while (currentParent) {
			ancestors.push(currentParent);
			currentParent = currentParent.parent;
		}

		for (const ancestor of ancestors.reverse()) {
			path.push(ancestor.sourcePath);
		}

		path.push(managedItem.sourcePath);
		managedItem.pathKey = buildManagedTreePathKey(path);
	}
}

function buildPreservedManagedTreeContent(
	content: string,
	managedItem: ExistingManagedTreeItem,
): PreservedManagedTreeContent {
	const sortedChildren = managedItem.children
		.sort((left, right) => left.itemStart - right.itemStart);
	const sameLineSuffix = content
		.slice(managedItem.managedLink.end, managedItem.line.end)
		.replace(/\r$/, '');
	let cursor = managedItem.line.endWithBreak;
	let leadingBlock = '';
	const childTrailingBlocksByPathKey = new Map<string, string>();

	if (sortedChildren.length === 0) {
		leadingBlock = content.slice(cursor, managedItem.blockEnd);
	} else {
		const firstChild = sortedChildren[0];
		if (firstChild) {
			leadingBlock = content.slice(cursor, firstChild.itemStart);
		}

		for (const [index, child] of sortedChildren.entries()) {
			const nextChild = sortedChildren[index + 1] ?? null;
			const trailingBlock = content.slice(child.blockEnd, nextChild?.itemStart ?? managedItem.blockEnd);
			if (trailingBlock) {
				childTrailingBlocksByPathKey.set(child.pathKey, trailingBlock);
			}

		}
	}

	return {
		childTrailingBlocksByPathKey,
		itemIndentWidth: managedItem.listItem.indentWidth,
		leadingBlock,
		sameLineSuffix,
	};
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

function insertLinkBlockIntoInboxSection(content: string, linkBlock: string, inboxHeading: string): string {
	const normalizedInboxHeading = normalizeInboxHeading(inboxHeading);
	const headings = parseMarkdownHeadings(content);
	const existingSection = findExistingInboxSection(content, headings, normalizedInboxHeading);
	if (existingSection) {
		const sectionContent = content.slice(existingSection.contentStart, existingSection.end);
		const nextSectionContent = appendListBlockToSection(sectionContent, linkBlock);
		return content.slice(0, existingSection.contentStart)
			+ nextSectionContent
			+ content.slice(existingSection.end);
	}

	const bodyStart = getBodyStart(content);
	const firstBodyHeading = headings.find((heading) => heading.start >= bodyStart) ?? null;
	const insertAt = firstBodyHeading?.level === 1
		? getInboxInsertionIndexWithinFirstH1(content, headings, firstBodyHeading)
		: bodyStart;

	return insertNewInboxSection(content, insertAt, normalizedInboxHeading, linkBlock.trimEnd());
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

function appendListBlockToSection(sectionContent: string, linkBlock: string): string {
	const trimmedSectionContent = sectionContent.trimEnd();
	if (!trimmedSectionContent) {
		return linkBlock;
	}

	return endsWithListItem(trimmedSectionContent)
		? `${trimmedSectionContent}\n${linkBlock}`
		: `${trimmedSectionContent}\n\n${linkBlock}`;
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

function parseLines(content: string): LineInfo[] {
	const lines: LineInfo[] = [];
	let start = 0;
	let index = 0;

	while (start < content.length) {
		const lineEnd = getLineEndIndex(content, start);
		const endWithBreak = lineEnd < content.length ? lineEnd + 1 : lineEnd;
		lines.push({
			end: lineEnd,
			endWithBreak,
			index,
			start,
			text: content.slice(start, lineEnd),
		});
		start = endWithBreak;
		index += 1;
	}

	if (content.length === 0) {
		lines.push({
			end: 0,
			endWithBreak: 0,
			index: 0,
			start: 0,
			text: '',
		});
	}

	return lines;
}

function parseListItemLine(line: string): ParsedListItemLine | null {
	const match = /^([ \t]*)([-*+])([ \t]+)/.exec(line);
	if (!match) {
		return null;
	}

	const [fullMatch, indentText] = match;
	if (indentText === undefined) {
		return null;
	}

	return {
		contentStart: fullMatch.length,
		indentWidth: countIndentWidth(indentText),
	};
}

function findListItemBlockEnd(lines: LineInfo[], lineIndex: number, itemIndentWidth: number): number {
	const itemLine = lines[lineIndex];
	if (!itemLine) {
		return 0;
	}

	for (let index = lineIndex + 1; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line) {
			continue;
		}

		if (isBlankLine(line.text)) {
			continue;
		}

		if (isMarkdownHeadingLine(line.text)) {
			return line.start;
		}

		const listItem = parseListItemLine(line.text);
		if (listItem) {
			if (listItem.indentWidth <= itemIndentWidth) {
				return line.start;
			}

			continue;
		}

		if (countLeadingWhitespaceWidth(line.text) <= itemIndentWidth) {
			return line.start;
		}
	}

	const lastLine = lines[lines.length - 1];
	return lastLine ? lastLine.endWithBreak : itemLine.endWithBreak;
}

function removeContentRanges(content: string, ranges: {end: number; start: number}[]): string {
	let nextContent = '';
	let lastIndex = 0;

	for (const range of ranges) {
		nextContent += content.slice(lastIndex, range.start);
		lastIndex = Math.max(lastIndex, range.end);
	}

	return nextContent + content.slice(lastIndex);
}

function mergeContentRanges(ranges: {end: number; start: number}[]): {end: number; start: number}[] {
	const sortedRanges = ranges
		.filter((range) => range.end > range.start)
		.sort((left, right) => left.start - right.start || left.end - right.end);
	const mergedRanges: {end: number; start: number}[] = [];

	for (const range of sortedRanges) {
		const previousRange = mergedRanges[mergedRanges.length - 1];
		if (!previousRange || range.start > previousRange.end) {
			mergedRanges.push({...range});
			continue;
		}

		previousRange.end = Math.max(previousRange.end, range.end);
	}

	return mergedRanges;
}

function isIndexInContentRanges(index: number, ranges: {end: number; start: number}[]): boolean {
	return ranges.some((range) => index >= range.start && index < range.end);
}

function reindentPreservedBlock(block: string, previousParentIndentWidth: number, nextParentIndentWidth: number): string {
	if (!block) {
		return '';
	}

	const indentDelta = nextParentIndentWidth - previousParentIndentWidth;
	if (indentDelta === 0) {
		return block;
	}

	return block
		.split(/(\n)/)
		.map((segment) => {
			if (segment === '\n' || segment.trim().length === 0) {
				return segment;
			}

			return indentDelta > 0
				? `${' '.repeat(indentDelta)}${segment}`
				: removeIndentColumns(segment, -indentDelta);
		})
		.join('');
}

function removeIndentColumns(line: string, columnsToRemove: number): string {
	let removedColumns = 0;
	let index = 0;

	while (index < line.length && removedColumns < columnsToRemove) {
		const character = line[index];
		if (character === ' ') {
			removedColumns += 1;
			index += 1;
			continue;
		}

		if (character === '\t') {
			removedColumns += MANAGED_TREE_INDENT_WIDTH;
			index += 1;
			continue;
		}

		break;
	}

	return line.slice(index);
}

function buildManagedTreePathKey(paths: string[]): string {
	return paths.join(MANAGED_TREE_PATH_SEPARATOR);
}

function isBlankLine(line: string): boolean {
	return line.replace(/\r$/, '').trim().length === 0;
}

function isMarkdownHeadingLine(line: string): boolean {
	return /^(?: {0,3})#{1,6}[ \t]+/.test(line);
}

function isRelatedLinksBlockStartMarker(line: string): boolean {
	return /^<!--\s*obpm-related-links\s*-->\s*$/.test(line.trim());
}

function isRelatedLinksBlockEndMarker(line: string): boolean {
	return /^<!--\s*\/obpm-related-links\s*-->\s*$/.test(line.trim());
}

function countLeadingWhitespaceWidth(line: string): number {
	const match = /^[ \t]*/.exec(line);
	return countIndentWidth(match?.[0] ?? '');
}

function countIndentWidth(value: string): number {
	let width = 0;
	for (const character of value) {
		width += character === '\t' ? MANAGED_TREE_INDENT_WIDTH : 1;
	}

	return width;
}
