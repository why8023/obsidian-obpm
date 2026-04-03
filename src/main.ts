import {Plugin} from 'obsidian';
import {RelatedLinksFeature} from './features/related-links/related-links-feature';
import {DEFAULT_SETTINGS, OBPMPluginSettingTab, OBPMPluginSettings} from './settings';

export default class OBPMPlugin extends Plugin {
	settings: OBPMPluginSettings;
	private relatedLinksFeature: RelatedLinksFeature | null = null;

	async onload() {
		await this.loadSettings();

		this.relatedLinksFeature = new RelatedLinksFeature(this);
		this.addChild(this.relatedLinksFeature);

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

		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedData,
			relatedLinks: {
				...DEFAULT_SETTINGS.relatedLinks,
				...loadedData?.relatedLinks,
			},
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.relatedLinksFeature?.refresh();
	}

	debugLog(message: string, details?: unknown) {
		if (!this.settings.relatedLinks.verboseLogging) {
			return;
		}

		if (details === undefined) {
			console.debug(`[OBPM] ${message}`);
			return;
		}

		console.debug(`[OBPM] ${message}`, details);
	}
}
