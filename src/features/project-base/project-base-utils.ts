import {joinPath} from '../project-routing/file-move-utils';

export interface ProjectBaseProjectLike {
	folderPath: string;
	name: string;
}

export interface BuildProjectBaseViewsOptions {
	projectViewProperties: readonly string[];
	projects: readonly ProjectBaseProjectLike[];
	projectInboxFolderPath: string;
	totalViewProperties: readonly string[];
}

export interface ProjectBaseView {
	filters: Record<string, unknown>;
	groupBy?: {
		direction: 'ASC' | 'DESC';
		property: string;
	};
	name: string;
	order: string[];
	type: 'table';
}

export type ProjectBaseConfig = Record<string, unknown>;

const TOTAL_VIEW_NAME = '总视图';
const PROJECT_GROUP_FORMULA = 'obpm_project_name';
const DEFAULT_FILE_TIME_FORMULA = '(file.mtime - file.ctime).days.round(2)';
const DEFAULT_TASK_TIME_FORMULA = 'if(obpm_start_time && obpm_end_time, (date(obpm_end_time) - date(obpm_start_time)).days.round(2), "")';

export function buildProjectBaseViews(options: BuildProjectBaseViewsOptions): ProjectBaseView[] {
	const projects = [...options.projects]
		.sort((left, right) => left.name.localeCompare(right.name) || left.folderPath.localeCompare(right.folderPath));
	const projectViews = createProjectViewDescriptors(projects, options.projectInboxFolderPath);
	const projectPaths = [...new Set(projectViews.map((project) => project.folderPath))];

	return [
		{
			filters: buildTotalFilters(projectPaths),
			groupBy: {
				direction: 'ASC',
				property: `formula.${PROJECT_GROUP_FORMULA}`,
			},
			name: TOTAL_VIEW_NAME,
			order: [...options.totalViewProperties],
			type: 'table',
		},
		...projectViews.map((project) => ({
			filters: buildFolderFilters(project.folderPath),
			name: project.viewName,
			order: [...options.projectViewProperties],
			type: 'table' as const,
		})),
	];
}

export function buildProjectBaseConfig(
	existingConfig: ProjectBaseConfig | undefined,
	options: BuildProjectBaseViewsOptions,
): ProjectBaseConfig {
	const nextConfig: ProjectBaseConfig = {...existingConfig};
	delete nextConfig.filters;

	const formulas = isObjectRecord(nextConfig.formulas) ? {...nextConfig.formulas} : {};
	if (typeof formulas.file_time !== 'string') {
		formulas.file_time = DEFAULT_FILE_TIME_FORMULA;
	}
	if (typeof formulas.task_time !== 'string') {
		formulas.task_time = DEFAULT_TASK_TIME_FORMULA;
	}
	formulas[PROJECT_GROUP_FORMULA] = buildProjectGroupFormula(options);
	nextConfig.formulas = formulas;

	const properties = isObjectRecord(nextConfig.properties) ? {...nextConfig.properties} : {};
	if (!isObjectRecord(properties[`formula.${PROJECT_GROUP_FORMULA}`])) {
		properties[`formula.${PROJECT_GROUP_FORMULA}`] = {displayName: '项目分组'};
	}
	nextConfig.properties = properties;
	nextConfig.views = buildProjectBaseViews(options);
	return nextConfig;
}

function buildTotalFilters(projectPaths: readonly string[]): Record<string, unknown> {
	if (projectPaths.length === 0) {
		return {and: ['file.ext == "md"', 'false']};
	}

	return {
		and: [
			'file.ext == "md"',
			{or: projectPaths.map((path) => buildInFolderExpression(path))},
		],
	};
}

function buildFolderFilters(folderPath: string): Record<string, unknown> {
	return {
		and: ['file.ext == "md"', buildInFolderExpression(folderPath)],
	};
}

function buildInFolderExpression(folderPath: string): string {
	return `file.inFolder(${JSON.stringify(folderPath)})`;
}

function buildProjectGroupFormula(options: BuildProjectBaseViewsOptions): string {
	const projects = createProjectViewDescriptors(
		[...options.projects].sort((left, right) => left.name.localeCompare(right.name) || left.folderPath.localeCompare(right.folderPath)),
		options.projectInboxFolderPath,
	);
	return projects.reduceRight(
		(fallback, project) => `if(${buildInFolderExpression(project.folderPath)}, ${JSON.stringify(project.viewName)}, ${fallback})`,
		'""',
	);
}

function createProjectViewDescriptors(
	projects: readonly ProjectBaseProjectLike[],
	projectInboxFolderPath: string,
): Array<{folderPath: string; viewName: string}> {
	const usedNames = new Set<string>([TOTAL_VIEW_NAME]);
	const nameCounts = new Map<string, number>();

	return projects.map((project) => {
		const baseName = project.name.trim() || project.folderPath || '项目';
		const count = (nameCounts.get(baseName) ?? 0) + 1;
		nameCounts.set(baseName, count);

		let viewName = count === 1 ? baseName : `${baseName} (${project.folderPath || count})`;
		let suffix = 2;
		while (usedNames.has(viewName)) {
			viewName = `${baseName} (${project.folderPath || count}-${suffix})`;
			suffix += 1;
		}
		usedNames.add(viewName);

		return {
			folderPath: joinPath(project.folderPath, projectInboxFolderPath),
			viewName,
		};
	});
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
