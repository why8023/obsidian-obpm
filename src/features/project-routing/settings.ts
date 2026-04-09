import {FrontmatterMatchMode, FrontmatterMatchRule, ProjectRoutingSettings} from './types';

export const DEFAULT_PROJECT_ROUTING_PROJECT_RULE: FrontmatterMatchRule = {
	key: 'type',
	matchMode: 'key-value-equals',
	value: 'project',
};

export const DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE: FrontmatterMatchRule = {
	key: 'obar_session',
	matchMode: 'key-exists',
};

export const DEFAULT_PROJECT_ROUTING_SETTINGS: ProjectRoutingSettings = {
	enabled: false,
	projectRule: cloneMatchRule(DEFAULT_PROJECT_ROUTING_PROJECT_RULE),
	routableFileRules: [cloneMatchRule(DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE)],
	autoMoveWhenSingleCandidate: true,
	showStatusBar: true,
	showNoticeAfterMove: true,
	debugLog: false,
};

export function createDefaultRoutableFileRule(): FrontmatterMatchRule {
	return cloneMatchRule(DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE);
}

export function normalizeProjectRoutingSettings(
	settings: Partial<ProjectRoutingSettings> | null | undefined,
): ProjectRoutingSettings {
	return {
		enabled: normalizeBoolean(settings?.enabled, DEFAULT_PROJECT_ROUTING_SETTINGS.enabled),
		projectRule: normalizeRequiredMatchRule(settings?.projectRule, DEFAULT_PROJECT_ROUTING_PROJECT_RULE),
		routableFileRules: normalizeOptionalMatchRules(settings?.routableFileRules),
		autoMoveWhenSingleCandidate: normalizeBoolean(
			settings?.autoMoveWhenSingleCandidate,
			DEFAULT_PROJECT_ROUTING_SETTINGS.autoMoveWhenSingleCandidate,
		),
		showStatusBar: normalizeBoolean(settings?.showStatusBar, DEFAULT_PROJECT_ROUTING_SETTINGS.showStatusBar),
		showNoticeAfterMove: normalizeBoolean(
			settings?.showNoticeAfterMove,
			DEFAULT_PROJECT_ROUTING_SETTINGS.showNoticeAfterMove,
		),
		debugLog: normalizeBoolean(settings?.debugLog, DEFAULT_PROJECT_ROUTING_SETTINGS.debugLog),
	};
}

export function normalizeFrontmatterMatchMode(
	value: unknown,
	fallback: FrontmatterMatchMode = 'key-exists',
): FrontmatterMatchMode {
	return value === 'key-value-equals' || value === 'key-exists' ? value : fallback;
}

function normalizeRequiredMatchRule(
	value: Partial<FrontmatterMatchRule> | null | undefined,
	fallback: FrontmatterMatchRule,
): FrontmatterMatchRule {
	const matchMode = normalizeFrontmatterMatchMode(value?.matchMode, fallback.matchMode);
	const key = normalizeRequiredText(value?.key, fallback.key);
	if (matchMode === 'key-value-equals') {
		return {
			key,
			matchMode,
			value: normalizeRequiredText(value?.value, fallback.value ?? ''),
		};
	}

	return {
		key,
		matchMode,
	};
}

function normalizeOptionalMatchRules(value: unknown): FrontmatterMatchRule[] {
	if (!Array.isArray(value)) {
		return [cloneMatchRule(DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE)];
	}

	const normalizedRules = value
		.map((rule) => normalizeOptionalMatchRule(rule))
		.filter((rule): rule is FrontmatterMatchRule => rule !== null);

	return normalizedRules;
}

function normalizeOptionalMatchRule(value: unknown): FrontmatterMatchRule | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const key = normalizeText(value.key);
	if (!key) {
		return null;
	}

	const matchMode = normalizeFrontmatterMatchMode(value.matchMode, DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE.matchMode);
	if (matchMode === 'key-value-equals') {
		return {
			key,
			matchMode,
			value: normalizeText(value.value),
		};
	}

	return {
		key,
		matchMode,
	};
}

function cloneMatchRule(rule: FrontmatterMatchRule): FrontmatterMatchRule {
	return rule.matchMode === 'key-value-equals'
		? {
			key: rule.key,
			matchMode: rule.matchMode,
			value: rule.value ?? '',
		}
		: {
			key: rule.key,
			matchMode: rule.matchMode,
		};
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeRequiredText(value: unknown, fallback: string): string {
	const normalizedValue = normalizeText(value);
	return normalizedValue.length > 0 ? normalizedValue : fallback;
}

function normalizeText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
