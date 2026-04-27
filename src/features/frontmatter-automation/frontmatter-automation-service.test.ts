/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	createDefaultFrontmatterAutomationRule,
	DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS,
	normalizeFrontmatterAutomationSettings,
} from './frontmatter-automation-settings';
import {FrontmatterAutomationService} from './frontmatter-automation-service';
import {FrontmatterAutomationSettings} from './frontmatter-automation-types';

const service = new FrontmatterAutomationService();

describe('FrontmatterAutomationService', () => {
	it('writes the current time when status changes to done', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: 'done',
			},
			previousSnapshot: {
				obpm_status: 'todo',
			},
			settings: createSettings(),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.equal(result.actions.length, 1);
		assert.deepEqual(result.actions[0], {
			nextValue: '2026-04-10T23:45:12',
			ruleId: 'obpm-status-done-set-end-time',
			targetField: 'obpm_end_time',
		});
		assert.equal(result.nextSnapshot.obpm_end_time, '2026-04-10T23:45:12');
	});

	it('matches link-style values when the rule uses contains', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: '[[done]]',
			},
			previousSnapshot: {
				obpm_status: '[[todo]]',
			},
			settings: createSettings(),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.equal(result.actions.length, 1);
		assert.equal(result.actions.at(0)?.targetField, 'obpm_end_time');
	});

	it('matches list values when one item contains the trigger value', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: ['[[todo]]', '[[done]]'],
			},
			previousSnapshot: {
				obpm_status: ['[[todo]]'],
			},
			settings: createSettings(),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.equal(result.actions.length, 1);
	});

	it('does not trigger for non-target status changes', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: 'doing',
			},
			previousSnapshot: {
				obpm_status: 'todo',
			},
			settings: createSettings(),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.equal(result.actions.length, 0);
	});

	it('does not trigger again when status stays done', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: 'done',
				obpm_end_time: '2026-04-10 23:45:12',
			},
			previousSnapshot: {
				obpm_status: 'done',
				obpm_end_time: '2026-04-10T23:45:12',
			},
			settings: createSettings(),
			now: new Date(2026, 3, 11, 8, 0, 0),
		});

		assert.equal(result.actions.length, 0);
	});

	it('respects when-empty write mode', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: 'done',
				obpm_end_time: '2026-04-10T20:00:00',
			},
			previousSnapshot: {
				obpm_status: 'todo',
				obpm_end_time: '2026-04-10T20:00:00',
			},
			settings: createSettings({
				rules: [
					createDefaultFrontmatterAutomationRule({
						writeMode: 'when-empty',
					}),
				],
			}),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.equal(result.actions.length, 0);
	});

	it('can trigger again after leaving and re-entering done', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: 'done',
				obpm_end_time: '2026-04-10T23:45:12',
			},
			previousSnapshot: {
				obpm_status: 'todo',
				obpm_end_time: '2026-04-10T23:45:12',
			},
			settings: createSettings(),
			now: new Date(2026, 3, 11, 8, 0, 0),
		});

		assert.equal(result.actions.length, 1);
		assert.equal(result.actions.at(0)?.nextValue, '2026-04-11T08:00:00');
	});

	it('skips idempotent writes when the generated value is already present', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: 'done',
				obpm_end_time: '2026-04-10T23:45:12',
			},
			previousSnapshot: {
				obpm_status: 'todo',
				obpm_end_time: '2026-04-10T23:45:12',
			},
			settings: createSettings(),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.equal(result.actions.length, 0);
	});

	it('keeps exact equals matching available for explicitly configured rules', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: '[[done]]',
			},
			previousSnapshot: {
				obpm_status: 'todo',
			},
			settings: createSettings({
				rules: [
					createDefaultFrontmatterAutomationRule({
						triggerOperator: 'equals',
					}),
				],
			}),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.equal(result.actions.length, 0);
	});

	it('migrates the legacy built-in done rule from equals to contains', () => {
		const settings = normalizeFrontmatterAutomationSettings({
			enableFrontmatterAutomation: true,
			timeFormat: 'YYYY-MM-DDTHH:mm:ss',
			rules: [
				{
					id: 'obpm-status-done-set-end-time',
					enabled: true,
					triggerField: 'obpm_status',
					triggerOperator: 'equals',
					triggerValue: 'done',
					actionType: 'set_current_time',
					targetField: 'obpm_end_time',
					writeMode: 'always',
				},
			],
		});

		assert.equal(settings.rules.at(0)?.triggerOperator, 'contains');
	});

	it('emits a project move action from a configurable trigger rule', () => {
		const result = service.evaluate({
			currentSnapshot: {
				status: 'archived',
			},
			previousSnapshot: {
				status: 'active',
			},
			settings: createSettings({
				rules: [
					createDefaultFrontmatterAutomationRule({
						actionType: 'ensure_project_folder',
						id: 'archive-into-project',
						targetField: '',
						targetSubfolderPath: 'done',
						triggerField: 'status',
						triggerOperator: 'equals',
						triggerValue: 'archived',
					}),
				],
			}),
		});

		assert.equal(result.actions.length, 0);
		assert.deepEqual(result.projectMoveActions, [
			{
				ruleId: 'archive-into-project',
				targetSubfolderPath: 'done',
			},
		]);
	});

	it('can write frontmatter and request a project move from the same trigger change', () => {
		const result = service.evaluate({
			currentSnapshot: {
				obpm_status: 'done',
			},
			previousSnapshot: {
				obpm_status: 'todo',
			},
			settings: createSettings({
				rules: [
					createDefaultFrontmatterAutomationRule({
						id: 'done-set-end-time',
					}),
					createDefaultFrontmatterAutomationRule({
						actionType: 'ensure_project_folder',
						id: 'done-move-into-project',
						targetField: '',
						targetSubfolderPath: 'archive',
					}),
				],
			}),
			now: new Date(2026, 3, 10, 23, 45, 12),
		});

		assert.deepEqual(result.actions, [
			{
				nextValue: '2026-04-10T23:45:12',
				ruleId: 'done-set-end-time',
				targetField: 'obpm_end_time',
			},
		]);
		assert.equal(result.nextSnapshot.obpm_end_time, '2026-04-10T23:45:12');
		assert.deepEqual(result.projectMoveActions, [
			{
				ruleId: 'done-move-into-project',
				targetSubfolderPath: 'archive',
			},
		]);
	});

	it('migrates legacy done project move settings into a configurable rule', () => {
		const settings = normalizeFrontmatterAutomationSettings({
			doneProjectMove: {
				enabled: true,
				targetSubfolderPath: ' task\\done ',
			},
		});
		const projectMoveRule = settings.rules.find((rule) => rule.id === 'obpm-status-done-ensure-project-folder');

		assert.equal(projectMoveRule?.actionType, 'ensure_project_folder');
		assert.equal(projectMoveRule?.triggerField, 'obpm_status');
		assert.equal(projectMoveRule?.triggerValue, 'done');
		assert.equal(projectMoveRule?.targetSubfolderPath, 'task/done');
	});
});

function createSettings(overrides: Partial<FrontmatterAutomationSettings> = {}): FrontmatterAutomationSettings {
	return {
		enableFrontmatterAutomation: DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS.enableFrontmatterAutomation,
		timeFormat: DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS.timeFormat,
		rules: DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS.rules.map((rule) => createDefaultFrontmatterAutomationRule(rule)),
		...overrides,
	};
}
