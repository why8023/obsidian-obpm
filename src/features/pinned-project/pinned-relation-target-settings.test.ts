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
					source: 'frontmatter',
				},
			],
			includeRules: [
				{
					key: 'kind',
					matchMode: 'key-value-equals',
					source: 'frontmatter',
					value: 'capture',
				},
			],
			targetPath: 'Projects/Alpha/Tasks/Task.md',
		});
	});

	it('normalizes path rules and drops empty path rules', () => {
		const settings = normalizePinnedRelationTargetSettings({
			pinnedRelationTarget: {
				enabled: true,
				excludeRules: [
					{
						matchMode: 'path-glob',
						source: 'path',
						value: '**/archive/**',
					},
					{
						matchMode: 'path-contains',
						source: 'path',
						value: '   ',
					},
				],
				includeRules: [
					{
						matchMode: 'path-starts-with',
						source: 'path',
						value: '\\0_inbox\\',
					},
				],
				targetPath: 'Projects/Alpha/Tasks/Task.md',
			},
		});

		assert.deepEqual(settings.excludeRules, [
			{
				matchMode: 'path-glob',
				source: 'path',
				value: '**/archive/**',
			},
		]);
		assert.deepEqual(settings.includeRules, [
			{
				matchMode: 'path-starts-with',
				source: 'path',
				value: '0_inbox/',
			},
		]);
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
