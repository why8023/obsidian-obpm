import {
	CurrentFileCommandSettings,
	FrontmatterMatchMode,
	FrontmatterMatchRule,
	ProjectRoutingSettings,
} from './types';

export const DEFAULT_PROJECT_ROUTING_PROJECT_RULE: FrontmatterMatchRule = {
	key: 'obpm_type',
	matchMode: 'key-value-equals',
	value: 'project',
};

export const DEFAULT_PROJECT_ROUTING_PROJECT_FILE_RULES: readonly FrontmatterMatchRule[] = [
	DEFAULT_PROJECT_ROUTING_PROJECT_RULE,
	{
		key: 'type',
		matchMode: 'key-value-equals',
		value: 'project',
	},
	{
		key: 'project_id',
		matchMode: 'key-exists',
	},
];

export const DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE: FrontmatterMatchRule = {
	key: 'obar_session_id',
	matchMode: 'key-exists',
};

export const DEFAULT_PROJECT_ROUTING_CURRENT_FILE_COMMAND_RULE: FrontmatterMatchRule = {
	key: 'obar_session_id',
	matchMode: 'key-exists',
};

export const DEFAULT_PROJECT_ROUTING_SETTINGS: ProjectRoutingSettings = {
	currentFileCommand: {
		limitToMatchingFiles: false,
		matchRules: [cloneMatchRule(DEFAULT_PROJECT_ROUTING_CURRENT_FILE_COMMAND_RULE)],
	},
	detectDuplicateProjectFiles: true,
	enabled: false,
	projectFileRules: cloneMatchRules(DEFAULT_PROJECT_ROUTING_PROJECT_FILE_RULES),
	projectSubfolderPath: 'raw',
	recognizeFilenameMatchesFolderAsProject: true,
	routableFileRules: [cloneMatchRule(DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE)],
	autoMoveWhenSingleCandidate: true,
	showStatusBar: true,
	showNoticeAfterMove: true,
	debugLog: false,
};

interface LegacyProjectRoutingSettings extends Partial<ProjectRoutingSettings> {
	projectRule?: Partial<FrontmatterMatchRule> | null;
}

export function createDefaultProjectFileRule(): FrontmatterMatchRule {
	return cloneMatchRule(DEFAULT_PROJECT_ROUTING_PROJECT_FILE_RULES[0]!);
}

export function createDefaultRoutableFileRule(): FrontmatterMatchRule {
	return cloneMatchRule(DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE);
}

export function createDefaultCurrentFileCommandRule(): FrontmatterMatchRule {
	return cloneMatchRule(DEFAULT_PROJECT_ROUTING_CURRENT_FILE_COMMAND_RULE);
}

export function normalizeProjectRoutingSettings(
	settings: LegacyProjectRoutingSettings | null | undefined,
): ProjectRoutingSettings {
	return {
		currentFileCommand: normalizeCurrentFileCommandSettings(settings?.currentFileCommand),
		detectDuplicateProjectFiles: normalizeBoolean(
			settings?.detectDuplicateProjectFiles,
			DEFAULT_PROJECT_ROUTING_SETTINGS.detectDuplicateProjectFiles,
		),
		enabled: normalizeBoolean(settings?.enabled, DEFAULT_PROJECT_ROUTING_SETTINGS.enabled),
		projectFileRules: normalizeProjectFileRules(settings),
		projectSubfolderPath: normalizeProjectSubfolderPath(
			settings?.projectSubfolderPath,
			DEFAULT_PROJECT_ROUTING_SETTINGS.projectSubfolderPath,
		),
		recognizeFilenameMatchesFolderAsProject: normalizeBoolean(
			settings?.recognizeFilenameMatchesFolderAsProject,
			DEFAULT_PROJECT_ROUTING_SETTINGS.recognizeFilenameMatchesFolderAsProject,
		),
		routableFileRules: normalizeOptionalMatchRules(
			settings?.routableFileRules,
			[DEFAULT_PROJECT_ROUTING_ROUTABLE_FILE_RULE],
		),
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

export function normalizeProjectSubfolderPath(value: unknown, fallback = 'raw'): string {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalizedSegments = value
		.split(/[\\/]+/)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
	return normalizedSegments.join('/');
}

function normalizeCurrentFileCommandSettings(
	settings: Partial<CurrentFileCommandSettings> | null | undefined,
): CurrentFileCommandSettings {
	return {
		limitToMatchingFiles: normalizeBoolean(
			settings?.limitToMatchingFiles,
			DEFAULT_PROJECT_ROUTING_SETTINGS.currentFileCommand.limitToMatchingFiles,
		),
		matchRules: normalizeOptionalMatchRules(
			settings?.matchRules,
			[DEFAULT_PROJECT_ROUTING_CURRENT_FILE_COMMAND_RULE],
		),
	};
}

function normalizeProjectFileRules(settings: LegacyProjectRoutingSettings | null | undefined): FrontmatterMatchRule[] {
	if (Array.isArray(settings?.projectFileRules)) {
		return normalizeOptionalMatchRules(
			settings.projectFileRules,
			DEFAULT_PROJECT_ROUTING_PROJECT_FILE_RULES,
		);
	}

	if (settings?.projectRule) {
		const legacyRule = normalizeRequiredMatchRule(settings.projectRule, DEFAULT_PROJECT_ROUTING_PROJECT_RULE);
		if (matchRulesEqual(legacyRule, DEFAULT_PROJECT_ROUTING_PROJECT_RULE)) {
			return cloneMatchRules(DEFAULT_PROJECT_ROUTING_PROJECT_FILE_RULES);
		}

		return [legacyRule];
	}

	return cloneMatchRules(DEFAULT_PROJECT_ROUTING_PROJECT_FILE_RULES);
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

function normalizeOptionalMatchRules(value: unknown, fallbackRules: readonly FrontmatterMatchRule[]): FrontmatterMatchRule[] {
	if (!Array.isArray(value)) {
		return cloneMatchRules(fallbackRules);
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

	const matchMode = normalizeFrontmatterMatchMode(value.matchMode);
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

function cloneMatchRules(rules: readonly FrontmatterMatchRule[]): FrontmatterMatchRule[] {
	return rules.map((rule) => cloneMatchRule(rule));
}

function matchRulesEqual(left: FrontmatterMatchRule, right: FrontmatterMatchRule): boolean {
	if (left.key !== right.key || left.matchMode !== right.matchMode) {
		return false;
	}

	if (left.matchMode === 'key-exists' || right.matchMode === 'key-exists') {
		return true;
	}

	return left.value === right.value;
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
