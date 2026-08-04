import {isPathInsideFolderPath, joinPath} from '../project-routing/file-move-utils';
import {
	DEFAULT_PROJECT_BASE_FILE_SCOPE,
	ProjectBaseFileScope,
} from './project-base-settings';

export interface ProjectBaseProjectLike {
	folderPath: string;
	name: string;
}

export interface BuildProjectBaseViewsOptions {
	projectFileScope: ProjectBaseFileScope;
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

export interface ProjectBaseViewTarget<T extends ProjectBaseProjectLike = ProjectBaseProjectLike> {
	excludedFolderPaths: string[];
	folderPath: string;
	project: T;
	viewName: string;
}

export type ProjectBaseConfig = Record<string, unknown>;

const TOTAL_VIEW_NAME = '总视图';
const PROJECT_GROUP_FORMULA = 'obpm_project_name';
const DEFAULT_FILE_TIME_FORMULA = '(file.mtime - file.ctime).days.round(2)';
const DEFAULT_TASK_TIME_FORMULA = 'if(obpm_start_time && obpm_end_time, (date(obpm_end_time) - date(obpm_start_time)).days.round(2), "")';

export function buildProjectBaseViews(options: BuildProjectBaseViewsOptions): ProjectBaseView[] {
	const projectViews = buildProjectBaseViewTargets(
		options.projects,
		options.projectInboxFolderPath,
		options.projectFileScope,
	);
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
			filters: buildFolderFilters(project),
			name: project.viewName,
			order: [...options.projectViewProperties],
			type: 'table' as const,
		})),
	];
}

export function buildProjectBaseViewTargets<T extends ProjectBaseProjectLike>(
	projects: readonly T[],
	projectInboxFolderPath: string,
	projectFileScope: ProjectBaseFileScope = DEFAULT_PROJECT_BASE_FILE_SCOPE,
): Array<ProjectBaseViewTarget<T>> {
	const sortedProjects = [...projects]
		.sort((left, right) => left.name.localeCompare(right.name) || left.folderPath.localeCompare(right.folderPath));
	const projectViews = createProjectViewDescriptors(sortedProjects, projectInboxFolderPath, projectFileScope);

	return projectViews.map((project, index) => ({
		...project,
		project: sortedProjects[index]!,
	}));
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
	const projectViews = buildProjectBaseViewTargets(
		options.projects,
		options.projectInboxFolderPath,
		options.projectFileScope,
	);
	formulas[PROJECT_GROUP_FORMULA] = buildProjectGroupFormula(projectViews);
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

function buildFolderFilters(project: ProjectBaseViewTarget): Record<string, unknown> {
	const filters: unknown[] = ['file.ext == "md"', buildInFolderExpression(project.folderPath)];
	if (project.excludedFolderPaths.length > 0) {
		filters.push({
			not: project.excludedFolderPaths.map((folderPath) => buildInFolderExpression(folderPath)),
		});
	}

	return {and: filters};
}

function buildInFolderExpression(folderPath: string): string {
	return `file.inFolder(${JSON.stringify(folderPath)})`;
}

function buildProjectGroupFormula(projects: readonly ProjectBaseViewTarget[]): string {
	const groupingOrder = [...projects].sort((left, right) =>
		getPathDepth(right.folderPath) - getPathDepth(left.folderPath)
		|| left.viewName.localeCompare(right.viewName)
		|| left.folderPath.localeCompare(right.folderPath));
	return groupingOrder.reduceRight(
		(fallback, project) => `if(${buildInFolderExpression(project.folderPath)}, ${JSON.stringify(project.viewName)}, ${fallback})`,
		'""',
	);
}

function createProjectViewDescriptors(
	projects: readonly ProjectBaseProjectLike[],
	projectInboxFolderPath: string,
	projectFileScope: ProjectBaseFileScope,
): Array<{excludedFolderPaths: string[]; folderPath: string; viewName: string}> {
	const usedNames = new Set<string>([TOTAL_VIEW_NAME]);
	const nameCounts = new Map<string, number>();

	const descriptors = projects.map((project) => {
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
			folderPath: projectFileScope === 'project'
				? project.folderPath
				: joinPath(project.folderPath, projectInboxFolderPath),
			viewName,
		};
	});

	return descriptors.map((descriptor, index) => ({
		...descriptor,
		excludedFolderPaths: [...new Set(descriptors
			.filter((candidate, candidateIndex) =>
				candidateIndex !== index && isPathInsideFolderPath(candidate.folderPath, descriptor.folderPath))
			.map((candidate) => candidate.folderPath))],
	}));
}

function getPathDepth(path: string): number {
	return path.length === 0 ? 0 : path.split('/').length;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
