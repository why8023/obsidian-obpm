export type FrontmatterAutomationTriggerOperator = 'equals' | 'contains';
export type FrontmatterAutomationActionType = 'set_current_time' | 'set_static_value';
export type FrontmatterAutomationWriteMode = 'always' | 'when-empty';

export interface FrontmatterAutomationRule {
	id: string;
	enabled: boolean;
	triggerField: string;
	triggerOperator: FrontmatterAutomationTriggerOperator;
	triggerValue: string;
	actionType: FrontmatterAutomationActionType;
	targetField: string;
	staticValue?: string;
	writeMode: FrontmatterAutomationWriteMode;
}

export interface FrontmatterAutomationSettings {
	enableFrontmatterAutomation: boolean;
	timeFormat: string;
	rules: FrontmatterAutomationRule[];
}

export type FrontmatterSnapshot = Record<string, unknown>;

export interface FrontmatterAutomationAction {
	nextValue: string;
	ruleId: string;
	targetField: string;
}

export interface FrontmatterAutomationEvaluationResult {
	actions: FrontmatterAutomationAction[];
	nextSnapshot: FrontmatterSnapshot;
}
