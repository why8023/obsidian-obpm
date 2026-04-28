import type {CachedMetadata} from 'obsidian';
import {matchesAnyFrontmatterRule} from '../project-routing/matcher';
import type {FrontmatterMatchRule} from '../project-routing/types';

export type PinnedProjectRuleDecision = 'defer' | 'process' | 'skip';

export interface PinnedProjectRuleFilter {
	excludeRules: readonly FrontmatterMatchRule[];
	includeRules: readonly FrontmatterMatchRule[];
}

export function getPinnedProjectRuleDecision(
	cache: CachedMetadata | null,
	filter: PinnedProjectRuleFilter,
): PinnedProjectRuleDecision {
	const hasRules = filter.includeRules.length > 0 || filter.excludeRules.length > 0;
	if (cache === null && hasRules) {
		return 'defer';
	}

	const frontmatter = cache?.frontmatter;
	if (filter.excludeRules.length > 0 && matchesAnyFrontmatterRule(frontmatter, filter.excludeRules)) {
		return 'skip';
	}

	if (filter.includeRules.length > 0 && !matchesAnyFrontmatterRule(frontmatter, filter.includeRules)) {
		return 'skip';
	}

	return 'process';
}
