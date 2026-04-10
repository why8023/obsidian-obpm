import {FrontmatterAutomationAction, FrontmatterSnapshot} from './frontmatter-automation-types';

export function areFrontmatterSnapshotsEqual(
	left: FrontmatterSnapshot | null,
	right: FrontmatterSnapshot | null,
): boolean {
	if (left === right) {
		return true;
	}

	if (left === null || right === null) {
		return left === right;
	}

	return stableStringify(left) === stableStringify(right);
}

export function createFrontmatterSnapshot(frontmatter: Record<string, unknown> | null | undefined): FrontmatterSnapshot | null {
	if (!frontmatter || typeof frontmatter !== 'object') {
		return null;
	}

	const snapshot: FrontmatterSnapshot = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		snapshot[key] = cloneFrontmatterValue(value);
	}

	return snapshot;
}

export function createSnapshotWithAppliedActions(
	snapshot: FrontmatterSnapshot,
	actions: readonly FrontmatterAutomationAction[],
): FrontmatterSnapshot {
	const nextSnapshot = createFrontmatterSnapshot(snapshot) ?? {};
	for (const action of actions) {
		nextSnapshot[action.targetField] = action.nextValue;
	}

	return nextSnapshot;
}

export function formatFrontmatterAutomationTime(date: Date, format: string): string {
	const tokens: Record<string, string> = {
		YYYY: date.getFullYear().toString(),
		MM: padNumber(date.getMonth() + 1),
		DD: padNumber(date.getDate()),
		HH: padNumber(date.getHours()),
		mm: padNumber(date.getMinutes()),
		ss: padNumber(date.getSeconds()),
	};

	return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => tokens[token] ?? token);
}

export function isFrontmatterValueEmpty(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}

	if (typeof value === 'string') {
		return value.trim().length === 0;
	}

	if (Array.isArray(value)) {
		return value.length === 0;
	}

	return false;
}

function cloneFrontmatterValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => cloneFrontmatterValue(entry));
	}

	if (typeof value === 'object' && value !== null) {
		const clone: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			clone[key] = cloneFrontmatterValue(entry);
		}

		return clone;
	}

	return value;
}

function normalizeForStableStringify(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeForStableStringify(entry));
	}

	if (typeof value === 'object' && value !== null) {
		const normalizedEntries = Object.entries(value)
			.filter(([, entry]) => entry !== undefined)
			.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
			.map(([key, entry]) => [key, normalizeForStableStringify(entry)] as const);

		return Object.fromEntries(normalizedEntries);
	}

	return value ?? null;
}

function padNumber(value: number): string {
	return value.toString().padStart(2, '0');
}

function stableStringify(value: unknown): string {
	return JSON.stringify(normalizeForStableStringify(value));
}
