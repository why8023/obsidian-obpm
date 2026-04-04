import {normalizePath, TFile} from 'obsidian';

export const MANAGED_LINK_TITLE = 'obpm:related-link:v1';

export interface ManagedInlineLink {
	destination: string;
	displayText: string;
	end: number;
	fullMatch: string;
	start: number;
	title: string;
}

const INLINE_LINK_PATTERN = /\[((?:[^\]\\\r\n]|\\.)*)\]\(([^)\r\n]*)\)/g;

export function buildManagedMarkdownLink(displayText: string, destination: string): string {
	return `[${escapeMarkdownText(displayText)}](${encodeMarkdownDestination(destination)} "${MANAGED_LINK_TITLE}")`;
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

export function extractManagedInlineLinks(content: string): ManagedInlineLink[] {
	const matches: ManagedInlineLink[] = [];
	let match: RegExpExecArray | null;

	while ((match = INLINE_LINK_PATTERN.exec(content)) !== null) {
		const [fullMatch, rawDisplayText, rawBody] = match;
		if (rawDisplayText === undefined || rawBody === undefined) {
			continue;
		}

		if (match.index > 0 && content[match.index - 1] === '!') {
			continue;
		}

		const parsedBody = parseInlineLinkBody(rawBody);
		if (!parsedBody || parsedBody.title !== MANAGED_LINK_TITLE) {
			continue;
		}

		matches.push({
			destination: parsedBody.destination,
			displayText: unescapeMarkdownLinkText(rawDisplayText),
			end: match.index + fullMatch.length,
			fullMatch,
			start: match.index,
			title: parsedBody.title,
		});
	}

	return matches;
}

export function hasManagedInlineLinks(content: string): boolean {
	return extractManagedInlineLinks(content).length > 0;
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

export function resolveMarkdownDestinationCandidates(destination: string, targetFile: TFile): string[] {
	const linkpath = extractMarkdownLinkpath(destination);
	if (!linkpath || isLikelyExternalDestination(linkpath)) {
		return [];
	}

	const candidates: string[] = [];
	const seenCandidates = new Set<string>();
	const normalizedLinkpath = linkpath.replace(/\\/g, '/').trim();
	const targetDirectory = getParentDirectory(targetFile.path);

	const addCandidate = (candidate: string) => {
		const normalizedCandidate = normalizePath(candidate);
		if (!normalizedCandidate || seenCandidates.has(normalizedCandidate)) {
			return;
		}

		seenCandidates.add(normalizedCandidate);
		candidates.push(normalizedCandidate);

		if (!/\.[^./]+$/.test(normalizedCandidate)) {
			const markdownCandidate = normalizePath(`${normalizedCandidate}.md`);
			if (seenCandidates.has(markdownCandidate)) {
				return;
			}

			seenCandidates.add(markdownCandidate);
			candidates.push(markdownCandidate);
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

export function isLikelyExternalDestination(destination: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(destination);
}

function parseInlineLinkBody(value: string): {destination: string; title: string | null} | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	let destination = trimmed;
	let remainder = '';

	if (trimmed.startsWith('<')) {
		const closingBracketIndex = trimmed.indexOf('>');
		if (closingBracketIndex <= 0) {
			return null;
		}

		destination = trimmed.slice(0, closingBracketIndex + 1);
		remainder = trimmed.slice(closingBracketIndex + 1).trim();
	} else {
		const whitespaceMatch = /\s/.exec(trimmed);
		if (whitespaceMatch) {
			const whitespaceIndex = whitespaceMatch.index;
			destination = trimmed.slice(0, whitespaceIndex);
			remainder = trimmed.slice(whitespaceIndex).trim();
		}
	}

	if (!destination) {
		return null;
	}

	return {
		destination,
		title: parseInlineLinkTitle(remainder),
	};
}

function parseInlineLinkTitle(value: string): string | null {
	if (!value) {
		return null;
	}

	const openingDelimiter = value[0];
	const closingDelimiter = openingDelimiter === '(' ? ')' : openingDelimiter;
	if (!closingDelimiter || (openingDelimiter !== '"' && openingDelimiter !== '\'' && openingDelimiter !== '(')) {
		return null;
	}

	if (!value.endsWith(closingDelimiter) || value.length < 2) {
		return null;
	}

	return value.slice(1, -1);
}

function unescapeMarkdownLinkText(value: string): string {
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
