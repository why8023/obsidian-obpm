import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import OBPMPlugin from './main';
import {
	DEFAULT_FILE_NAME_MAX_LENGTH,
	MAX_FILE_NAME_MAX_LENGTH,
	MIN_FILE_NAME_MAX_LENGTH,
	normalizeFileNameMaxLength,
	normalizeInvalidCharacterReplacement,
} from './features/file-name-sync/file-name-sync-utils';
import {getSettingsLocalization} from './settings-localization';

export type BasesTopTabsPlacement = 'above-toolbar' | 'inside-toolbar';
export type BasesTopTabsOrientation = 'horizontal' | 'vertical';

const DEFAULT_BASES_TOP_TABS_MAX_VISIBLE_TABS = 8;
const MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS = 50;
const MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS = 0;

export interface RelatedLinksSettings {
	enabled: boolean;
	relationProperty: string;
	displayProperty: string;
	verboseLogging: boolean;
}

export interface BasesTopTabsFileState {
	lastViewName: string | null;
	pinnedViewNames: string[];
}

export interface BasesTopTabsSettings {
	autoRefresh: boolean;
	debugMode: boolean;
	enabled: boolean;
	filesState: Record<string, BasesTopTabsFileState>;
	hideWhenSingleView: boolean;
	maxVisibleTabs: number;
	orientation: BasesTopTabsOrientation;
	placement: BasesTopTabsPlacement;
	rememberLastView: boolean;
	scrollable: boolean;
	showIcons: boolean;
	showViewCount: boolean;
}

export interface FileNameSyncSettings {
	enabled: boolean;
	propertyName: string;
	invalidCharacterReplacement: string;
	maxFileNameLength: number;
}

export interface SameFolderNoteSettings {
	enabled: boolean;
}

export interface OBPMPluginSettings {
	basesTopTabs: BasesTopTabsSettings;
	relatedLinks: RelatedLinksSettings;
	fileNameSync: FileNameSyncSettings;
	sameFolderNote: SameFolderNoteSettings;
}

export const DEFAULT_SETTINGS: OBPMPluginSettings = {
	basesTopTabs: {
		autoRefresh: true,
		debugMode: false,
		enabled: false,
		filesState: {},
		hideWhenSingleView: true,
		maxVisibleTabs: DEFAULT_BASES_TOP_TABS_MAX_VISIBLE_TABS,
		orientation: 'horizontal',
		placement: 'above-toolbar',
		rememberLastView: true,
		scrollable: true,
		showIcons: true,
		showViewCount: false,
	},
	relatedLinks: {
		enabled: false,
		relationProperty: 'obpm_related',
		displayProperty: 'obpm_title',
		verboseLogging: false,
	},
	fileNameSync: {
		enabled: false,
		propertyName: 'obpm_title',
		invalidCharacterReplacement: '_',
		maxFileNameLength: DEFAULT_FILE_NAME_MAX_LENGTH,
	},
	sameFolderNote: {
		enabled: false,
	},
};

export function normalizePluginSettings(settings: Partial<OBPMPluginSettings> | null | undefined): OBPMPluginSettings {
	return {
		basesTopTabs: {
			autoRefresh: normalizeBoolean(settings?.basesTopTabs?.autoRefresh, DEFAULT_SETTINGS.basesTopTabs.autoRefresh),
			debugMode: normalizeBoolean(settings?.basesTopTabs?.debugMode, DEFAULT_SETTINGS.basesTopTabs.debugMode),
			enabled: normalizeBoolean(settings?.basesTopTabs?.enabled, DEFAULT_SETTINGS.basesTopTabs.enabled),
			filesState: normalizeBasesTopTabsFileStateMap(settings?.basesTopTabs?.filesState),
			hideWhenSingleView: normalizeBoolean(
				settings?.basesTopTabs?.hideWhenSingleView,
				DEFAULT_SETTINGS.basesTopTabs.hideWhenSingleView,
			),
			maxVisibleTabs: normalizeBasesTopTabsMaxVisibleTabs(
				settings?.basesTopTabs?.maxVisibleTabs,
				DEFAULT_SETTINGS.basesTopTabs.maxVisibleTabs,
			),
			orientation: normalizeBasesTopTabsOrientation(
				settings?.basesTopTabs?.orientation,
				DEFAULT_SETTINGS.basesTopTabs.orientation,
			),
			placement: normalizeBasesTopTabsPlacement(
				settings?.basesTopTabs?.placement,
				DEFAULT_SETTINGS.basesTopTabs.placement,
			),
			rememberLastView: normalizeBoolean(
				settings?.basesTopTabs?.rememberLastView,
				DEFAULT_SETTINGS.basesTopTabs.rememberLastView,
			),
			scrollable: normalizeBoolean(settings?.basesTopTabs?.scrollable, DEFAULT_SETTINGS.basesTopTabs.scrollable),
			showIcons: normalizeBoolean(settings?.basesTopTabs?.showIcons, DEFAULT_SETTINGS.basesTopTabs.showIcons),
			showViewCount: normalizeBoolean(settings?.basesTopTabs?.showViewCount, DEFAULT_SETTINGS.basesTopTabs.showViewCount),
		},
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
		sameFolderNote: {
			enabled: normalizeBoolean(settings?.sameFolderNote?.enabled, DEFAULT_SETTINGS.sameFolderNote.enabled),
		},
	};
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeText(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeBasesTopTabsPlacement(value: unknown, fallback: BasesTopTabsPlacement): BasesTopTabsPlacement {
	return value === 'inside-toolbar' || value === 'above-toolbar' ? value : fallback;
}

function normalizeBasesTopTabsOrientation(value: unknown, fallback: BasesTopTabsOrientation): BasesTopTabsOrientation {
	return value === 'vertical' || value === 'horizontal' ? value : fallback;
}

function normalizeBasesTopTabsMaxVisibleTabs(value: unknown, fallback: number): number {
	if (typeof value === 'number' && Number.isInteger(value)) {
		return clamp(value, MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS, MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS);
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		const parsedValue = Number.parseInt(value, 10);
		if (Number.isInteger(parsedValue)) {
			return clamp(parsedValue, MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS, MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS);
		}
	}

	return fallback;
}

function normalizeBasesTopTabsFileStateMap(value: unknown): Record<string, BasesTopTabsFileState> {
	if (!isObjectRecord(value)) {
		return {};
	}

	const normalizedEntries = Object.entries(value)
		.map(([filePath, fileState]) => {
			const normalizedPath = typeof filePath === 'string' ? filePath.trim() : '';
			if (!normalizedPath || !isObjectRecord(fileState)) {
				return null;
			}

			const lastViewName = typeof fileState.lastViewName === 'string' && fileState.lastViewName.trim().length > 0
				? fileState.lastViewName.trim()
				: null;
			const pinnedViewNames = normalizeStringArray(fileState.pinnedViewNames);

			if (lastViewName === null && pinnedViewNames.length === 0) {
				return null;
			}

			return [normalizedPath, {lastViewName, pinnedViewNames}] as const;
		})
		.filter((entry): entry is readonly [string, BasesTopTabsFileState] => entry !== null);

	return Object.fromEntries(normalizedEntries);
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return [...new Set(value
		.filter((entry): entry is string => typeof entry === 'string')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0))];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export class OBPMPluginSettingTab extends PluginSettingTab {
	plugin: OBPMPlugin;

	constructor(app: App, plugin: OBPMPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		const strings = getSettingsLocalization();

		containerEl.empty();

		new Setting(containerEl)
			.setName(strings.basesTopTabsHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.basesTopTabsEnableName)
			.setDesc(strings.basesTopTabsEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.enabled)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsShowIconsName)
			.setDesc(strings.basesTopTabsShowIconsDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.showIcons)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.showIcons = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsHideWhenSingleViewName)
			.setDesc(strings.basesTopTabsHideWhenSingleViewDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.hideWhenSingleView)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.hideWhenSingleView = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsPlacementName)
			.setDesc(strings.basesTopTabsPlacementDesc)
			.addDropdown((dropdown) => dropdown
				.addOption('above-toolbar', strings.basesTopTabsPlacementAboveToolbarLabel)
				.addOption('inside-toolbar', strings.basesTopTabsPlacementInsideToolbarLabel)
				.setValue(this.plugin.settings.basesTopTabs.placement)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.placement = normalizeBasesTopTabsPlacement(
						value,
						DEFAULT_SETTINGS.basesTopTabs.placement,
					);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsOrientationName)
			.setDesc(strings.basesTopTabsOrientationDesc)
			.addDropdown((dropdown) => dropdown
				.addOption('horizontal', strings.basesTopTabsOrientationHorizontalLabel)
				.addOption('vertical', strings.basesTopTabsOrientationVerticalLabel)
				.setValue(this.plugin.settings.basesTopTabs.orientation)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.orientation = normalizeBasesTopTabsOrientation(
						value,
						DEFAULT_SETTINGS.basesTopTabs.orientation,
					);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsScrollableName)
			.setDesc(strings.basesTopTabsScrollableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.scrollable)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.scrollable = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsShowViewCountName)
			.setDesc(strings.basesTopTabsShowViewCountDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.showViewCount)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.showViewCount = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsMaxVisibleTabsName)
			.setDesc(strings.basesTopTabsMaxVisibleTabsDesc(
				MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS,
				MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS,
				DEFAULT_BASES_TOP_TABS_MAX_VISIBLE_TABS,
			))
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = String(MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS);
				text.inputEl.max = String(MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS);
				text.inputEl.step = '1';
				text.setValue(this.plugin.settings.basesTopTabs.maxVisibleTabs.toString());

				const applyValue = async () => {
					const normalizedValue = normalizeBasesTopTabsMaxVisibleTabs(
						text.inputEl.value,
						DEFAULT_SETTINGS.basesTopTabs.maxVisibleTabs,
					);
					this.plugin.settings.basesTopTabs.maxVisibleTabs = normalizedValue;
					await this.plugin.saveSettings();

					if (text.inputEl.value !== normalizedValue.toString()) {
						text.setValue(normalizedValue.toString());
						new Notice(strings.basesTopTabsMaxVisibleTabsNotice(
							MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS,
							MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS,
						));
					}
				};

				text.inputEl.addEventListener('change', () => {
					void applyValue();
				});

				return text;
			});

		new Setting(containerEl)
			.setName(strings.basesTopTabsRememberLastViewName)
			.setDesc(strings.basesTopTabsRememberLastViewDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.rememberLastView)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.rememberLastView = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsAutoRefreshName)
			.setDesc(strings.basesTopTabsAutoRefreshDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.autoRefresh = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsDebugModeName)
			.setDesc(strings.basesTopTabsDebugModeDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.debugMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.relatedLinksHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.enableRelatedLinksName)
			.setDesc(strings.enableRelatedLinksDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedLinks.enabled)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.relationPropertyName)
			.setDesc(strings.relationPropertyDesc)
			.addText((text) => text
				.setPlaceholder(strings.relationPropertyPlaceholder)
				.setValue(this.plugin.settings.relatedLinks.relationProperty)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.relationProperty = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.displayPropertyName)
			.setDesc(strings.displayPropertyDesc)
			.addText((text) => text
				.setPlaceholder(strings.displayPropertyPlaceholder)
				.setValue(this.plugin.settings.relatedLinks.displayProperty)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.displayProperty = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.verboseLoggingName)
			.setDesc(strings.verboseLoggingDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedLinks.verboseLogging)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.verboseLogging = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.fileNameSyncHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.enableFileNameSyncName)
			.setDesc(strings.enableFileNameSyncDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.fileNameSync.enabled)
				.onChange(async (value) => {
					this.plugin.settings.fileNameSync.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.fileNamePropertyName)
			.setDesc(strings.fileNamePropertyDesc)
			.addText((text) => text
				.setPlaceholder(strings.fileNamePropertyPlaceholder)
				.setValue(this.plugin.settings.fileNameSync.propertyName)
				.onChange(async (value) => {
					this.plugin.settings.fileNameSync.propertyName = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.invalidCharacterReplacementName)
			.setDesc(strings.invalidCharacterReplacementDesc)
			.addText((text) => text
				.setPlaceholder(strings.invalidCharacterReplacementPlaceholder)
				.setValue(this.plugin.settings.fileNameSync.invalidCharacterReplacement)
				.onChange(async (value) => {
					const normalizedValue = normalizeInvalidCharacterReplacement(value, DEFAULT_SETTINGS.fileNameSync.invalidCharacterReplacement);
					this.plugin.settings.fileNameSync.invalidCharacterReplacement = normalizedValue;
					await this.plugin.saveSettings();

					if (text.inputEl.value !== normalizedValue) {
						text.setValue(normalizedValue);
						new Notice(strings.invalidCharacterReplacementNotice);
					}
				}));

		new Setting(containerEl)
			.setName(strings.maxFileNameLengthName)
			.setDesc(strings.maxFileNameLengthDesc(
				MIN_FILE_NAME_MAX_LENGTH,
				MAX_FILE_NAME_MAX_LENGTH,
				DEFAULT_FILE_NAME_MAX_LENGTH,
			))
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = String(MIN_FILE_NAME_MAX_LENGTH);
				text.inputEl.max = String(MAX_FILE_NAME_MAX_LENGTH);
				text.inputEl.step = '1';
				text.setValue(this.plugin.settings.fileNameSync.maxFileNameLength.toString());

				const applyValue = async () => {
					const normalizedValue = normalizeFileNameMaxLength(
						text.inputEl.value,
						DEFAULT_SETTINGS.fileNameSync.maxFileNameLength,
					);
					this.plugin.settings.fileNameSync.maxFileNameLength = normalizedValue;
					await this.plugin.saveSettings();

					if (text.inputEl.value !== normalizedValue.toString()) {
						text.setValue(normalizedValue.toString());
						new Notice(strings.maxFileNameLengthNotice(
							MIN_FILE_NAME_MAX_LENGTH,
							MAX_FILE_NAME_MAX_LENGTH,
						));
					}
				};

				text.inputEl.addEventListener('change', () => {
					void applyValue();
				});

				return text;
			});

		new Setting(containerEl)
			.setName(strings.sameFolderNoteHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.enableSameFolderNoteName)
			.setDesc(strings.enableSameFolderNoteDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.sameFolderNote.enabled)
				.onChange(async (value) => {
					this.plugin.settings.sameFolderNote.enabled = value;
					await this.plugin.saveSettings();
				}));
	}
}
