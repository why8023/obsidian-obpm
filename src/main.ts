import {Plugin} from 'obsidian';
import {BasesTopTabsFeature} from './features/bases-top-tabs/bases-top-tabs-feature';
import {FileNameSyncFeature} from './features/file-name-sync/file-name-sync-feature';
import {RelatedLinksFeature} from './features/related-links/related-links-feature';
import {normalizeRelatedLinksState} from './features/related-links/related-links-state-store';
import {RelatedLinksState} from './features/related-links/types';
import {normalizePluginSettings, OBPMPluginSettingTab, OBPMPluginSettings} from './settings';

interface OBPMPluginData extends Partial<OBPMPluginSettings> {
	relatedLinksState?: unknown;
}

export default class OBPMPlugin extends Plugin {
	settings: OBPMPluginSettings;
	private relatedLinksState: RelatedLinksState = normalizeRelatedLinksState(null);
	private basesTopTabsFeature: BasesTopTabsFeature | null = null;
	private fileNameSyncFeature: FileNameSyncFeature | null = null;
	private relatedLinksFeature: RelatedLinksFeature | null = null;

	async onload() {
		await this.loadSettings();

		this.basesTopTabsFeature = new BasesTopTabsFeature(this);
		this.addChild(this.basesTopTabsFeature);
		this.relatedLinksFeature = new RelatedLinksFeature(this);
		this.addChild(this.relatedLinksFeature);
		this.fileNameSyncFeature = new FileNameSyncFeature(this);
		this.addChild(this.fileNameSyncFeature);

		this.addCommand({
			id: 'sync-related-frontmatter-links',
			name: 'Full sync related frontmatter links',
			callback: async () => {
				if (!this.relatedLinksFeature) {
					return;
				}

				await this.relatedLinksFeature.runFullSync({force: true});
			},
		});

		this.addSettingTab(new OBPMPluginSettingTab(this.app, this));
	}

	async loadSettings() {
		const loadedData = await this.loadData() as OBPMPluginData | null;
		this.settings = normalizePluginSettings(loadedData);
		this.relatedLinksState = normalizeRelatedLinksState(loadedData?.relatedLinksState);
	}

	async saveSettings(options?: {refreshFeatures?: boolean}) {
		this.settings = normalizePluginSettings(this.settings);
		await this.persistPluginData();

		if (options?.refreshFeatures === false) {
			return;
		}

		await Promise.all([
			this.basesTopTabsFeature?.refresh(),
			this.relatedLinksFeature?.refresh(),
			this.fileNameSyncFeature?.refresh(),
		]);
	}

	getRelatedLinksState(): RelatedLinksState {
		return normalizeRelatedLinksState(this.relatedLinksState);
	}

	async saveRelatedLinksState(state: RelatedLinksState): Promise<void> {
		this.relatedLinksState = normalizeRelatedLinksState(state);
		await this.persistPluginData();
	}

	debugLog(message: string, details?: unknown) {
		this.debugFeatureLog('related-links', this.settings.relatedLinks.verboseLogging, message, details);
	}

	debugFeatureLog(feature: string, enabled: boolean, message: string, details?: unknown) {
		if (!enabled) {
			return;
		}

		const prefix = `[OBPM:${feature}] ${message}`;
		if (details === undefined) {
			console.debug(prefix);
			return;
		}

		console.debug(prefix, details);
	}

	private async persistPluginData(): Promise<void> {
		await this.saveData({
			...this.settings,
			relatedLinksState: this.relatedLinksState,
		});
	}
}
