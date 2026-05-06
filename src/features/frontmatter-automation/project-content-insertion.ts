import {buildMovedContentBody, buildMovedContentList} from '../sent-content/source-content';
import {appendSourcePropertyComment, SourcePropertyMap} from '../sent-content/source-property-comment';
import {buildOffsetInsertionPlan, OffsetInsertionPlan} from '../sent-content/target-insertion';
import {FrontmatterAutomationProjectContentPlacementMode} from './frontmatter-automation-types';

export interface ProjectContentPlacement {
	headingLevel: number;
	mode: FrontmatterAutomationProjectContentPlacementMode;
	targetHeading: string;
}

interface BuildProjectFileContentWithSentContentOptions {
	placement: ProjectContentPlacement;
	preserveSourceProperties?: boolean;
	projectContent: string;
	sourceBasename: string;
	sourceContent: string;
	sourceProperties?: SourcePropertyMap | null;
	stripSingleH1: boolean;
}

interface HeadingRange {
	endOffset: number;
	startOffset: number;
}

interface HeadingMatch {
	level: number;
	startOffset: number;
	text: string;
}

const HEADING_LINE_PATTERN = /^(?: {0,3})(#{1,6})[ \t]+(.+?)\s*#*\s*$/;
const FENCE_LINE_PATTERN = /^(?: {0,3})(`{3,}|~{3,})/;

export function buildProjectFileContentWithSentContent(
	options: BuildProjectFileContentWithSentContentOptions,
): string {
	return buildProjectFileContentSentContentInsertionPlan(options).nextContent;
}

export function buildProjectFileContentSentContentInsertionPlan(
	options: BuildProjectFileContentWithSentContentOptions,
): OffsetInsertionPlan {
	const headingLevel = normalizeHeadingLevel(options.placement.headingLevel);
	if (options.placement.mode === 'source_name_heading') {
		const targetHeading = options.placement.targetHeading.trim();
		if (targetHeading.length === 0) {
			return appendBlock(options.projectContent, buildSourceNameHeadingBlock({
				headingLevel,
				preserveSourceProperties: options.preserveSourceProperties,
				sourceBasename: options.sourceBasename,
				sourceContent: options.sourceContent,
				sourceProperties: options.sourceProperties,
				stripSingleH1: options.stripSingleH1,
			}));
		}

		const parentHeadingLevel = normalizeParentHeadingLevel(options.placement.headingLevel);
		const sourceNameHeadingBlock = buildSourceNameHeadingBlock({
			headingLevel: parentHeadingLevel + 1,
			preserveSourceProperties: options.preserveSourceProperties,
			sourceBasename: options.sourceBasename,
			sourceContent: options.sourceContent,
			sourceProperties: options.sourceProperties,
			stripSingleH1: options.stripSingleH1,
		});
		const headingRange = findHeadingRange(options.projectContent, parentHeadingLevel, targetHeading);
		if (!headingRange) {
			return appendBlock(
				options.projectContent,
				`${formatHeadingLine(parentHeadingLevel, targetHeading)}\n\n${sourceNameHeadingBlock}`,
			);
		}

		return buildOffsetInsertionPlan({
			block: sourceNameHeadingBlock,
			content: options.projectContent,
			insertOffset: headingRange.endOffset,
		});
	}

	const targetHeading = options.placement.targetHeading.trim();
	const sentContent = buildMovedContentList({
		preserveSourceProperties: options.preserveSourceProperties,
		sourceBasename: options.sourceBasename,
		sourceContent: options.sourceContent,
		sourceProperties: options.sourceProperties,
		stripSingleH1: options.stripSingleH1,
	});
	const headingRange = findHeadingRange(options.projectContent, headingLevel, targetHeading);
	if (!headingRange) {
		return appendBlock(options.projectContent, `${formatHeadingLine(headingLevel, targetHeading)}\n\n${sentContent}`);
	}

	return buildOffsetInsertionPlan({
		block: sentContent,
		content: options.projectContent,
		insertOffset: headingRange.endOffset,
	});
}

function appendBlock(content: string, block: string): OffsetInsertionPlan {
	return buildOffsetInsertionPlan({
		block,
		content,
		insertOffset: content.length,
	});
}

function buildSourceNameHeadingBlock(options: {
	headingLevel: number;
	preserveSourceProperties?: boolean;
	sourceBasename: string;
	sourceContent: string;
	sourceProperties?: SourcePropertyMap | null;
	stripSingleH1: boolean;
}): string {
	const headingLine = options.preserveSourceProperties
		? appendSourcePropertyComment(formatHeadingLine(options.headingLevel, options.sourceBasename), options.sourceProperties)
		: formatHeadingLine(options.headingLevel, options.sourceBasename);
	const body = buildMovedContentBody({
		parentHeadingLevel: options.headingLevel,
		sourceContent: options.sourceContent,
		stripSingleH1: options.stripSingleH1,
	});
	return body.length > 0 ? `${headingLine}\n\n${body}` : headingLine;
}

function findHeadingRange(content: string, level: number, text: string): HeadingRange | null {
	let matchedHeading: HeadingMatch | null = null;
	let inFence = false;

	for (const line of iterateLines(content)) {
		const fenceBeforeLine = inFence;
		const fenceMatch = FENCE_LINE_PATTERN.exec(line.text);
		if (!fenceBeforeLine) {
			const heading = parseHeadingLine(line.text, line.startOffset);
			if (heading) {
				if (matchedHeading && heading.level <= matchedHeading.level) {
					return {
						endOffset: line.startOffset,
						startOffset: matchedHeading.startOffset,
					};
				}

				if (!matchedHeading && heading.level === level && heading.text === text) {
					matchedHeading = heading;
				}
			}
		}

		if (fenceMatch) {
			inFence = !inFence;
		}
	}

	if (!matchedHeading) {
		return null;
	}

	return {
		endOffset: content.length,
		startOffset: matchedHeading.startOffset,
	};
}

function formatHeadingLine(level: number, text: string): string {
	return `${'#'.repeat(level)} ${text.trim().replace(/\s+/g, ' ') || 'Untitled'}`;
}

function* iterateLines(content: string): Generator<{startOffset: number; text: string}> {
	let startOffset = 0;
	while (startOffset <= content.length) {
		const nextLineIndex = content.indexOf('\n', startOffset);
		if (nextLineIndex === -1) {
			yield {
				startOffset,
				text: content.slice(startOffset),
			};
			return;
		}

		yield {
			startOffset,
			text: content.slice(startOffset, nextLineIndex),
		};
		startOffset = nextLineIndex + 1;
	}
}

function normalizeHeadingLevel(value: number): number {
	return Math.min(6, Math.max(1, Math.trunc(value)));
}

function normalizeParentHeadingLevel(value: number): number {
	return Math.min(5, Math.max(1, Math.trunc(value)));
}

function parseHeadingLine(line: string, startOffset: number): HeadingMatch | null {
	const match = HEADING_LINE_PATTERN.exec(line);
	if (!match) {
		return null;
	}

	const hashes = match[1];
	const rawText = match[2];
	if (!hashes || rawText === undefined) {
		return null;
	}

	return {
		level: hashes.length,
		startOffset,
		text: rawText.replace(/[ \t]+#+[ \t]*$/, '').trim().replace(/\s+/g, ' '),
	};
}
