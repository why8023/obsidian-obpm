/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS,
	normalizeConfiguredFolderNoteSettings,
} from './configured-folder-note-settings';
import {
	buildBaseFrontmatterTemplate,
	buildConfiguredFolderNoteCreationPlan,
	buildMarkdownContentWithFrontmatter,
	normalizeBaseViewName,
	normalizeConfiguredBaseFilePath,
	normalizeConfiguredFolderPath,
} from './configured-folder-note-utils';

describe('configured-folder note utilities', () => {
	it('normalizes configured-folder note settings', () => {
		assert.deepEqual(DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS, {
			baseFilePath: '',
			baseViewName: '',
			enabled: false,
			includeFilterDefaults: false,
			targetFolderPath: '',
		});

		assert.deepEqual(normalizeConfiguredFolderNoteSettings({
			baseFilePath: ' Bases\\Tasks.base ',
			baseViewName: ' Tasks ',
			enabled: true,
			includeFilterDefaults: true,
			targetFolderPath: ' Inbox\\Tasks / ./ ',
		}), {
			baseFilePath: 'Bases/Tasks.base',
			baseViewName: 'Tasks',
			enabled: true,
			includeFilterDefaults: true,
			targetFolderPath: 'Inbox/Tasks',
		});

		assert.deepEqual(normalizeConfiguredFolderNoteSettings({
			baseFilePath: 42,
			baseViewName: false,
			enabled: 'yes',
			includeFilterDefaults: 'yes',
			targetFolderPath: '../outside',
		}), {
			baseFilePath: '',
			baseViewName: '',
			enabled: false,
			includeFilterDefaults: false,
			targetFolderPath: 'outside',
		});
	});

	it('normalizes individual configured-folder note setting values', () => {
		assert.equal(normalizeConfiguredFolderPath(' Inbox\\Tasks / ./ '), 'Inbox/Tasks');
		assert.equal(normalizeConfiguredFolderPath('../Inbox'), 'Inbox');
		assert.equal(normalizeConfiguredBaseFilePath(' Bases\\Tasks.base '), 'Bases/Tasks.base');
		assert.equal(normalizeBaseViewName(' Tasks '), 'Tasks');
	});

	it('builds a unique default markdown path in the configured folder', () => {
		const plan = buildConfiguredFolderNoteCreationPlan({
			defaultBasename: 'Untitled',
			pathExists: (path) => path === 'Inbox/Untitled.md' || path === 'Inbox/Untitled 1.md',
			targetFolderPath: 'Inbox',
		});

		assert.deepEqual(plan, {
			basename: 'Untitled 2',
			filePath: 'Inbox/Untitled 2.md',
		});
	});

	it('strips a markdown extension from the default basename before planning', () => {
		const plan = buildConfiguredFolderNoteCreationPlan({
			defaultBasename: 'Untitled.md',
			pathExists: () => false,
			targetFolderPath: '',
		});

		assert.deepEqual(plan, {
			basename: 'Untitled',
			filePath: 'Untitled.md',
		});
	});

	it('extracts selected Base view order properties when the folder is included globally', () => {
		const template = buildBaseFrontmatterTemplate({
			filters: {
				and: [
					'file.inFolder("Projects")',
					'kind == "task"',
				],
			},
			views: [
				{
					name: 'Tasks',
					order: ['file.name', 'status', 'note.due', 'formula.age', 'kind', 'status'],
					type: 'table',
				},
			],
		}, {
			includeFilterDefaults: false,
			targetFolderPath: 'Projects/Inbox',
			viewName: 'Tasks',
		});

		assert.deepEqual(template, {
			frontmatter: {
				status: null,
				due: null,
				kind: null,
			},
			kind: 'success',
		});
	});

	it('adds simple global and view filter defaults only when enabled', () => {
		const template = buildBaseFrontmatterTemplate({
			filters: {
				and: [
					'file.inFolder("Projects")',
					'kind == "task"',
					'priority == 2',
				],
			},
			views: [
				{
					filters: {
						and: [
							'status == "todo"',
							'done == false',
						],
					},
					name: 'Tasks',
					order: ['status', 'kind', 'priority', 'done', 'due'],
					type: 'table',
				},
			],
		}, {
			includeFilterDefaults: true,
			targetFolderPath: 'Projects/Inbox',
			viewName: 'Tasks',
		});

		assert.deepEqual(template, {
			frontmatter: {
				status: 'todo',
				kind: 'task',
				priority: 2,
				done: false,
				due: null,
			},
			kind: 'success',
		});
	});

	it('does not write defaults from or/not filter branches', () => {
		const template = buildBaseFrontmatterTemplate({
			filters: 'file.inFolder("Projects")',
			views: [
				{
					filters: {
						or: [
							'status == "todo"',
							'status == "next"',
						],
					},
					name: 'Tasks',
					order: ['status'],
					type: 'table',
				},
			],
		}, {
			includeFilterDefaults: true,
			targetFolderPath: 'Projects',
			viewName: 'Tasks',
		});

		assert.deepEqual(template, {
			frontmatter: {
				status: null,
			},
			kind: 'success',
		});
	});

	it('matches exact file.folder filters only for the target folder', () => {
		const matchingTemplate = buildBaseFrontmatterTemplate({
			views: [
				{
					filters: 'file.folder == "Projects/Inbox"',
					name: 'Inbox',
					order: ['status'],
					type: 'table',
				},
			],
		}, {
			includeFilterDefaults: false,
			targetFolderPath: 'Projects/Inbox',
			viewName: 'Inbox',
		});

		const nonMatchingTemplate = buildBaseFrontmatterTemplate({
			views: [
				{
					filters: 'file.folder == "Projects/Inbox"',
					name: 'Inbox',
					order: ['status'],
					type: 'table',
				},
			],
		}, {
			includeFilterDefaults: false,
			targetFolderPath: 'Projects/Inbox/Subfolder',
			viewName: 'Inbox',
		});

		assert.equal(matchingTemplate.kind, 'success');
		assert.deepEqual(nonMatchingTemplate, {kind: 'folder-not-matched'});
	});

	it('reports missing views and folder mismatches', () => {
		assert.deepEqual(buildBaseFrontmatterTemplate({
			filters: 'file.inFolder("Projects")',
			views: [{name: 'Tasks', order: ['status'], type: 'table'}],
		}, {
			includeFilterDefaults: false,
			targetFolderPath: 'Projects',
			viewName: 'Archive',
		}), {kind: 'view-not-found'});

		assert.deepEqual(buildBaseFrontmatterTemplate({
			filters: {
				not: ['file.inFolder("Archive")'],
			},
			views: [{name: 'Tasks', order: ['status'], type: 'table'}],
		}, {
			includeFilterDefaults: false,
			targetFolderPath: 'Archive',
			viewName: 'Tasks',
		}), {kind: 'folder-not-matched'});
	});

	it('wraps frontmatter yaml in markdown delimiters', () => {
		const content = buildMarkdownContentWithFrontmatter({
			status: 'todo',
			due: null,
		}, (frontmatter) => Object.entries(frontmatter)
			.map(([key, value]) => value === null ? `${key}:` : `${key}: ${formatTestYamlValue(value)}`)
			.join('\n'));

		assert.equal(content, [
			'---',
			'status: todo',
			'due:',
			'---',
			'',
		].join('\n'));
	});
});

function formatTestYamlValue(value: unknown): string {
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value.toString();
	}

	return '';
}
