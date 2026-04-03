import {Plugin} from 'obsidian';
import {BasesTopTabsFeature} from './features/bases-top-tabs/bases-top-tabs-feature';
import {FileNameSyncFeature} from './features/file-name-sync/file-name-sync-feature';
import {RelatedLinksFeature} from './features/related-links/related-links-feature';
import {normalizePluginSettings, OBPMPluginSettingTab, OBPMPluginSettings} from './settings';

export default class OBPMPlugin extends Plugin {
	settings: OBPMPluginSettings;
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
		const loadedData = await this.loadData() as Partial<OBPMPluginSettings> | null;
		this.settings = normalizePluginSettings(loadedData);
	}

	async saveSettings(options?: {refreshFeatures?: boolean}) {
		this.settings = normalizePluginSettings(this.settings);
		await this.saveData(this.settings);

		if (options?.refreshFeatures === false) {
			return;
		}

		await Promise.all([
			this.basesTopTabsFeature?.refresh(),
			this.relatedLinksFeature?.refresh(),
			this.fileNameSyncFeature?.refresh(),
		]);
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
}
