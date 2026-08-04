/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	DEFAULT_PROJECT_BASE_PROPERTIES,
	normalizeProjectBasePropertyList,
	normalizeProjectBaseSettings,
} from './project-base-settings';
import {
	buildProjectBaseConfig,
	buildProjectBaseViewTargets,
	buildProjectBaseViews,
	ProjectBaseProjectLike,
} from './project-base-utils';

const projects: ProjectBaseProjectLike[] = [
	{folderPath: '1_project/Beta', name: 'Beta'},
	{folderPath: '1_project/Alpha', name: 'Alpha'},
];

describe('project base utilities', () => {
	it('parses and normalizes configurable property lists', () => {
		assert.deepEqual(
			normalizeProjectBasePropertyList(' file.name, obpm_status\nfile.name, file.mtime '),
			['file.name', 'obpm_status', 'file.mtime'],
		);
		assert.deepEqual(normalizeProjectBasePropertyList(' , \n', ['file.name']), ['file.name']);
		assert.deepEqual(normalizeProjectBasePropertyList(['file.name', ' file.mtime\nfile.name ']), [
			'file.name',
			'file.mtime',
		]);
	});

	it('normalizes the root Base path and falls back to defaults', () => {
		const settings = normalizeProjectBaseSettings({
			baseFilePath: '/obpm.base',
			fileScope: 'project',
			projectViewProperties: '',
			totalViewProperties: 'file.name, file.mtime',
		});

		assert.equal(settings.baseFilePath, 'obpm.base');
		assert.equal(settings.enabled, false);
		assert.equal(settings.fileScope, 'project');
		assert.deepEqual(settings.projectViewProperties, DEFAULT_PROJECT_BASE_PROPERTIES);
		assert.deepEqual(settings.totalViewProperties, ['file.name', 'file.mtime']);
		assert.equal(normalizeProjectBaseSettings({fileScope: 'unsupported'}).fileScope, 'inbox');
	});

	it('builds the total view grouped by project inbox folders', () => {
		const views = buildProjectBaseViews({
			projectFileScope: 'inbox',
			projectInboxFolderPath: 'inbox',
			projectViewProperties: ['file.name'],
			projects,
			totalViewProperties: ['file.name', 'file.mtime'],
		});

		assert.deepEqual(views.map((view) => view.name), ['总视图', 'Alpha', 'Beta']);
		assert.deepEqual(views[0], {
			filters: {
				and: [
					'file.ext == "md"',
					{
						or: [
							'file.inFolder("1_project/Alpha/inbox")',
							'file.inFolder("1_project/Beta/inbox")',
						],
					},
				],
			},
			groupBy: {direction: 'ASC', property: 'formula.obpm_project_name'},
			name: '总视图',
			order: ['file.name', 'file.mtime'],
			type: 'table',
		});
		assert.deepEqual(views[1]?.filters, {
			and: ['file.ext == "md"', 'file.inFolder("1_project/Alpha/inbox")'],
		});
	});

	it('shows whole project folders without duplicating nested project files', () => {
		const nestedProjects = [
			{folderPath: '1_project/Parent', name: 'Parent'},
			{folderPath: '1_project/Parent/Child', name: 'Child'},
		];
		const views = buildProjectBaseViews({
			projectFileScope: 'project',
			projectInboxFolderPath: 'inbox',
			projectViewProperties: ['file.name'],
			projects: nestedProjects,
			totalViewProperties: ['file.name'],
		});

		assert.deepEqual(views.find((view) => view.name === 'Parent')?.filters, {
			and: [
				'file.ext == "md"',
				'file.inFolder("1_project/Parent")',
				{not: ['file.inFolder("1_project/Parent/Child")']},
			],
		});
		assert.deepEqual(views.find((view) => view.name === 'Child')?.filters, {
			and: ['file.ext == "md"', 'file.inFolder("1_project/Parent/Child")'],
		});

		const config = buildProjectBaseConfig(undefined, {
			projectFileScope: 'project',
			projectInboxFolderPath: 'inbox',
			projectViewProperties: ['file.name'],
			projects: nestedProjects,
			totalViewProperties: ['file.name'],
		});
		const formula = (config.formulas as Record<string, unknown>).obpm_project_name as string;
		assert.ok(formula.indexOf('"Child"') < formula.indexOf('"Parent"'));
	});

	it('maps generated project view names back to their project data', () => {
		const targets = buildProjectBaseViewTargets(projects, 'inbox');

		assert.deepEqual(targets.map((target) => [target.viewName, target.project.folderPath]), [
			['Alpha', '1_project/Alpha'],
			['Beta', '1_project/Beta'],
		]);
	});

	it('creates, removes, and renames project views from the project list', () => {
		const options = {
			projectFileScope: 'inbox' as const,
			projectInboxFolderPath: 'inbox',
			projectViewProperties: ['file.name'],
			totalViewProperties: ['file.name'],
		};

		assert.deepEqual(
			buildProjectBaseViews({...options, projects}).map((view) => view.name),
			['总视图', 'Alpha', 'Beta'],
		);
		assert.deepEqual(
			buildProjectBaseViews({...options, projects: [projects[0]!]}).map((view) => view.name),
			['总视图', 'Beta'],
		);
		assert.deepEqual(
			buildProjectBaseViews({...options, projects: [{folderPath: '1_project/Alpha', name: 'Renamed'}]}).map((view) => view.name),
			['总视图', 'Renamed'],
		);
	});

	it('preserves an existing project view order when rebuilding the Base config', () => {
		const options = {
			projectFileScope: 'inbox' as const,
			projectInboxFolderPath: 'inbox',
			projectViewProperties: ['file.name'],
			projects,
			totalViewProperties: ['file.name'],
		};
		const initialConfig = buildProjectBaseConfig(undefined, options);
		const initialViews = initialConfig.views as Array<Record<string, unknown>>;
		const reorderedConfig = {
			...initialConfig,
			views: [initialViews[0], initialViews[2], initialViews[1]],
		};

		const nextConfig = buildProjectBaseConfig(reorderedConfig, options);
		assert.deepEqual(
			(nextConfig.views as Array<{name: string}>).map((view) => view.name),
			['总视图', 'Beta', 'Alpha'],
		);
	});

	it('keeps duplicate project views distinct and preserves root config fields', () => {
		const duplicateProjects = [
			{folderPath: '1_project/Alpha-one', name: 'Alpha'},
			{folderPath: '1_project/Alpha-two', name: 'Alpha'},
		];
		const config = buildProjectBaseConfig({
			filters: 'old filter',
			formulas: {custom: 'formula'},
			properties: {'file.name': {displayName: '名称'}},
			summaries: {custom: 'summary'},
		}, {
			projectFileScope: 'inbox',
			projectInboxFolderPath: 'inbox',
			projectViewProperties: ['file.name'],
			projects: duplicateProjects,
			totalViewProperties: ['file.name'],
		});

		assert.deepEqual((config.views as Array<{name: string}>).map((view) => view.name), [
			'总视图',
			'Alpha',
			'Alpha (1_project/Alpha-two)',
		]);
		assert.equal(config.filters, undefined);
		assert.deepEqual(config.summaries, {custom: 'summary'});
		assert.equal((config.formulas as Record<string, unknown>).custom, 'formula');
		assert.equal((config.formulas as Record<string, unknown>).file_time, '(file.mtime - file.ctime).days.round(2)');
	});
});
