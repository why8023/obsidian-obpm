import {FrontMatterCache} from 'obsidian';
import {FrontmatterMatchRule} from './types';

export function matchesAnyFrontmatterRule(
	frontmatter: FrontMatterCache | undefined,
	rules: readonly FrontmatterMatchRule[],
): boolean {
	return rules.some((rule) => matchesFrontmatterRule(frontmatter, rule));
}

export function matchesFrontmatterRule(
	frontmatter: FrontMatterCache | undefined,
	rule: FrontmatterMatchRule,
): boolean {
	if (!frontmatter || !hasFrontmatterKey(frontmatter, rule.key)) {
		return false;
	}

	if (rule.matchMode === 'key-exists') {
		return true;
	}

	const expectedValue = normalizeComparableValue(rule.value ?? '');
	return flattenFrontmatterValues(frontmatter[rule.key as keyof FrontMatterCache])
		.some((value) => normalizeComparableValue(value) === expectedValue);
}

function hasFrontmatterKey(frontmatter: FrontMatterCache, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(frontmatter, key);
}

function flattenFrontmatterValues(value: unknown): string[] {
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return [String(value)];
	}

	if (Array.isArray(value)) {
		return value.flatMap((entry) => flattenFrontmatterValues(entry));
	}

	return [];
}

function normalizeComparableValue(value: string): string {
	return value.trim();
}
