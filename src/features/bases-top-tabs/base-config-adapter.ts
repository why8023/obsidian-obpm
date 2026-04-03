import {
	App,
	BasesConfigFile,
	BasesConfigFileView,
	BasesViewRegistration,
	IconName,
	TFile,
	getIconIds,
	parseYaml,
	stringifyYaml,
} from 'obsidian';
import {BasesTopTabsView, ParsedBaseFile, isObjectRecord} from './types';

interface BasesInternalPlugin {
	registrations?: Record<string, Partial<BasesViewRegistration>>;
}

interface InternalPluginsRegistry {
	getEnabledPluginById?: (id: string) => unknown;
}

type BaseConfigMutator = (config: BasesConfigFile, parsedBaseFile: ParsedBaseFile) => boolean;

const DEFAULT_VIEW_ICON: IconName = 'layout-template';
const FALLBACK_VIEW_ICONS: Record<string, IconName> = {
	cards: 'layout-grid',
	list: 'list',
	map: 'map',
	table: 'table',
	timeline: 'clock-3',
};

export class BaseConfigAdapter {
	private readonly availableIcons = buildAvailableIconIds();
	private readonly cache = new Map<string, {cacheKey: string; result: ParsedBaseFile | null}>();

	constructor(
		private readonly app: App,
		private readonly debugLog: (message: string, details?: unknown) => void,
	) {}

	forgetFile(filePath: string) {
		this.cache.delete(filePath);
	}

	async deleteView(file: TFile, viewKey: string): Promise<ParsedBaseFile | null> {
		return this.mutateBaseFile(file, 'delete a Base view', (config, parsedBaseFile) => {
			if (!Array.isArray(config.views) || config.views.length <= 1) {
				return false;
			}

			const targetView = parsedBaseFile.views.find((view) => view.key === viewKey);
			if (!targetView) {
				return false;
			}

			config.views.splice(targetView.index, 1);
			return true;
		});
	}

	async duplicateView(file: TFile, viewKey: string, nextName: string): Promise<ParsedBaseFile | null> {
		return this.mutateBaseFile(file, 'duplicate a Base view', (config, parsedBaseFile) => {
			if (!Array.isArray(config.views)) {
				return false;
			}

			const targetView = parsedBaseFile.views.find((view) => view.key === viewKey);
			if (!targetView) {
				return false;
			}

			const sourceView = config.views[targetView.index];
			const clonedView = clonePlainValue(sourceView);
			if (!isObjectRecord(clonedView)) {
				return false;
			}

			clonedView.name = nextName;
			config.views.splice(targetView.index + 1, 0, clonedView);
			return true;
		});
	}

	async readBaseFile(file: TFile): Promise<ParsedBaseFile | null> {
		const cacheKey = `${file.stat.mtime}:${file.stat.size}`;
		const cachedResult = this.cache.get(file.path);
		if (cachedResult?.cacheKey === cacheKey) {
			return cachedResult.result;
		}

		const result = await this.parseBaseFile(file);
		this.cache.set(file.path, {cacheKey, result});
		return result;
	}

	async renameView(file: TFile, viewKey: string, nextName: string): Promise<ParsedBaseFile | null> {
		return this.mutateBaseFile(file, 'rename a Base view', (config, parsedBaseFile) => {
			if (!Array.isArray(config.views)) {
				return false;
			}

			const targetView = parsedBaseFile.views.find((view) => view.key === viewKey);
			if (!targetView) {
				return false;
			}

			const rawView = config.views[targetView.index];
			if (!isObjectRecord(rawView)) {
				return false;
			}

			rawView.name = nextName;
			return true;
		});
	}

	async reorderViews(file: TFile, orderedKeys: string[]): Promise<ParsedBaseFile | null> {
		return this.mutateBaseFile(file, 'reorder Base views', (config, parsedBaseFile) => {
			if (!Array.isArray(config.views) || config.views.length <= 1) {
				return false;
			}

			const currentViews = config.views;
			const nextViews = buildReorderedViews(currentViews, parsedBaseFile.views, orderedKeys);
			if (nextViews === null) {
				return false;
			}

			const changed = nextViews.some((view, index) => view !== currentViews[index]);
			if (!changed) {
				return false;
			}

			config.views = nextViews;
			return true;
		});
	}

	private buildParsedBaseFile(file: TFile, parsedConfig: BasesConfigFile): ParsedBaseFile | null {
		const views = Array.isArray(parsedConfig.views)
			? parsedConfig.views
				.map((view, index) => this.normalizeView(view, index))
				.filter((view): view is BasesTopTabsView => view !== null)
			: [];
		if (views.length === 0) {
			return null;
		}

		return {
			file,
			filePath: file.path,
			views,
		};
	}

	private getInternalRegistration(viewType: string): Partial<BasesViewRegistration> | null {
		const internalPlugins = (this.app as App & {internalPlugins?: InternalPluginsRegistry}).internalPlugins;
		const basesPlugin = internalPlugins?.getEnabledPluginById?.('bases') as BasesInternalPlugin | undefined;
		return basesPlugin?.registrations?.[viewType] ?? null;
	}

	private isSupportedIcon(icon: unknown): icon is IconName {
		return typeof icon === 'string' && this.availableIcons.has(icon);
	}

	private async mutateBaseFile(
		file: TFile,
		action: string,
		mutator: BaseConfigMutator,
	): Promise<ParsedBaseFile | null> {
		let didChange = false;

		try {
			await this.app.vault.process(file, (content) => {
				const parsedConfig = this.parseBaseConfigContent(content, file.path);
				if (!parsedConfig) {
					return content;
				}

				const parsedBaseFile = this.buildParsedBaseFile(file, parsedConfig);
				if (!parsedBaseFile) {
					return content;
				}

				didChange = mutator(parsedConfig, parsedBaseFile);
				if (!didChange) {
					return content;
				}

				return ensureTrailingNewline(stringifyYaml(parsedConfig));
			});
		} catch (error) {
			this.debugLog(`Failed to ${action}.`, {
				error,
				filePath: file.path,
			});
			return null;
		}

		if (!didChange) {
			return this.readBaseFile(file);
		}

		this.forgetFile(file.path);
		return this.readBaseFile(file);
	}

	private normalizeView(view: unknown, index: number): BasesTopTabsView | null {
		if (!isObjectRecord(view)) {
			return null;
		}

		const type = typeof view.type === 'string' ? view.type.trim() : '';
		if (!type) {
			return null;
		}

		const rawName = typeof view.name === 'string' ? view.name.trim() : '';
		const name = rawName || `View ${index + 1}`;
		return {
			icon: this.resolveViewIcon(type),
			index,
			key: `${type}:${index}:${name}`,
			name,
			type,
		};
	}

	private async parseBaseFile(file: TFile): Promise<ParsedBaseFile | null> {
		let content: string;
		try {
			content = await this.app.vault.cachedRead(file);
		} catch (error) {
			this.debugLog('Failed to read a .base file.', {
				error,
				filePath: file.path,
			});
			return null;
		}

		const parsedConfig = this.parseBaseConfigContent(content, file.path);
		if (!parsedConfig) {
			return null;
		}

		return this.buildParsedBaseFile(file, parsedConfig);
	}

	private parseBaseConfigContent(content: string, filePath: string): BasesConfigFile | null {
		let parsedValue: unknown;
		try {
			parsedValue = parseYaml(content);
		} catch (error) {
			this.debugLog('Failed to parse a .base file as YAML.', {
				error,
				filePath,
			});
			return null;
		}

		if (!isObjectRecord(parsedValue)) {
			this.debugLog('Ignored a .base file because the YAML root is not an object.', {filePath});
			return null;
		}

		return parsedValue as BasesConfigFile;
	}

	private resolveViewIcon(viewType: string): IconName {
		const internalRegistration = this.getInternalRegistration(viewType);
		if (this.isSupportedIcon(internalRegistration?.icon)) {
			return internalRegistration.icon;
		}

		const fallbackIcon = FALLBACK_VIEW_ICONS[viewType] ?? DEFAULT_VIEW_ICON;
		return this.isSupportedIcon(fallbackIcon) ? fallbackIcon : DEFAULT_VIEW_ICON;
	}
}

function buildAvailableIconIds(): Set<string> {
	const allIconIds = new Set<string>();
	for (const iconId of getIconIds()) {
		allIconIds.add(iconId);
		if (iconId.startsWith('lucide-')) {
			allIconIds.add(iconId.slice('lucide-'.length));
		}
	}

	return allIconIds;
}

function buildReorderedViews(
	sourceViews: BasesConfigFileView[],
	parsedViews: BasesTopTabsView[],
	orderedKeys: string[],
): BasesConfigFileView[] | null {
	const viewsByKey = new Map(parsedViews.map((view) => [view.key, view]));
	const consumedKeys = new Set<string>();
	const reorderedViews: BasesConfigFileView[] = [];

	for (const viewKey of orderedKeys) {
		const parsedView = viewsByKey.get(viewKey);
		if (!parsedView || consumedKeys.has(viewKey)) {
			continue;
		}

		const sourceView = sourceViews[parsedView.index];
		if (!sourceView) {
			return null;
		}

		reorderedViews.push(sourceView);
		consumedKeys.add(viewKey);
	}

	for (const parsedView of parsedViews) {
		if (consumedKeys.has(parsedView.key)) {
			continue;
		}

		const sourceView = sourceViews[parsedView.index];
		if (!sourceView) {
			return null;
		}

		reorderedViews.push(sourceView);
	}

	return reorderedViews.length === sourceViews.length ? reorderedViews : null;
}

function clonePlainValue<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}

function ensureTrailingNewline(content: string): string {
	return content.endsWith('\n') ? content : `${content}\n`;
}
