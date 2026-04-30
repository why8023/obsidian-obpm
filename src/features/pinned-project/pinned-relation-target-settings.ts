import {normalizeFrontmatterMatchMode} from '../project-routing/settings';
import {FrontmatterMatchMode, FrontmatterMatchRule} from '../project-routing/types';

export type PinnedRelationTargetRuleSource = 'frontmatter' | 'path';
export type PinnedRelationTargetPathMatchMode = 'path-contains' | 'path-starts-with' | 'path-glob';
export type PinnedRelationTargetMatchMode = FrontmatterMatchMode | PinnedRelationTargetPathMatchMode;

export interface PinnedRelationTargetFrontmatterRule extends FrontmatterMatchRule {
	source: 'frontmatter';
}

export interface PinnedRelationTargetPathRule {
	key?: string;
	matchMode: PinnedRelationTargetPathMatchMode;
	source: 'path';
	value: string;
}

export type PinnedRelationTargetRule = PinnedRelationTargetFrontmatterRule | PinnedRelationTargetPathRule;

export interface PinnedRelationTargetSettings {
	enabled: boolean;
	excludeRules: PinnedRelationTargetRule[];
	includeRules: PinnedRelationTargetRule[];
	targetPath: string;
}

export interface PinnedRelationTargetSettingsInput {
	pinnedProject?: unknown;
	pinnedRelationTarget?: unknown;
}

export const DEFAULT_PINNED_RELATION_TARGET_SETTINGS: PinnedRelationTargetSettings = {
	enabled: false,
	excludeRules: [],
	includeRules: [],
	targetPath: '',
};

export function createDefaultPinnedRelationTargetRule(): PinnedRelationTargetRule {
	return {
		key: 'obpm_type',
		matchMode: 'key-exists',
		source: 'frontmatter',
	};
}

export function normalizePinnedRelationTargetSettings(
	settings: PinnedRelationTargetSettingsInput | null | undefined,
): PinnedRelationTargetSettings {
	const currentSettings = isObjectRecord(settings?.pinnedRelationTarget)
		? settings.pinnedRelationTarget
		: null;
	if (currentSettings) {
		return {
			enabled: normalizeBoolean(currentSettings.enabled, DEFAULT_PINNED_RELATION_TARGET_SETTINGS.enabled),
			excludeRules: normalizePinnedRelationTargetRules(currentSettings.excludeRules),
			includeRules: normalizePinnedRelationTargetRules(currentSettings.includeRules),
			targetPath: normalizeText(currentSettings.targetPath, DEFAULT_PINNED_RELATION_TARGET_SETTINGS.targetPath),
		};
	}

	const legacySettings = isObjectRecord(settings?.pinnedProject)
		? settings.pinnedProject
		: null;
	if (legacySettings) {
		return {
			enabled: normalizeBoolean(legacySettings.enabled, DEFAULT_PINNED_RELATION_TARGET_SETTINGS.enabled),
			excludeRules: normalizePinnedRelationTargetRules(legacySettings.excludeRules),
			includeRules: normalizePinnedRelationTargetRules(legacySettings.includeRules),
			targetPath: normalizeText(legacySettings.projectPath, DEFAULT_PINNED_RELATION_TARGET_SETTINGS.targetPath),
		};
	}

	return {
		...DEFAULT_PINNED_RELATION_TARGET_SETTINGS,
		excludeRules: [...DEFAULT_PINNED_RELATION_TARGET_SETTINGS.excludeRules],
		includeRules: [...DEFAULT_PINNED_RELATION_TARGET_SETTINGS.includeRules],
	};
}

export function normalizePinnedRelationTargetPathMatchMode(
	value: unknown,
	fallback: PinnedRelationTargetPathMatchMode = 'path-contains',
): PinnedRelationTargetPathMatchMode {
	return isPinnedRelationTargetPathMatchMode(value) ? value : fallback;
}

export function isPinnedRelationTargetPathMatchMode(value: unknown): value is PinnedRelationTargetPathMatchMode {
	return value === 'path-contains' || value === 'path-starts-with' || value === 'path-glob';
}

function normalizePinnedRelationTargetRules(value: unknown): PinnedRelationTargetRule[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((rule) => normalizePinnedRelationTargetRule(rule))
		.filter((rule): rule is PinnedRelationTargetRule => rule !== null);
}

function normalizePinnedRelationTargetRule(value: unknown): PinnedRelationTargetRule | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	if (value.source === 'path' || isPinnedRelationTargetPathMatchMode(value.matchMode)) {
		return normalizePinnedRelationTargetPathRule(value);
	}

	return normalizePinnedRelationTargetFrontmatterRule(value);
}

function normalizePinnedRelationTargetFrontmatterRule(value: Record<string, unknown>): PinnedRelationTargetRule | null {
	const key = normalizeText(value.key, '');
	if (!key) {
		return null;
	}

	const matchMode = normalizeFrontmatterMatchMode(value.matchMode);
	if (matchMode === 'key-value-equals') {
		return {
			key,
			matchMode,
			source: 'frontmatter',
			value: normalizeText(value.value, ''),
		};
	}

	return {
		key,
		matchMode,
		source: 'frontmatter',
	};
}

function normalizePinnedRelationTargetPathRule(value: Record<string, unknown>): PinnedRelationTargetRule | null {
	const pathPattern = normalizePathPattern(value.value ?? value.key);
	if (!pathPattern) {
		return null;
	}

	return {
		matchMode: normalizePinnedRelationTargetPathMatchMode(value.matchMode),
		source: 'path',
		value: pathPattern,
	};
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeText(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value.trim() : fallback;
}

function normalizePathPattern(value: unknown): string {
	return typeof value === 'string'
		? value.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+/, '')
		: '';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
