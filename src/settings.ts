import {App, PluginSettingTab, Setting} from 'obsidian';
import OBPMPlugin from './main';

export interface RelatedLinksSettings {
	enabled: boolean;
	relationProperty: string;
	displayProperty: string;
	verboseLogging: boolean;
}

export interface OBPMPluginSettings {
	relatedLinks: RelatedLinksSettings;
}

export const DEFAULT_SETTINGS: OBPMPluginSettings = {
	relatedLinks: {
		enabled: false,
		relationProperty: 'obpm_related',
		displayProperty: 'obpm_title',
		verboseLogging: false,
	},
};

export class OBPMPluginSettingTab extends PluginSettingTab {
	plugin: OBPMPlugin;

	constructor(app: App, plugin: OBPMPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Related frontmatter links')
			.setHeading();

		new Setting(containerEl)
			.setName('Enable related frontmatter links')
			.setDesc('Automatically add this note into the notes referenced by a frontmatter property.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedLinks.enabled)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Relation property')
			.setDesc('Frontmatter property that points to the related notes, for example related.')
			.addText((text) => text
				.setPlaceholder('Enter relation property')
				.setValue(this.plugin.settings.relatedLinks.relationProperty)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.relationProperty = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Display property')
			.setDesc('Frontmatter property used as the link label. Falls back to the file name when empty.')
			.addText((text) => text
				.setPlaceholder('Enter display property')
				.setValue(this.plugin.settings.relatedLinks.displayProperty)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.displayProperty = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Verbose logging')
			.setDesc('Write detailed related-links synchronization logs to the developer console.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedLinks.verboseLogging)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.verboseLogging = value;
					await this.plugin.saveSettings();
				}));
	}
}
