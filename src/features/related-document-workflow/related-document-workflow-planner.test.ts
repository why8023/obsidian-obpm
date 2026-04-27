/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildRelatedDocumentMovePlans, RelatedDocumentWorkflowFileInfo} from './related-document-workflow-planner';

const files: RelatedDocumentWorkflowFileInfo[] = [
	{
		isProject: true,
		name: 'Project.md',
		parentPath: 'Projects/Alpha',
		path: 'Projects/Alpha/Project.md',
	},
	{
		isProject: false,
		name: 'Task.md',
		parentPath: 'Inbox',
		path: 'Inbox/Task.md',
	},
	{
		isProject: false,
		name: 'Reference.md',
		parentPath: 'Refs',
		path: 'Refs/Reference.md',
	},
	{
		isProject: true,
		name: 'Other.md',
		parentPath: 'Projects/Beta',
		path: 'Projects/Beta/Other.md',
	},
];

describe('buildRelatedDocumentMovePlans', () => {
	it('moves the non-project side of frontmatter relations into the project subfolder', () => {
		const result = buildRelatedDocumentMovePlans({
			files,
			pathExists: () => false,
			relationState: {
				projectMarkdownLinksBySourcePath: {},
				sourceTargetsByPath: {
					'Inbox/Task.md': ['Projects/Alpha/Project.md'],
				},
			},
			targetSubfolderPath: 'related',
		});

		assert.deepEqual(result.plans, [{
			projectPath: 'Projects/Alpha/Project.md',
			sourcePath: 'Inbox/Task.md',
			targetFolderPath: 'Projects/Alpha/related',
			targetPath: 'Projects/Alpha/related/Task.md',
		}]);
	});

	it('uses project Markdown link relations without treating the project as the document', () => {
		const result = buildRelatedDocumentMovePlans({
			files,
			pathExists: () => false,
			relationState: {
				projectMarkdownLinksBySourcePath: {
					'Projects/Alpha/Project.md': ['Refs/Reference.md'],
				},
				sourceTargetsByPath: {},
			},
			targetSubfolderPath: 'docs',
		});

		assert.equal(result.plans.length, 1);
		assert.equal(result.plans[0]?.sourcePath, 'Refs/Reference.md');
		assert.equal(result.plans[0]?.targetPath, 'Projects/Alpha/docs/Reference.md');
	});

	it('skips documents related to multiple projects', () => {
		const result = buildRelatedDocumentMovePlans({
			files,
			pathExists: () => false,
			relationState: {
				projectMarkdownLinksBySourcePath: {},
				sourceTargetsByPath: {
					'Inbox/Task.md': [
						'Projects/Alpha/Project.md',
						'Projects/Beta/Other.md',
					],
				},
			},
			targetSubfolderPath: 'related',
		});

		assert.deepEqual(result.plans, []);
		assert.equal(result.stats.ambiguousDocumentCount, 1);
	});

	it('chooses a unique target path when the target folder already has that file name', () => {
		const result = buildRelatedDocumentMovePlans({
			files,
			pathExists: (path) => path === 'Projects/Alpha/related/Task.md',
			relationState: {
				projectMarkdownLinksBySourcePath: {},
				sourceTargetsByPath: {
					'Inbox/Task.md': ['Projects/Alpha/Project.md'],
				},
			},
			targetSubfolderPath: 'related',
		});

		assert.equal(result.plans[0]?.targetPath, 'Projects/Alpha/related/Task 1.md');
	});
});
