import {normalizeFrontmatterMatchMode} from '../project-routing/settings';
import {FrontmatterMatchRule} from '../project-routing/types';

export interface PinnedRelationTargetSettings {
	enabled: boolean;
	excludeRules: FrontmatterMatchRule[];
	includeRules: FrontmatterMatchRule[];
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

export function createDefaultPinnedRelationTargetRule(): FrontmatterMatchRule {
	return {
		key: 'obpm_type',
		matchMode: 'key-exists',
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

function normalizePinnedRelationTargetRules(value: unknown): FrontmatterMatchRule[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((rule) => normalizePinnedRelationTargetRule(rule))
		.filter((rule): rule is FrontmatterMatchRule => rule !== null);
}

function normalizePinnedRelationTargetRule(value: unknown): FrontmatterMatchRule | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const key = normalizeText(value.key, '');
	if (!key) {
		return null;
	}

	const matchMode = normalizeFrontmatterMatchMode(value.matchMode);
	if (matchMode === 'key-value-equals') {
		return {
			key,
			matchMode,
			value: normalizeText(value.value, ''),
		};
	}

	return {
		key,
		matchMode,
	};
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeText(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value.trim() : fallback;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
