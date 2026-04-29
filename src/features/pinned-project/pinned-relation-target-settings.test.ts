/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {normalizePinnedRelationTargetSettings} from './pinned-relation-target-settings';

describe('normalizePinnedRelationTargetSettings', () => {
	it('migrates the legacy pinned project path and rules to the pinned relation target settings', () => {
		const settings = normalizePinnedRelationTargetSettings({
			pinnedProject: {
				enabled: true,
				excludeRules: [
					{
						key: 'archived',
						matchMode: 'key-exists',
					},
				],
				includeRules: [
					{
						key: 'kind',
						matchMode: 'key-value-equals',
						value: 'capture',
					},
				],
				linkMode: 'project-section',
				projectPath: 'Projects/Alpha/Tasks/Task.md',
				sectionHeading: 'related',
			},
		});

		assert.deepEqual(settings, {
			enabled: true,
			excludeRules: [
				{
					key: 'archived',
					matchMode: 'key-exists',
				},
			],
			includeRules: [
				{
					key: 'kind',
					matchMode: 'key-value-equals',
					value: 'capture',
				},
			],
			targetPath: 'Projects/Alpha/Tasks/Task.md',
		});
	});

	it('prefers an existing pinned relation target setting over the legacy pinned project setting', () => {
		const settings = normalizePinnedRelationTargetSettings({
			pinnedProject: {
				enabled: true,
				projectPath: 'Projects/Legacy/Project.md',
			},
			pinnedRelationTarget: {
				enabled: true,
				excludeRules: [],
				includeRules: [],
				targetPath: 'Projects/Alpha/Tasks/Task.md',
			},
		});

		assert.equal(settings.targetPath, 'Projects/Alpha/Tasks/Task.md');
	});
});
