export type SourcePropertyMap = Record<string, unknown>;

const PROPERTY_COMMENT_PREFIX = '<!-- obpm-property:';
const PROPERTY_COMMENT_SUFFIX = ' -->';
const SKIPPED_PROPERTY_KEYS = new Set(['position']);
const UNQUOTED_PROPERTY_KEY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function appendSourcePropertyComment(
	line: string,
	properties: SourcePropertyMap | null | undefined,
): string {
	const comment = buildSourcePropertyComment(properties);
	return comment ? `${line} ${comment}` : line;
}

export function buildSourcePropertyComment(
	properties: SourcePropertyMap | null | undefined,
): string | null {
	const serializedProperties = serializeObjectEntries(properties, true);
	return serializedProperties.length > 0
		? `${PROPERTY_COMMENT_PREFIX}{${serializedProperties}}${PROPERTY_COMMENT_SUFFIX}`
		: null;
}

function formatPropertyKey(key: string): string {
	return UNQUOTED_PROPERTY_KEY_PATTERN.test(key) ? key : serializeString(key);
}

function serializeObjectEntries(
	value: SourcePropertyMap | null | undefined,
	isTopLevel: boolean,
): string {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return '';
	}

	const entries: string[] = [];
	for (const [key, entry] of Object.entries(value)) {
		if (isTopLevel && SKIPPED_PROPERTY_KEYS.has(key)) {
			continue;
		}

		const serializedValue = serializePropertyValue(entry);
		if (serializedValue === null) {
			continue;
		}

		entries.push(`${formatPropertyKey(key)}:${serializedValue}`);
	}

	return entries.join(',');
}

function serializePropertyValue(value: unknown): string | null {
	if (typeof value === 'string') {
		return serializeString(value);
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : serializeString(String(value));
	}

	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}

	if (value === null) {
		return 'null';
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : serializeString(value.toISOString());
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => serializePropertyValue(entry) ?? 'null').join(',')}]`;
	}

	if (typeof value === 'object') {
		return `{${serializeObjectEntries(value as SourcePropertyMap, false)}}`;
	}

	return null;
}

function serializeString(value: string): string {
	return JSON.stringify(value)
		.replace(/--/g, '\\u002d\\u002d')
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e');
}
