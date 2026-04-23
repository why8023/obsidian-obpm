import {Plugin} from 'obsidian';
import {BasesFileRevealFeature} from './features/bases-file-reveal/bases-file-reveal-feature';
import {BasesGroupFoldFeature} from './features/bases-group-fold/bases-group-fold-feature';
import {BasesTopTabsFeature} from './features/bases-top-tabs/bases-top-tabs-feature';
import {FileContentMoveFeature} from './features/file-content-move/file-content-move-feature';
import {FileNameSyncFeature} from './features/file-name-sync/file-name-sync-feature';
import {FrontmatterAutomationFeature} from './features/frontmatter-automation/frontmatter-automation-feature';
import {ProjectRoutingFeature} from './features/project-routing/project-routing-feature';
import {RelatedLinksFeature} from './features/related-links/related-links-feature';
import {SameFolderNoteFeature} from './features/same-folder-note/same-folder-note-feature';
import {normalizeRelatedLinksState} from './features/related-links/related-links-state-store';
import {RelatedLinksState} from './features/related-links/types';
import {RefreshableFeatureId, SaveSettingsOptions} from './save-settings-options';
import {normalizePluginSettings, OBPMPluginSettingTab, OBPMPluginSettings} from './settings';

interface OBPMPluginData extends Partial<OBPMPluginSettings> {
	relatedLinksState?: unknown;
}

export default class OBPMPlugin extends Plugin {
	settings: OBPMPluginSettings;
	private relatedLinksState: RelatedLinksState = normalizeRelatedLinksState(null);
	private basesFileRevealFeature: BasesFileRevealFeature | null = null;
	private basesGroupFoldFeature: BasesGroupFoldFeature | null = null;
	private basesTopTabsFeature: BasesTopTabsFeature | null = null;
	private fileContentMoveFeature: FileContentMoveFeature | null = null;
	private fileNameSyncFeature: FileNameSyncFeature | null = null;
	private frontmatterAutomationFeature: FrontmatterAutomationFeature | null = null;
	private projectRoutingFeature: ProjectRoutingFeature | null = null;
	private relatedLinksFeature: RelatedLinksFeature | null = null;

	async onload() {
		await this.loadSettings();

		this.basesFileRevealFeature = new BasesFileRevealFeature(this);
		this.addChild(this.basesFileRevealFeature);
		this.basesGroupFoldFeature = new BasesGroupFoldFeature(this);
		this.addChild(this.basesGroupFoldFeature);
		this.basesTopTabsFeature = new BasesTopTabsFeature(this);
		this.addChild(this.basesTopTabsFeature);
		this.fileContentMoveFeature = new FileContentMoveFeature(this);
		this.addChild(this.fileContentMoveFeature);
		this.relatedLinksFeature = new RelatedLinksFeature(this);
		this.addChild(this.relatedLinksFeature);
		this.fileNameSyncFeature = new FileNameSyncFeature(this);
		this.addChild(this.fileNameSyncFeature);
		this.frontmatterAutomationFeature = new FrontmatterAutomationFeature(this);
		this.addChild(this.frontmatterAutomationFeature);
		this.projectRoutingFeature = new ProjectRoutingFeature(this);
		this.addChild(this.projectRoutingFeature);
		this.addChild(new SameFolderNoteFeature(this));

		this.addCommand({
			id: 'sync-related-frontmatter-links',
			name: 'Full sync related frontmatter links',
			callback: async () => {
				if (!this.relatedLinksFeature) {
					return;
				}

				await this.relatedLinksFeature.runFullSync();
			},
		});

		this.addSettingTab(new OBPMPluginSettingTab(this.app, this));
	}

	async loadSettings() {
		const loadedData = await this.loadData() as OBPMPluginData | null;
		this.settings = normalizePluginSettings(loadedData);
		this.relatedLinksState = normalizeRelatedLinksState(loadedData?.relatedLinksState);
	}

	async saveSettings(options: SaveSettingsOptions = {refreshFeatures: false}) {
		this.settings = normalizePluginSettings(this.settings);
		await this.persistPluginData();

		const refreshFeatures = options.refreshFeatures;
		if (refreshFeatures === false || refreshFeatures === undefined || refreshFeatures.length === 0) {
			return;
		}

		await this.refreshConfiguredFeatures(refreshFeatures);
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

	private async refreshConfiguredFeatures(featureIds: readonly RefreshableFeatureId[]): Promise<void> {
		const refreshTasks: Promise<void>[] = [];

		for (const featureId of new Set(featureIds)) {
			switch (featureId) {
				case 'basesFileReveal':
					if (this.basesFileRevealFeature) {
						refreshTasks.push(this.basesFileRevealFeature.refresh());
					}
					break;
				case 'basesGroupFold':
					if (this.basesGroupFoldFeature) {
						refreshTasks.push(this.basesGroupFoldFeature.refresh());
					}
					break;
				case 'basesTopTabs':
					if (this.basesTopTabsFeature) {
						refreshTasks.push(this.basesTopTabsFeature.refresh());
					}
					break;
				case 'fileContentMove':
					if (this.fileContentMoveFeature) {
						refreshTasks.push(this.fileContentMoveFeature.refresh());
					}
					break;
				case 'relatedLinks':
					if (this.relatedLinksFeature) {
						refreshTasks.push(this.relatedLinksFeature.refresh());
					}
					break;
				case 'fileNameSync':
					if (this.fileNameSyncFeature) {
						refreshTasks.push(this.fileNameSyncFeature.refresh());
					}
					break;
				case 'projectRouting':
					if (this.projectRoutingFeature) {
						refreshTasks.push(this.projectRoutingFeature.refresh());
					}
					break;
				case 'frontmatterAutomation':
					if (this.frontmatterAutomationFeature) {
						refreshTasks.push(this.frontmatterAutomationFeature.refresh());
					}
					break;
			}
		}

		if (refreshTasks.length === 0) {
			return;
		}

		await Promise.all(refreshTasks);
	}

	private async persistPluginData(): Promise<void> {
		await this.saveData({
			...this.settings,
			relatedLinksState: this.relatedLinksState,
		});
	}
}
