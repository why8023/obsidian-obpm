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
	normalizeBaseViewName,
	normalizeConfiguredBaseFilePath,
	normalizeConfiguredFolderPath,
	sortProjectCandidates,
} from './configured-folder-note-utils';

describe('configured-folder note utilities', () => {
	it('normalizes configured-folder note settings', () => {
		assert.deepEqual(DEFAULT_CONFIGURED_FOLDER_NOTE_SETTINGS, {
			baseFilePath: '',
			baseViewName: '',
			enabled: false,
			includeFilterDefaults: false,
			projectInboxFolderPath: 'inbox',
			projectListSortBy: 'name',
			projectListSortDirection: 'asc',
		});

		assert.deepEqual(normalizeConfiguredFolderNoteSettings({
			baseFilePath: ' Bases\\Tasks.base ',
			baseViewName: ' Tasks ',
			enabled: true,
			includeFilterDefaults: true,
			projectInboxFolderPath: ' Inbox\\Tasks / ./ ',
			projectListSortBy: 'modified',
			projectListSortDirection: 'desc',
		}), {
			baseFilePath: 'Bases/Tasks.base',
			baseViewName: 'Tasks',
			enabled: true,
			includeFilterDefaults: true,
			projectInboxFolderPath: 'Inbox/Tasks',
			projectListSortBy: 'modified',
			projectListSortDirection: 'desc',
		});

		assert.deepEqual(normalizeConfiguredFolderNoteSettings({
			baseFilePath: 42,
			baseViewName: false,
			enabled: 'yes',
			includeFilterDefaults: 'yes',
			projectInboxFolderPath: '../outside',
			projectListSortBy: 'time',
			projectListSortDirection: 'down',
			targetFolderPath: '../outside',
		}), {
			baseFilePath: '',
			baseViewName: '',
			enabled: false,
			includeFilterDefaults: false,
			projectInboxFolderPath: 'outside',
			projectListSortBy: 'name',
			projectListSortDirection: 'asc',
		});

		assert.equal(
			normalizeConfiguredFolderNoteSettings({targetFolderPath: '0_inbox'}).projectInboxFolderPath,
			'inbox',
		);
		assert.equal(
			normalizeConfiguredFolderNoteSettings({projectInboxFolderPath: ''}).projectInboxFolderPath,
			'inbox',
		);
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
			pathExists: (path) =>
				path === 'Projects/Alpha/inbox/Untitled.md' || path === 'Projects/Alpha/inbox/Untitled 1.md',
			targetFolderPath: 'Projects/Alpha/inbox',
		});

		assert.deepEqual(plan, {
			basename: 'Untitled 2',
			filePath: 'Projects/Alpha/inbox/Untitled 2.md',
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
			viewName: 'Tasks',
		});

		assert.deepEqual(template, {
			frontmatter: {
				status: null,
			},
			kind: 'success',
		});
	});

	it('uses the selected Base view even when its filters point at a fixed folder', () => {
		const template = buildBaseFrontmatterTemplate({
			views: [
				{
					filters: 'file.inFolder("0_inbox")',
					name: 'Inbox',
					order: ['file.name', 'status', 'note.due', 'formula.age'],
					type: 'table',
				},
			],
		}, {
			includeFilterDefaults: false,
			viewName: 'Inbox',
		});

		assert.deepEqual(template, {
			frontmatter: {
				status: null,
				due: null,
			},
			kind: 'success',
		});
	});

	it('reports missing views', () => {
		assert.deepEqual(buildBaseFrontmatterTemplate({
			filters: 'file.inFolder("Projects")',
			views: [{name: 'Tasks', order: ['status'], type: 'table'}],
		}, {
			includeFilterDefaults: false,
			viewName: 'Archive',
		}), {kind: 'view-not-found'});
	});

	it('sorts project candidates by the selected field and direction', () => {
		const candidates = [
			{
				file: {path: 'Projects/Beta/Beta.md', stat: {ctime: 30, mtime: 10}},
				name: 'Beta',
			},
			{
				file: {path: 'Projects/Alpha/Alpha.md', stat: {ctime: 20, mtime: 30}},
				name: 'Alpha',
			},
			{
				file: {path: 'Projects/Gamma/Gamma.md', stat: {ctime: 20, mtime: 30}},
				name: 'Gamma',
			},
		];

		assert.deepEqual(
			sortProjectCandidates(candidates, 'name', 'asc').map((candidate) => candidate.name),
			['Alpha', 'Beta', 'Gamma'],
		);
		assert.deepEqual(
			sortProjectCandidates(candidates, 'name', 'desc').map((candidate) => candidate.name),
			['Gamma', 'Beta', 'Alpha'],
		);
		assert.deepEqual(
			sortProjectCandidates(candidates, 'created', 'asc').map((candidate) => candidate.name),
			['Alpha', 'Gamma', 'Beta'],
		);
		assert.deepEqual(
			sortProjectCandidates(candidates, 'modified', 'desc').map((candidate) => candidate.name),
			['Gamma', 'Alpha', 'Beta'],
		);

		const sameNameCandidates = [
			{
				file: {path: 'Projects/Zeta/Alpha.md', stat: {ctime: 10, mtime: 10}},
				name: 'Alpha',
			},
			{
				file: {path: 'Projects/Alpha/Alpha.md', stat: {ctime: 10, mtime: 10}},
				name: 'Alpha',
			},
		];
		assert.deepEqual(
			sortProjectCandidates(sameNameCandidates, 'created', 'asc').map((candidate) => candidate.file.path),
			['Projects/Alpha/Alpha.md', 'Projects/Zeta/Alpha.md'],
		);
	});
});
