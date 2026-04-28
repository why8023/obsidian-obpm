export interface RelationAppendResult {
	changed: boolean;
	value: unknown;
}

export function appendUniqueRelationLinkValue(
	currentValue: unknown,
	projectLinkValue: string,
	projectPath: string,
): RelationAppendResult {
	if (relationValueContainsProjectLink(currentValue, projectPath)) {
		return {
			changed: false,
			value: currentValue,
		};
	}

	const nextItems = getRelationValueItems(currentValue);
	return {
		changed: true,
		value: [...nextItems, projectLinkValue],
	};
}

export function buildProjectWikilinkValue(projectPath: string): string {
	const linkpath = stripMarkdownExtension(projectPath.replace(/\\/g, '/').replace(/^\/+/, ''));
	return `[[${linkpath}]]`;
}

function getRelationValueItems(value: unknown): unknown[] {
	if (value === undefined || value === null) {
		return [];
	}

	if (typeof value === 'string' && value.trim().length === 0) {
		return [];
	}

	if (!Array.isArray(value)) {
		return [value];
	}

	const entries: unknown[] = [];
	for (const entry of value) {
		entries.push(entry as unknown);
	}

	return entries;
}

function relationValueContainsProjectLink(value: unknown, projectPath: string): boolean {
	const projectTarget = normalizeComparableLinkpath(projectPath);
	const projectBasename = getBasenameWithoutMarkdownExtension(projectPath);
	const values = Array.isArray(value) ? value : [value];

	return values.some((entry) => {
		if (typeof entry !== 'string') {
			return false;
		}

		const linkpath = extractRelationLinkpath(entry);
		if (!linkpath) {
			return false;
		}

		const normalizedLinkpath = normalizeComparableLinkpath(linkpath);
		return normalizedLinkpath === projectTarget || normalizedLinkpath === projectBasename;
	});
}

function extractRelationLinkpath(value: string): string | null {
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

	const subpathIndex = normalized.search(/[#^]/);
	if (subpathIndex >= 0) {
		normalized = normalized.slice(0, subpathIndex).trim();
	}

	return normalized || null;
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
