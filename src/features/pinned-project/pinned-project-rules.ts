import type {CachedMetadata} from 'obsidian';
import {matchesAnyFrontmatterRule} from '../project-routing/matcher';
import type {FrontmatterMatchRule} from '../project-routing/types';
import type {
	PinnedRelationTargetPathRule,
	PinnedRelationTargetRule,
} from './pinned-relation-target-settings';

export type PinnedProjectRuleDecision = 'defer' | 'process' | 'skip';

export interface PinnedProjectRuleFilter {
	excludeRules: readonly PinnedRelationTargetRule[];
	filePath?: string;
	includeRules: readonly PinnedRelationTargetRule[];
}

export function getPinnedProjectRuleDecision(
	cache: CachedMetadata | null,
	filter: PinnedProjectRuleFilter,
): PinnedProjectRuleDecision {
	const filePath = normalizeVaultPath(filter.filePath ?? '');
	const excludeFrontmatterRules = filter.excludeRules.filter(isFrontmatterRule);
	const includeFrontmatterRules = filter.includeRules.filter(isFrontmatterRule);

	if (matchesAnyPathRule(filePath, filter.excludeRules)) {
		return 'skip';
	}

	if (cache === null && excludeFrontmatterRules.length > 0) {
		return 'defer';
	}

	const frontmatter = cache?.frontmatter;
	if (excludeFrontmatterRules.length > 0 && matchesAnyFrontmatterRule(frontmatter, excludeFrontmatterRules)) {
		return 'skip';
	}

	if (filter.includeRules.length === 0) {
		return 'process';
	}

	if (matchesAnyPathRule(filePath, filter.includeRules)) {
		return 'process';
	}

	if (cache === null && includeFrontmatterRules.length > 0) {
		return 'defer';
	}

	if (includeFrontmatterRules.length > 0 && matchesAnyFrontmatterRule(frontmatter, includeFrontmatterRules)) {
		return 'process';
	}

	if (filter.includeRules.length > 0) {
		return 'skip';
	}

	return 'process';
}

function matchesAnyPathRule(filePath: string, rules: readonly PinnedRelationTargetRule[]): boolean {
	if (!filePath) {
		return false;
	}

	return rules.some((rule) => rule.source === 'path' && matchesPathRule(filePath, rule));
}

function matchesPathRule(filePath: string, rule: PinnedRelationTargetPathRule): boolean {
	const pattern = normalizeVaultPath(rule.value);
	if (!pattern) {
		return false;
	}

	switch (rule.matchMode) {
		case 'path-contains':
			return filePath.includes(pattern);
		case 'path-starts-with':
			return filePath.startsWith(pattern);
		case 'path-glob':
			return globToRegExp(pattern).test(filePath);
	}
}

function isFrontmatterRule(rule: PinnedRelationTargetRule): rule is FrontmatterMatchRule & {source: 'frontmatter'} {
	return rule.source === 'frontmatter';
}

function normalizeVaultPath(path: string): string {
	return path.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+/, '');
}

function globToRegExp(pattern: string): RegExp {
	let expression = '^';
	for (let index = 0; index < pattern.length; index += 1) {
		const character = pattern[index];
		const nextCharacter = pattern[index + 1];
		if (character === '*' && nextCharacter === '*') {
			expression += '.*';
			index += 1;
			continue;
		}

		if (character === '*') {
			expression += '[^/]*';
			continue;
		}

		if (character === '?') {
			expression += '[^/]';
			continue;
		}

		expression += escapeRegExp(character ?? '');
	}

	return new RegExp(`${expression}$`);
}

function escapeRegExp(value: string): string {
	return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}
