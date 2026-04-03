import {App, BasesConfigFile, BasesViewRegistration, IconName, TFile, getIconIds, parseYaml} from 'obsidian';
import {BasesTopTabsView, ParsedBaseFile, isObjectRecord} from './types';

interface BasesInternalPlugin {
	registrations?: Record<string, Partial<BasesViewRegistration>>;
}

interface InternalPluginsRegistry {
	getEnabledPluginById?: (id: string) => unknown;
}

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

		let parsedConfig: BasesConfigFile;
		try {
			parsedConfig = parseYaml(content) as BasesConfigFile;
		} catch (error) {
			this.debugLog('Failed to parse a .base file as YAML.', {
				error,
				filePath: file.path,
			});
			return null;
		}

		const views = Array.isArray(parsedConfig.views)
			? parsedConfig.views
				.map((view, index) => this.normalizeView(view, index))
				.filter((view): view is BasesTopTabsView => view !== null)
			: [];
		if (views.length === 0) {
			return null;
		}

		const duplicateViewNames = findDuplicateNames(views.map((view) => view.name));
		if (duplicateViewNames.length > 0) {
			this.debugLog('Detected duplicate Base view names. The first matching name will be treated as active.', {
				duplicateViewNames,
				filePath: file.path,
			});
		}

		return {
			duplicateViewNames,
			filePath: file.path,
			views,
		};
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
			key: `${type}:${index}:${name}`,
			name,
			type,
		};
	}

	private resolveViewIcon(viewType: string): IconName {
		const internalRegistration = this.getInternalRegistration(viewType);
		if (this.isSupportedIcon(internalRegistration?.icon)) {
			return internalRegistration.icon;
		}

		const fallbackIcon = FALLBACK_VIEW_ICONS[viewType] ?? DEFAULT_VIEW_ICON;
		return this.isSupportedIcon(fallbackIcon) ? fallbackIcon : DEFAULT_VIEW_ICON;
	}

	private getInternalRegistration(viewType: string): Partial<BasesViewRegistration> | null {
		const internalPlugins = (this.app as App & {internalPlugins?: InternalPluginsRegistry}).internalPlugins;
		const basesPlugin = internalPlugins?.getEnabledPluginById?.('bases') as BasesInternalPlugin | undefined;
		return basesPlugin?.registrations?.[viewType] ?? null;
	}

	private isSupportedIcon(icon: unknown): icon is IconName {
		return typeof icon === 'string' && this.availableIcons.has(icon);
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

function findDuplicateNames(names: string[]): string[] {
	const counts = new Map<string, number>();
	for (const name of names) {
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}

	return [...counts.entries()]
		.filter(([, count]) => count > 1)
		.map(([name]) => name)
		.sort((left, right) => left.localeCompare(right));
}
