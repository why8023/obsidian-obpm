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

const DEFAULT_SECTION_HEADING = 'related';
const HEADING_LINE_PATTERN = /^(?: {0,3})(#{1,6})[ \t]+(.*)$/gm;

export function buildMarkdownListItemForWikilink(filePath: string, displayText: string): string {
	return `- ${buildVaultPathWikilink(filePath, displayText)}`;
}

export function buildVaultPathWikilink(filePath: string, displayText: string): string {
	const linkpath = stripMarkdownExtension(filePath.replace(/\\/g, '/').replace(/^\/+/, ''));
	const normalizedDisplayText = normalizeWikilinkAlias(displayText);
	const fallbackDisplayText = getBasenameWithoutMarkdownExtension(filePath);
	if (!normalizedDisplayText || normalizedDisplayText === fallbackDisplayText || normalizedDisplayText === linkpath) {
		return `[[${linkpath}]]`;
	}

	return `[[${linkpath}|${normalizedDisplayText}]]`;
}

export function insertListItemIntoHeadingSection(
	content: string,
	headingText: string,
	listItem: string,
): string {
	const normalizedHeadingText = normalizeRequiredHeadingText(headingText);
	const headings = parseMarkdownHeadings(content);
	const existingSection = findExistingHeadingSection(content, headings, normalizedHeadingText);
	if (existingSection) {
		const sectionContent = content.slice(existingSection.contentStart, existingSection.end);
		const nextSectionContent = appendListItemToSection(sectionContent, listItem);
		return content.slice(0, existingSection.contentStart)
			+ nextSectionContent
			+ content.slice(existingSection.end);
	}

	const bodyStart = getBodyStart(content);
	const firstBodyHeading = headings.find((heading) => heading.start >= bodyStart) ?? null;
	const insertAt = firstBodyHeading?.level === 1
		? getInsertionIndexWithinFirstH1(content, headings, firstBodyHeading)
		: bodyStart;

	return insertNewHeadingSection(content, insertAt, normalizedHeadingText, listItem);
}

export function getHeadingSectionContent(content: string, headingText: string): string | null {
	const normalizedHeadingText = normalizeRequiredHeadingText(headingText);
	const headings = parseMarkdownHeadings(content);
	const section = findExistingHeadingSection(content, headings, normalizedHeadingText);
	return section ? content.slice(section.contentStart, section.end) : null;
}

export function wikilinkSectionContainsPath(sectionContent: string, filePath: string): boolean {
	const targetPath = normalizeComparableLinkpath(filePath);
	const targetBasename = getBasenameWithoutMarkdownExtension(filePath);
	const wikilinkPattern = /!?\[\[([^\]\r\n]+)\]\]/g;
	let match: RegExpExecArray | null;

	while ((match = wikilinkPattern.exec(sectionContent)) !== null) {
		if (match.index > 0 && sectionContent[match.index - 1] === '!') {
			continue;
		}

		const rawBody = match[1];
		if (rawBody === undefined) {
			continue;
		}

		const linkpath = extractWikilinkTarget(rawBody);
		if (!linkpath) {
			continue;
		}

		const normalizedLinkpath = normalizeComparableLinkpath(linkpath);
		if (normalizedLinkpath === targetPath || normalizedLinkpath === targetBasename) {
			return true;
		}
	}

	return false;
}

function appendListItemToSection(sectionContent: string, listItem: string): string {
	const trimmedSectionContent = sectionContent.trimEnd();
	if (!trimmedSectionContent) {
		return `${listItem}\n`;
	}

	const trailingBreak = /\n[ \t]*\n[ \t]*$/.test(sectionContent) ? '\n\n' : '\n';
	return endsWithListItem(trimmedSectionContent)
		? `${trimmedSectionContent}\n${listItem}${trailingBreak}`
		: `${trimmedSectionContent}\n\n${listItem}${trailingBreak}`;
}

function insertNewHeadingSection(content: string, insertAt: number, headingText: string, listItem: string): string {
	const prefix = getBlockPrefix(content, insertAt);
	const suffix = getBlockSuffix(content, insertAt);
	const block = `## ${headingText}\n${listItem}\n`;

	return content.slice(0, insertAt) + prefix + block + suffix + content.slice(insertAt);
}

function findExistingHeadingSection(
	content: string,
	headings: MarkdownHeading[],
	headingText: string,
): SectionRange | null {
	for (const [index, heading] of headings.entries()) {
		if (heading.level !== 2 || heading.text !== headingText) {
			continue;
		}

		return {
			contentStart: heading.end,
			end: findSectionEnd(content, headings, index, 2),
		};
	}

	return null;
}

function getInsertionIndexWithinFirstH1(
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

function findSectionEnd(content: string, headings: MarkdownHeading[], currentHeadingIndex: number, maxLevel: number): number {
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

	HEADING_LINE_PATTERN.lastIndex = 0;
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

function normalizeRequiredHeadingText(value: string): string {
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : DEFAULT_SECTION_HEADING;
}

function normalizeWikilinkAlias(value: string): string {
	return value
		.replace(/\r?\n/g, ' ')
		.replace(/\|/g, '/')
		.trim();
}

function extractWikilinkTarget(value: string): string | null {
	let normalized = value.trim();
	const aliasIndex = normalized.indexOf('|');
	if (aliasIndex >= 0) {
		normalized = normalized.slice(0, aliasIndex).trim();
	}

	const subpathIndex = normalized.search(/[#^]/);
	if (subpathIndex >= 0) {
		normalized = normalized.slice(0, subpathIndex).trim();
	}

	return normalized || null;
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

function endsWithListItem(content: string): boolean {
	const lastLineStart = content.lastIndexOf('\n') + 1;
	const lastLine = content.slice(lastLineStart).replace(/\r$/, '');
	return /^[ \t]*[-*+][ \t]+/.test(lastLine);
}

function getLineEndIndex(content: string, index: number): number {
	const nextLineBreak = content.indexOf('\n', index);
	return nextLineBreak >= 0 ? nextLineBreak : content.length;
}

function normalizeComparableLinkpath(value: string): string {
	return stripMarkdownExtension(value.replace(/\\/g, '/').replace(/^\/+/, '').trim());
}

function stripMarkdownExtension(value: string): string {
	return value.replace(/\.md$/i, '');
}

function getBasenameWithoutMarkdownExtension(path: string): string {
	const normalizedPath = stripMarkdownExtension(path.replace(/\\/g, '/'));
	const lastSlashIndex = normalizedPath.lastIndexOf('/');
	return lastSlashIndex >= 0 ? normalizedPath.slice(lastSlashIndex + 1) : normalizedPath;
}
