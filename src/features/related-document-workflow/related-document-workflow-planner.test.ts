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
		isProject: false,
		name: 'Local.md',
		parentPath: 'Projects/Alpha/docs',
		path: 'Projects/Alpha/docs/Local.md',
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

	it('skips documents that are already anywhere inside the project folder', () => {
		const result = buildRelatedDocumentMovePlans({
			files,
			pathExists: () => false,
			relationState: {
				projectMarkdownLinksBySourcePath: {
					'Projects/Alpha/Project.md': ['Projects/Alpha/docs/Local.md'],
				},
				sourceTargetsByPath: {},
			},
			targetSubfolderPath: 'related',
		});

		assert.deepEqual(result.plans, []);
		assert.equal(result.stats.alreadyInProjectFolderCount, 1);
	});

	it('moves the source document into the project subfolder when it relates to a non-project file inside the project folder', () => {
		const result = buildRelatedDocumentMovePlans({
			files: [
				...files,
				{
					isProject: false,
					name: 'Nested task.md',
					parentPath: 'Projects/Alpha/tasks/deep',
					path: 'Projects/Alpha/tasks/deep/Nested task.md',
				},
			],
			pathExists: () => false,
			relationState: {
				projectMarkdownLinksBySourcePath: {},
				sourceTargetsByPath: {
					'Inbox/Task.md': ['Projects/Alpha/tasks/deep/Nested task.md'],
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

	it('moves the outside target document when a non-project file inside the project folder relates to it', () => {
		const result = buildRelatedDocumentMovePlans({
			files: [
				...files,
				{
					isProject: false,
					name: 'Nested task.md',
					parentPath: 'Projects/Alpha/tasks/deep',
					path: 'Projects/Alpha/tasks/deep/Nested task.md',
				},
			],
			pathExists: () => false,
			relationState: {
				projectMarkdownLinksBySourcePath: {},
				sourceTargetsByPath: {
					'Projects/Alpha/tasks/deep/Nested task.md': ['Refs/Reference.md'],
				},
			},
			targetSubfolderPath: 'related',
		});

		assert.deepEqual(result.plans, [{
			projectPath: 'Projects/Alpha/Project.md',
			sourcePath: 'Refs/Reference.md',
			targetFolderPath: 'Projects/Alpha/related',
			targetPath: 'Projects/Alpha/related/Reference.md',
		}]);
	});
});
