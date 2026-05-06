export type FrontmatterAutomationTriggerOperator = 'equals' | 'contains';
export type FrontmatterAutomationActionType =
	| 'set_current_time'
	| 'set_static_value'
	| 'ensure_project_folder'
	| 'send_content_to_project_file';
export type FrontmatterAutomationProjectContentPlacementMode = 'target_heading' | 'source_name_heading';
export type FrontmatterAutomationWriteMode = 'always' | 'when-empty';

export interface FrontmatterAutomationRule {
	id: string;
	enabled: boolean;
	triggerField: string;
	triggerOperator: FrontmatterAutomationTriggerOperator;
	triggerValue: string;
	actionType: FrontmatterAutomationActionType;
	projectContentHeadingLevel: number;
	projectContentPlacementMode: FrontmatterAutomationProjectContentPlacementMode;
	projectContentPreserveSourceProperties: boolean;
	projectContentTargetHeading: string;
	targetField: string;
	staticValue?: string;
	targetSubfolderPath?: string;
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

export interface FrontmatterAutomationProjectMoveAction {
	ruleId: string;
	targetSubfolderPath: string;
}

export interface FrontmatterAutomationProjectContentAction {
	headingLevel: number;
	placementMode: FrontmatterAutomationProjectContentPlacementMode;
	preserveSourceProperties: boolean;
	ruleId: string;
	targetHeading: string;
}

export interface FrontmatterAutomationEvaluationResult {
	actions: FrontmatterAutomationAction[];
	nextSnapshot: FrontmatterSnapshot;
	projectContentActions: FrontmatterAutomationProjectContentAction[];
	projectMoveActions: FrontmatterAutomationProjectMoveAction[];
}
