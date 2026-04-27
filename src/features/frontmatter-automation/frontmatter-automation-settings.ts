import {
	FrontmatterAutomationActionType,
	FrontmatterAutomationRule,
	FrontmatterAutomationSettings,
	FrontmatterAutomationTriggerOperator,
	FrontmatterAutomationWriteMode,
} from './frontmatter-automation-types';
import {normalizeProjectSubfolderPath} from '../project-routing/settings';

export const DEFAULT_FRONTMATTER_AUTOMATION_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

const DEFAULT_FRONTMATTER_AUTOMATION_RULE_ID = 'obpm-status-done-set-end-time';

export function createDefaultFrontmatterAutomationRule(
	overrides: Partial<FrontmatterAutomationRule> = {},
): FrontmatterAutomationRule {
	return {
		id: DEFAULT_FRONTMATTER_AUTOMATION_RULE_ID,
		enabled: true,
		triggerField: 'obpm_status',
		triggerOperator: 'contains',
		triggerValue: 'done',
		actionType: 'set_current_time',
		targetField: 'obpm_end_time',
		staticValue: '',
		targetSubfolderPath: '',
		writeMode: 'always',
		...overrides,
	};
}

export const DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS: FrontmatterAutomationSettings = {
	enableFrontmatterAutomation: false,
	timeFormat: DEFAULT_FRONTMATTER_AUTOMATION_TIME_FORMAT,
	rules: [createDefaultFrontmatterAutomationRule()],
};

interface LegacyDoneProjectMoveSettings {
	enabled?: unknown;
	targetSubfolderPath?: unknown;
}

interface LegacyFrontmatterAutomationSettings extends Partial<FrontmatterAutomationSettings> {
	doneProjectMove?: LegacyDoneProjectMoveSettings | null;
}

export function normalizeFrontmatterAutomationSettings(
	settings: LegacyFrontmatterAutomationSettings | null | undefined,
): FrontmatterAutomationSettings {
	return {
		enableFrontmatterAutomation: normalizeBoolean(
			settings?.enableFrontmatterAutomation,
			DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS.enableFrontmatterAutomation,
		),
		timeFormat: normalizeRequiredText(
			settings?.timeFormat,
			DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS.timeFormat,
		),
		rules: normalizeRulesWithLegacyProjectMove(settings),
	};
}

function normalizeActionType(
	value: unknown,
	fallback: FrontmatterAutomationActionType,
): FrontmatterAutomationActionType {
	return value === 'set_current_time' || value === 'set_static_value' || value === 'ensure_project_folder'
		? value
		: fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeRequiredText(value: unknown, fallback: string): string {
	const normalized = normalizeText(value, fallback);
	return normalized.length > 0 ? normalized : fallback;
}

function normalizeRule(
	value: unknown,
	index: number,
): FrontmatterAutomationRule {
	const fallbackRule = createDefaultFrontmatterAutomationRule({
		id: `frontmatter-automation-rule-${index + 1}`,
	});
	const rule = isRecord(value) ? value : {};

	return {
		id: normalizeRequiredText(rule.id, fallbackRule.id),
		enabled: normalizeBoolean(rule.enabled, fallbackRule.enabled),
		triggerField: normalizeText(rule.triggerField, fallbackRule.triggerField),
		triggerOperator: normalizeTriggerOperator(
			shouldMigrateLegacyDefaultRule(rule) ? 'contains' : rule.triggerOperator,
			fallbackRule.triggerOperator,
		),
		triggerValue: normalizeText(rule.triggerValue, fallbackRule.triggerValue),
		actionType: normalizeActionType(rule.actionType, fallbackRule.actionType),
		targetField: normalizeText(rule.targetField, fallbackRule.targetField),
		staticValue: normalizeText(rule.staticValue, fallbackRule.staticValue ?? ''),
		targetSubfolderPath: normalizeProjectSubfolderPath(
			rule.targetSubfolderPath,
			fallbackRule.targetSubfolderPath ?? '',
		),
		writeMode: normalizeWriteMode(rule.writeMode, fallbackRule.writeMode),
	};
}

function normalizeRules(value: unknown): FrontmatterAutomationRule[] {
	if (!Array.isArray(value)) {
		return DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS.rules.map((rule) => createDefaultFrontmatterAutomationRule(rule));
	}

	return value.map((rule, index) => normalizeRule(rule, index));
}

function normalizeRulesWithLegacyProjectMove(
	settings: LegacyFrontmatterAutomationSettings | null | undefined,
): FrontmatterAutomationRule[] {
	const rules = normalizeRules(settings?.rules);
	if (!settings?.doneProjectMove || !normalizeBoolean(settings.doneProjectMove.enabled, false)) {
		return rules;
	}

	const legacyRule = createDefaultFrontmatterAutomationRule({
		id: 'obpm-status-done-ensure-project-folder',
		actionType: 'ensure_project_folder',
		targetField: '',
		targetSubfolderPath: normalizeProjectSubfolderPath(settings.doneProjectMove.targetSubfolderPath, ''),
	});
	if (rules.some((rule) => rule.id === legacyRule.id)) {
		return rules;
	}

	return [...rules, legacyRule];
}

function normalizeText(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeTriggerOperator(
	value: unknown,
	fallback: FrontmatterAutomationTriggerOperator,
): FrontmatterAutomationTriggerOperator {
	return value === 'equals' || value === 'contains' ? value : fallback;
}

function normalizeWriteMode(
	value: unknown,
	fallback: FrontmatterAutomationWriteMode,
): FrontmatterAutomationWriteMode {
	return value === 'always' || value === 'when-empty' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function shouldMigrateLegacyDefaultRule(rule: Record<string, unknown>): boolean {
	return rule.id === DEFAULT_FRONTMATTER_AUTOMATION_RULE_ID
		&& rule.triggerOperator === 'equals'
		&& rule.triggerField === 'obpm_status'
		&& rule.triggerValue === 'done'
		&& rule.actionType === 'set_current_time'
		&& rule.targetField === 'obpm_end_time';
}
