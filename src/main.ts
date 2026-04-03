import {Plugin} from 'obsidian';
import {FileNameSyncFeature} from './features/file-name-sync/file-name-sync-feature';
import {RelatedLinksFeature} from './features/related-links/related-links-feature';
import {normalizePluginSettings, OBPMPluginSettingTab, OBPMPluginSettings} from './settings';

export default class OBPMPlugin extends Plugin {
	settings: OBPMPluginSettings;
	private fileNameSyncFeature: FileNameSyncFeature | null = null;
	private relatedLinksFeature: RelatedLinksFeature | null = null;

	async onload() {
		await this.loadSettings();

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

	async saveSettings() {
		this.settings = normalizePluginSettings(this.settings);
		await this.saveData(this.settings);
		await Promise.all([
			this.relatedLinksFeature?.refresh(),
			this.fileNameSyncFeature?.refresh(),
		]);
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
