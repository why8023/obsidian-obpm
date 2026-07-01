export interface ConfiguredFolderNoteCreationPlan {
	basename: string;
	filePath: string;
}

export interface BuildConfiguredFolderNoteCreationPlanOptions {
	defaultBasename: string;
	pathExists: (path: string) => boolean;
	targetFolderPath: string;
}

export interface BaseViewLike {
	filters?: unknown;
	name?: unknown;
	order?: unknown;
}

export interface BaseConfigLike {
	filters?: unknown;
	views?: unknown;
}

export type BaseFrontmatterTemplateResult =
	| {
		frontmatter: Record<string, unknown>;
		kind: 'success';
	}
	| {
		kind: 'folder-not-matched';
	}
	| {
		kind: 'view-not-found';
	};

export interface BuildBaseFrontmatterTemplateOptions {
	includeFilterDefaults: boolean;
	targetFolderPath: string;
	viewName: string;
}

export function buildConfiguredFolderNoteCreationPlan(
	options: BuildConfiguredFolderNoteCreationPlanOptions,
): ConfiguredFolderNoteCreationPlan {
	const targetFolderPath = normalizeConfiguredFolderPath(options.targetFolderPath);
	const defaultBasename = normalizeConfiguredFolderNoteBasename(options.defaultBasename) || 'Untitled';

	for (let index = 0; index < 10_000; index += 1) {
		const basename = index === 0 ? defaultBasename : `${defaultBasename} ${index}`;
		const filePath = joinPath(targetFolderPath, `${basename}.md`);
		if (!options.pathExists(filePath)) {
			return {
				basename,
				filePath,
			};
		}
	}

	const fallbackBasename = `${defaultBasename} ${Date.now()}`;
	return {
		basename: fallbackBasename,
		filePath: joinPath(targetFolderPath, `${fallbackBasename}.md`),
	};
}

export function buildBaseFrontmatterTemplate(
	config: BaseConfigLike,
	options: BuildBaseFrontmatterTemplateOptions,
): BaseFrontmatterTemplateResult {
	const view = findBaseViewByName(config, options.viewName);
	if (!view) {
		return {kind: 'view-not-found'};
	}

	const targetFolderPath = normalizeConfiguredFolderPath(options.targetFolderPath);
	if (!baseFilterIncludesFolder(config.filters, targetFolderPath)
		&& !baseFilterIncludesFolder(view.filters, targetFolderPath)) {
		return {kind: 'folder-not-matched'};
	}

	const frontmatter: Record<string, unknown> = {};
	for (const property of extractBaseViewOrderProperties(view)) {
		frontmatter[property] = null;
	}

	if (options.includeFilterDefaults) {
		for (const [property, value] of extractBaseFilterDefaultValues(config.filters)) {
			frontmatter[property] = value;
		}

		for (const [property, value] of extractBaseFilterDefaultValues(view.filters)) {
			frontmatter[property] = value;
		}
	}

	return {
		frontmatter,
		kind: 'success',
	};
}

export function buildMarkdownContentWithFrontmatter(
	frontmatter: Record<string, unknown>,
	stringifyYaml: (value: Record<string, unknown>) => string,
): string {
	if (Object.keys(frontmatter).length === 0) {
		return '';
	}

	const yaml = stringifyYaml(frontmatter).trimEnd();
	return yaml.length > 0 ? `---\n${yaml}\n---\n` : '';
}

export function normalizeBaseViewName(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

export function normalizeConfiguredBaseFilePath(value: unknown): string {
	return normalizeConfiguredFolderPath(value);
}

export function normalizeConfiguredFolderPath(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}

	return normalizeVaultPath(value)
		.split('/')
		.filter((segment) => segment !== '..')
		.join('/');
}

function baseFilterIncludesFolder(filter: unknown, targetFolderPath: string): boolean {
	return collectPositiveFilterExpressions(filter)
		.some((expression) => filterExpressionIncludesFolder(expression, targetFolderPath));
}

function collectPositiveFilterExpressions(filter: unknown): string[] {
	if (typeof filter === 'string') {
		return [filter];
	}

	if (Array.isArray(filter)) {
		return filter.flatMap((entry) => collectPositiveFilterExpressions(entry));
	}

	if (!isObjectRecord(filter)) {
		return [];
	}

	return Object.entries(filter).flatMap(([key, value]) => {
		if (key === 'not') {
			return [];
		}

		return collectPositiveFilterExpressions(value);
	});
}

function collectConjunctiveFilterExpressions(filter: unknown): string[] {
	if (typeof filter === 'string') {
		return [filter];
	}

	if (Array.isArray(filter)) {
		return filter.flatMap((entry) => collectConjunctiveFilterExpressions(entry));
	}

	if (!isObjectRecord(filter)) {
		return [];
	}

	if (hasOwn(filter, 'or') || hasOwn(filter, 'not')) {
		return [];
	}

	if (hasOwn(filter, 'and')) {
		return collectConjunctiveFilterExpressions(filter.and);
	}

	return [];
}

function extractBaseFilterDefaultValues(filter: unknown): Array<readonly [string, unknown]> {
	const defaults = new Map<string, unknown>();
	for (const expression of collectConjunctiveFilterExpressions(filter)) {
		const parsedDefault = parseSimpleEqualityDefault(expression);
		if (!parsedDefault) {
			continue;
		}

		defaults.set(parsedDefault.property, parsedDefault.value);
	}

	return [...defaults.entries()];
}

function extractBaseViewOrderProperties(view: BaseViewLike): string[] {
	if (!Array.isArray(view.order)) {
		return [];
	}

	const properties: string[] = [];
	const seenProperties = new Set<string>();
	for (const entry of view.order) {
		const property = normalizeBaseFrontmatterPropertyId(entry);
		if (!property || seenProperties.has(property)) {
			continue;
		}

		properties.push(property);
		seenProperties.add(property);
	}

	return properties;
}

function filterExpressionIncludesFolder(expression: string, targetFolderPath: string): boolean {
	const inFolderMatch = /\bfile\.inFolder\(\s*(['"])(.*?)\1\s*\)/.exec(expression);
	if (inFolderMatch?.[2] !== undefined) {
		return isFolderEqualOrInside(targetFolderPath, inFolderMatch[2]);
	}

	const folderEqualsMatch = /\bfile\.folder\s*==\s*(['"])(.*?)\1/.exec(expression);
	if (folderEqualsMatch?.[2] !== undefined) {
		return normalizeConfiguredFolderPath(targetFolderPath) === normalizeConfiguredFolderPath(folderEqualsMatch[2]);
	}

	return false;
}

function findBaseViewByName(config: BaseConfigLike, viewName: string): BaseViewLike | null {
	const normalizedViewName = normalizeBaseViewName(viewName);
	if (!normalizedViewName || !Array.isArray(config.views)) {
		return null;
	}

	for (const view of config.views) {
		if (!isObjectRecord(view)) {
			continue;
		}

		if (normalizeBaseViewName(view.name) === normalizedViewName) {
			return view;
		}
	}

	return null;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(record, key);
}

function isFolderEqualOrInside(targetFolderPath: string, baseFolderPath: string): boolean {
	const normalizedTarget = normalizeConfiguredFolderPath(targetFolderPath);
	const normalizedBase = normalizeConfiguredFolderPath(baseFolderPath);
	if (!normalizedBase) {
		return true;
	}

	return normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}/`);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function joinPath(folderPath: string, childPath: string): string {
	return folderPath.length > 0 ? normalizeVaultPath(`${folderPath}/${childPath}`) : normalizeVaultPath(childPath);
}

function normalizeBaseFrontmatterPropertyId(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}

	const trimmedValue = value.trim();
	if (!trimmedValue || trimmedValue.startsWith('file.') || trimmedValue.startsWith('formula.')) {
		return '';
	}

	return trimmedValue.startsWith('note.') ? trimmedValue.slice('note.'.length).trim() : trimmedValue;
}

function normalizeConfiguredFolderNoteBasename(value: string): string {
	const trimmedValue = value.trim();
	return trimmedValue.toLowerCase().endsWith('.md')
		? trimmedValue.slice(0, -3).trim()
		: trimmedValue;
}

function normalizeVaultPath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== '.')
		.join('/');
}

function parseSimpleEqualityDefault(expression: string): {property: string; value: unknown} | null {
	const match = /^\s*(?:note\.)?([A-Za-z_][\w-]*)\s*==\s*(?:"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?)|(true|false))\s*$/i.exec(expression);
	if (!match) {
		return null;
	}

	const [, rawProperty, doubleQuotedValue, singleQuotedValue, numberValue, booleanValue] = match;
	const property = normalizeBaseFrontmatterPropertyId(rawProperty);
	if (!property) {
		return null;
	}

	if (doubleQuotedValue !== undefined) {
		return {property, value: doubleQuotedValue};
	}

	if (singleQuotedValue !== undefined) {
		return {property, value: singleQuotedValue};
	}

	if (numberValue !== undefined) {
		return {property, value: Number(numberValue)};
	}

	return {property, value: booleanValue === 'true'};
}
