/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildRelatedLinksState, normalizeRelatedLinksState} from './related-links-state-store';

describe('related links state store', () => {
	it('keeps project markdown relations separate from managed targets', () => {
		const state = buildRelatedLinksState(
			[
				{
					displayText: 'Task',
					sourcePath: 'Tasks/task.md',
					targetPaths: ['Projects/project.md'],
				},
			],
			[
				{
					displayText: 'Project',
					sourcePath: 'Projects/project.md',
					targetPaths: ['Refs/a.md'],
				},
			],
		);

		assert.deepEqual(state.sourceTargetsByPath, {
			'Tasks/task.md': ['Projects/project.md'],
		});
		assert.deepEqual(state.managedTargets, ['Projects/project.md']);
		assert.deepEqual(state.projectMarkdownLinksBySourcePath, {
			'Projects/project.md': ['Refs/a.md'],
		});
	});

	it('normalizes missing project markdown relations from older state', () => {
		const state = normalizeRelatedLinksState({
			version: 1,
			sourceTargetsByPath: {
				'Tasks/task.md': ['Projects/project.md'],
			},
			managedTargets: ['Projects/project.md'],
		});

		assert.deepEqual(state.projectMarkdownLinksBySourcePath, {});
	});
});
