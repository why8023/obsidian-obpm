import {
	FrontmatterAutomationSettings,
	FrontmatterSnapshot,
	FrontmatterAutomationAction,
	FrontmatterAutomationEvaluationResult,
	FrontmatterAutomationProjectContentAction,
	FrontmatterAutomationProjectMoveAction,
	FrontmatterAutomationRule,
} from './frontmatter-automation-types';
import {createSnapshotWithAppliedActions, formatFrontmatterAutomationTime, isFrontmatterValueEmpty} from './frontmatter-automation-utils';

interface EvaluateFrontmatterAutomationOptions {
	currentSnapshot: FrontmatterSnapshot;
	previousSnapshot: FrontmatterSnapshot;
	settings: FrontmatterAutomationSettings;
	now?: Date;
}

export class FrontmatterAutomationService {
	applyActions(frontmatter: Record<string, unknown>, actions: readonly FrontmatterAutomationAction[]): void {
		for (const action of actions) {
			frontmatter[action.targetField] = action.nextValue;
		}
	}

	evaluate(options: EvaluateFrontmatterAutomationOptions): FrontmatterAutomationEvaluationResult {
		const {currentSnapshot, previousSnapshot, settings} = options;
		const now = options.now ?? new Date();
		const actions: FrontmatterAutomationAction[] = [];
		const nextSnapshot = createSnapshotWithAppliedActions(currentSnapshot, []);
		const projectContentActions: FrontmatterAutomationProjectContentAction[] = [];
		const projectMoveActions: FrontmatterAutomationProjectMoveAction[] = [];

		for (const rule of settings.rules) {
			if (!rule.enabled || !this.shouldTrigger(previousSnapshot, currentSnapshot, rule)) {
				continue;
			}

			if (rule.actionType === 'ensure_project_folder') {
				projectMoveActions.push({
					fileNameTime: {
						enabled: rule.projectMoveTimeEnabled,
						format: rule.projectMoveTimeFormat,
						position: rule.projectMoveTimePosition,
					},
					ruleId: rule.id,
					targetSubfolderPath: rule.targetSubfolderPath ?? '',
				});
				continue;
			}

			if (rule.actionType === 'send_content_to_project_file') {
				const targetHeading = rule.projectContentTargetHeading.trim();
				if (rule.projectContentPlacementMode === 'target_heading' && targetHeading.length === 0) {
					continue;
				}

				projectContentActions.push({
					headingLevel: rule.projectContentHeadingLevel,
					placementMode: rule.projectContentPlacementMode,
					preserveSourceProperties: rule.projectContentPreserveSourceProperties,
					ruleId: rule.id,
					targetHeading,
				});
				break;
			}

			if (rule.targetField.length === 0) {
				continue;
			}

			const nextValue = this.resolveActionValue(rule, settings, now);
			if (!this.shouldWrite(nextSnapshot[rule.targetField], nextValue, rule.writeMode)) {
				continue;
			}

			actions.push({
				nextValue,
				ruleId: rule.id,
				targetField: rule.targetField,
			});
			nextSnapshot[rule.targetField] = nextValue;
		}

		return {
			actions,
			nextSnapshot,
			projectContentActions,
			projectMoveActions,
		};
	}

	private resolveActionValue(
		rule: FrontmatterAutomationRule,
		settings: FrontmatterAutomationSettings,
		now: Date,
	): string {
		if (rule.actionType === 'set_static_value') {
			return rule.staticValue ?? '';
		}

		return formatFrontmatterAutomationTime(now, settings.timeFormat);
	}

	private shouldTrigger(
		previousSnapshot: FrontmatterSnapshot,
		currentSnapshot: FrontmatterSnapshot,
		rule: FrontmatterAutomationRule,
	): boolean {
		if (rule.triggerField.length === 0) {
			return false;
		}

		const previousValue = previousSnapshot[rule.triggerField];
		const currentValue = currentSnapshot[rule.triggerField];

		const previouslyMatched = matchesTriggerValue(previousValue, rule.triggerValue, rule.triggerOperator);
		const currentlyMatched = matchesTriggerValue(currentValue, rule.triggerValue, rule.triggerOperator);
		return !previouslyMatched && currentlyMatched;
	}

	private shouldWrite(
		currentValue: unknown,
		nextValue: string,
		writeMode: FrontmatterAutomationRule['writeMode'],
	): boolean {
		if (writeMode === 'when-empty' && !isFrontmatterValueEmpty(currentValue)) {
			return false;
		}

		return currentValue !== nextValue;
	}
}

function matchesTriggerValue(
	value: unknown,
	triggerValue: string,
	operator: FrontmatterAutomationRule['triggerOperator'],
): boolean {
	if (Array.isArray(value)) {
		return value.some((entry) => matchesTriggerValue(entry, triggerValue, operator));
	}

	if (typeof value === 'string') {
		return operator === 'contains'
			? value.includes(triggerValue)
			: value === triggerValue;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		const normalizedValue = String(value);
		return operator === 'contains'
			? normalizedValue.includes(triggerValue)
			: normalizedValue === triggerValue;
	}

	return false;
}
