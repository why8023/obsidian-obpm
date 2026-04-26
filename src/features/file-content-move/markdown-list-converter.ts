export interface BuildMovedContentListOptions {
	sourceBasename: string;
	sourceContent: string;
	stripSingleH1: boolean;
}

interface HeadingLine {
	level: number;
	text: string;
}

interface ListLine {
	content: string;
	indentWidth: number;
}

const LIST_INDENT = '    ';
const HEADING_LINE_PATTERN = /^(?: {0,3})(#{1,6})[ \t]+(.+?)\s*#*\s*$/;
const LIST_LINE_PATTERN = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+(.*)$/;
const FENCE_LINE_PATTERN = /^(?: {0,3})(`{3,}|~{3,})/;

export function buildMovedContentList(options: BuildMovedContentListOptions): string {
	const sourceBasename = normalizeListItemText(options.sourceBasename) || 'Untitled';
	const lines = normalizeSourceContent(options.sourceContent).split('\n');
	const shouldStripSingleH1 = options.stripSingleH1 && countLevelOneHeadings(lines) === 1;
	const headingLevelOffset = shouldStripSingleH1 ? 1 : 0;
	const outputLines: string[] = [formatListItem(0, sourceBasename)];
	let currentHeadingLevel = 0;
	let hasContentAfterRoot = false;
	let listIndentStack: number[] = [];
	let previousListOutputLevel: number | null = null;
	let inFence = false;

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, '');
		const trimmedLine = line.trim();
		const fenceBeforeLine = inFence;
		const fenceMatch = FENCE_LINE_PATTERN.exec(line);

		if (trimmedLine.length === 0) {
			listIndentStack = [];
			if (inFence && hasContentAfterRoot && outputLines[outputLines.length - 1] !== '') {
				outputLines.push('');
			}
			continue;
		}

		if (!fenceBeforeLine) {
			const heading = parseHeadingLine(line);
			if (heading) {
				listIndentStack = [];
				previousListOutputLevel = null;

				if (shouldStripSingleH1 && heading.level === 1) {
					currentHeadingLevel = 0;
					if (fenceMatch) {
						inFence = !inFence;
					}
					continue;
				}

				currentHeadingLevel = Math.max(1, heading.level - headingLevelOffset);
				outputLines.push(formatListItem(currentHeadingLevel, heading.text));
				hasContentAfterRoot = true;
				if (fenceMatch) {
					inFence = !inFence;
				}
				continue;
			}

			const listLine = parseListLine(line);
			if (listLine) {
				const relativeListLevel = updateListIndentStack(listIndentStack, listLine.indentWidth);
				const outputLevel = getContentLevel(currentHeadingLevel) + relativeListLevel;
				outputLines.push(formatListItem(outputLevel, listLine.content));
				hasContentAfterRoot = true;
				previousListOutputLevel = outputLevel;
				if (fenceMatch) {
					inFence = !inFence;
				}
				continue;
			}
		}

		const isListContinuationLine = previousListOutputLevel !== null && hasLeadingWhitespace(line);
		const continuationBaseLevel = previousListOutputLevel;
		const outputLevel = isListContinuationLine && continuationBaseLevel !== null
			? continuationBaseLevel + 1
			: getContentLevel(currentHeadingLevel);
		outputLines.push(formatIndentedContent(outputLevel, fenceBeforeLine || fenceMatch ? line : trimmedLine));
		hasContentAfterRoot = true;
		listIndentStack = [];
		if (!isListContinuationLine) {
			previousListOutputLevel = null;
		}

		if (fenceMatch) {
			inFence = !inFence;
		}
	}

	return trimTrailingBlankLines(outputLines).join('\n');
}

function countLevelOneHeadings(lines: readonly string[]): number {
	let count = 0;
	let inFence = false;

	for (const line of lines) {
		const fenceMatch = FENCE_LINE_PATTERN.exec(line);
		if (!inFence) {
			const heading = parseHeadingLine(line);
			if (heading?.level === 1) {
				count += 1;
			}
		}

		if (fenceMatch) {
			inFence = !inFence;
		}
	}

	return count;
}

function formatListItem(level: number, text: string): string {
	return `${LIST_INDENT.repeat(Math.max(0, level))}- ${normalizeListItemText(text)}`;
}

function formatIndentedContent(level: number, text: string): string {
	return `${LIST_INDENT.repeat(Math.max(1, level))}${text}`;
}

function getContentLevel(currentHeadingLevel: number): number {
	return Math.max(1, currentHeadingLevel + 1);
}

function hasLeadingWhitespace(value: string): boolean {
	return /^[ \t]+/.test(value);
}

function normalizeLineEndings(value: string): string {
	return value.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

function normalizeSourceContent(value: string): string {
	return normalizeLineEndings(stripLeadingFrontmatter(value));
}

function normalizeListItemText(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

function parseHeadingLine(line: string): HeadingLine | null {
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
		text: rawText.replace(/[ \t]+#+[ \t]*$/, '').trim(),
	};
}

function parseListLine(line: string): ListLine | null {
	const match = LIST_LINE_PATTERN.exec(line);
	if (!match) {
		return null;
	}

	const indentText = match[1] ?? '';
	const content = match[2] ?? '';
	return {
		content,
		indentWidth: countIndentWidth(indentText),
	};
}

function countIndentWidth(value: string): number {
	let width = 0;
	for (const character of value) {
		width += character === '\t' ? LIST_INDENT.length : 1;
	}

	return width;
}

function updateListIndentStack(stack: number[], indentWidth: number): number {
	while (stack.length > 0 && indentWidth < stack[stack.length - 1]!) {
		stack.pop();
	}

	if (stack.length === 0 || indentWidth > stack[stack.length - 1]!) {
		stack.push(indentWidth);
	}

	return Math.max(0, stack.indexOf(indentWidth));
}

function stripLeadingFrontmatter(value: string): string {
	const normalizedValue = value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
	const lines = normalizedValue.split('\n');
	if (lines[0]?.trim() !== '---') {
		return normalizedValue;
	}

	for (let index = 1; index < lines.length; index += 1) {
		const currentLine = lines[index]?.trim();
		if (currentLine === '---' || currentLine === '...') {
			return lines.slice(index + 1).join('\n');
		}
	}

	return normalizedValue;
}

function trimTrailingBlankLines(lines: string[]): string[] {
	while (lines.length > 1 && lines[lines.length - 1] === '') {
		lines.pop();
	}

	return lines;
}
