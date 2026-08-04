const DEFAULT_VIEW_STATE_KEY = '__default__';
const EMPTY_GROUP_KEY = '__empty__';

export function createViewContextKey(filePath: string, viewStateKey: string): string {
	return `${filePath}::${viewStateKey}`;
}

export function getGroupKey(groupHeaderText: string): string {
	const normalizedValue = normalizeWhitespace(groupHeaderText);
	return normalizedValue.length > 0 ? normalizedValue : EMPTY_GROUP_KEY;
}

/**
 * Older versions stored the visible group label (or the property name plus
 * value) instead of the native group value. Keep those states readable while
 * using the value as the canonical key going forward.
 */
export function matchesGroupKey(storedKey: string, groupKey: string): boolean {
	const normalizedStoredKey = getGroupKey(storedKey);
	const normalizedGroupKey = getGroupKey(groupKey);
	return normalizedStoredKey === normalizedGroupKey
		|| normalizedStoredKey.endsWith(` ${normalizedGroupKey}`);
}

export function getViewStateKey(currentViewName: string | null): string {
	const normalizedValue = normalizeWhitespace(currentViewName ?? '');
	return normalizedValue.length > 0 ? normalizedValue : DEFAULT_VIEW_STATE_KEY;
}

export function normalizeWhitespace(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}
