import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import OBPMPlugin from './main';
import {
	DEFAULT_FILE_NAME_MAX_LENGTH,
	MAX_FILE_NAME_MAX_LENGTH,
	MIN_FILE_NAME_MAX_LENGTH,
	normalizeFileNameMaxLength,
	normalizeInvalidCharacterReplacement,
} from './features/file-name-sync/file-name-sync-utils';

export interface RelatedLinksSettings {
	enabled: boolean;
	relationProperty: string;
	displayProperty: string;
	verboseLogging: boolean;
}

export interface FileNameSyncSettings {
	enabled: boolean;
	propertyName: string;
	invalidCharacterReplacement: string;
	maxFileNameLength: number;
}

export interface OBPMPluginSettings {
	relatedLinks: RelatedLinksSettings;
	fileNameSync: FileNameSyncSettings;
}

export const DEFAULT_SETTINGS: OBPMPluginSettings = {
	relatedLinks: {
		enabled: false,
		relationProperty: 'obpm_related',
		displayProperty: 'obpm_title',
		verboseLogging: false,
	},
	fileNameSync: {
		enabled: false,
		propertyName: 'title',
		invalidCharacterReplacement: '_',
		maxFileNameLength: DEFAULT_FILE_NAME_MAX_LENGTH,
	},
};

export function normalizePluginSettings(settings: Partial<OBPMPluginSettings> | null | undefined): OBPMPluginSettings {
	return {
		relatedLinks: {
			enabled: normalizeBoolean(settings?.relatedLinks?.enabled, DEFAULT_SETTINGS.relatedLinks.enabled),
			relationProperty: normalizeText(settings?.relatedLinks?.relationProperty, DEFAULT_SETTINGS.relatedLinks.relationProperty),
			displayProperty: normalizeText(settings?.relatedLinks?.displayProperty, DEFAULT_SETTINGS.relatedLinks.displayProperty),
			verboseLogging: normalizeBoolean(settings?.relatedLinks?.verboseLogging, DEFAULT_SETTINGS.relatedLinks.verboseLogging),
		},
		fileNameSync: {
			enabled: normalizeBoolean(settings?.fileNameSync?.enabled, DEFAULT_SETTINGS.fileNameSync.enabled),
			propertyName: normalizeText(settings?.fileNameSync?.propertyName, DEFAULT_SETTINGS.fileNameSync.propertyName),
			invalidCharacterReplacement: normalizeInvalidCharacterReplacement(
				settings?.fileNameSync?.invalidCharacterReplacement,
				DEFAULT_SETTINGS.fileNameSync.invalidCharacterReplacement,
			),
			maxFileNameLength: normalizeFileNameMaxLength(
				settings?.fileNameSync?.maxFileNameLength,
				DEFAULT_SETTINGS.fileNameSync.maxFileNameLength,
			),
		},
	};
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeText(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value.trim() : fallback;
}

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

		new Setting(containerEl)
			.setName('File names from property')
			.setHeading();

		new Setting(containerEl)
			.setName('Enable file name sync')
			.setDesc('Rename markdown files to match a frontmatter property when that property is present.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.fileNameSync.enabled)
				.onChange(async (value) => {
					this.plugin.settings.fileNameSync.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('File name property')
			.setDesc('Frontmatter property used to build the file name. Files without this property are left unchanged.')
			.addText((text) => text
				.setPlaceholder('Enter file name property')
				.setValue(this.plugin.settings.fileNameSync.propertyName)
				.onChange(async (value) => {
					this.plugin.settings.fileNameSync.propertyName = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Invalid character replacement')
			.setDesc('Replacement text for characters that are not allowed in file names. Leave empty to remove them.')
			.addText((text) => text
				.setPlaceholder('Enter replacement text')
				.setValue(this.plugin.settings.fileNameSync.invalidCharacterReplacement)
				.onChange(async (value) => {
					const normalizedValue = normalizeInvalidCharacterReplacement(value, DEFAULT_SETTINGS.fileNameSync.invalidCharacterReplacement);
					this.plugin.settings.fileNameSync.invalidCharacterReplacement = normalizedValue;
					await this.plugin.saveSettings();

					if (text.inputEl.value !== normalizedValue) {
						text.setValue(normalizedValue);
						new Notice('Replacement text cannot include characters that are invalid in file names.');
					}
				}));

		new Setting(containerEl)
			.setName('Maximum file name length')
			.setDesc(`Limit the markdown file basename to ${MIN_FILE_NAME_MAX_LENGTH}-${MAX_FILE_NAME_MAX_LENGTH} characters. Default: ${DEFAULT_FILE_NAME_MAX_LENGTH}.`)
			.addSlider((slider) => slider
				.setLimits(MIN_FILE_NAME_MAX_LENGTH, MAX_FILE_NAME_MAX_LENGTH, 1)
				.setDynamicTooltip()
				.setValue(this.plugin.settings.fileNameSync.maxFileNameLength)
				.onChange(async (value) => {
					this.plugin.settings.fileNameSync.maxFileNameLength = value;
					await this.plugin.saveSettings();
				}));
	}
}
