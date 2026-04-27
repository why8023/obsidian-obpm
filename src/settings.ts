import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import OBPMPlugin from './main';
import {
	DEFAULT_FILE_NAME_MAX_LENGTH,
	MAX_FILE_NAME_MAX_LENGTH,
	MIN_FILE_NAME_MAX_LENGTH,
	normalizeFileNameMaxLength,
	normalizeInvalidCharacterReplacement,
} from './features/file-name-sync/file-name-sync-utils';
import {
	createDefaultFrontmatterAutomationRule,
	normalizeFrontmatterAutomationSettings,
} from './features/frontmatter-automation/frontmatter-automation-settings';
import {
	FrontmatterAutomationActionType,
	FrontmatterAutomationRule,
	FrontmatterAutomationSettings,
	FrontmatterAutomationTriggerOperator,
	FrontmatterAutomationWriteMode,
} from './features/frontmatter-automation/frontmatter-automation-types';
import {
	createDefaultCurrentFileCommandRule,
	createDefaultProjectFileRule,
	createDefaultRoutableFileRule,
	normalizeFrontmatterMatchMode,
	normalizeProjectSubfolderPath,
	normalizeProjectRoutingSettings,
} from './features/project-routing/settings';
import {FrontmatterMatchRule, ProjectRoutingSettings} from './features/project-routing/types';
import {RefreshableFeatureId} from './save-settings-options';
import {getSettingsLocalization, SettingsLocalization} from './settings-localization';

export type BasesTopTabsPlacement = 'above-toolbar' | 'inside-toolbar';
export type BasesTopTabsOrientation = 'horizontal' | 'vertical';

const DEFAULT_BASES_TOP_TABS_MAX_VISIBLE_TABS = 8;
const MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS = 50;
const MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS = 0;
const DEFAULT_RELATED_LINKS_INBOX_HEADING = 'Inbox';
const DEFAULT_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS = 5;
const MAX_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS = 30;
const MIN_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS = 0;

interface CommittedTextSettingControl {
	inputEl: HTMLInputElement;
	setValue(value: string): unknown;
}

interface CommittedTextSettingOptions {
	initialValue: string;
	normalize: (value: string) => string;
	notice?: string;
	onCommit: (value: string) => void;
	refreshFeatures?: readonly RefreshableFeatureId[];
}

interface ProjectRoutingRuleListSectionOptions {
	addRuleButton: string;
	addRuleDesc: string;
	addRuleName: string;
	createRule: () => FrontmatterMatchRule;
	getRules: () => FrontmatterMatchRule[];
	headingDesc: string;
	headingName: string;
	noRulesText: string;
	removeRuleButton: string;
	removeRuleDesc: string;
	removeRuleName: string;
	refreshFeatures?: readonly RefreshableFeatureId[];
	ruleLabel: (index: number) => string;
	setRules: (rules: FrontmatterMatchRule[]) => void;
}

export interface RelatedLinksSettings {
	enabled: boolean;
	relationProperty: string;
	displayProperty: string;
	inboxHeading: string;
	includeInheritedLinks: boolean;
	missingLinkGracePeriodSeconds: number;
	recognizeProjectMarkdownLinks: boolean;
	verboseLogging: boolean;
}

export interface BasesFileRevealSettings {
	enabled: boolean;
}

export interface BasesTopTabsFileState {
	lastViewName: string | null;
	pinnedViewNames: string[];
}

export interface BasesGroupFoldViewState {
	collapsedGroupKeys: string[];
}

export interface BasesGroupFoldFileState {
	viewsState: Record<string, BasesGroupFoldViewState>;
}

export interface BasesGroupFoldSettings {
	debugMode: boolean;
	enabled: boolean;
	filesState: Record<string, BasesGroupFoldFileState>;
	rememberState: boolean;
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

export interface FileContentMoveSettings {
	enableFileExplorer: boolean;
	enabled: boolean;
	stripSingleH1: boolean;
}

export interface RelatedDocumentWorkflowSettings {
	enabled: boolean;
	targetSubfolderPath: string;
}

interface FrontmatterAutomationRuleListSectionOptions {
	addRuleButton: string;
	addRuleDesc: string;
	addRuleName: string;
	noRulesText: string;
	removeRuleButton: string;
	removeRuleDesc: string;
	removeRuleName: string;
	ruleLabel: (index: number) => string;
}

type SettingsPageTabId = 'bases' | 'metadata' | 'automation' | 'project' | 'workflow' | 'relations';

interface SettingsPageTabDefinition {
	description: string;
	id: SettingsPageTabId;
	label: string;
}

export interface SameFolderNoteSettings {
	enabled: boolean;
}

export interface OBPMPluginSettings {
	basesFileReveal: BasesFileRevealSettings;
	basesGroupFold: BasesGroupFoldSettings;
	basesTopTabs: BasesTopTabsSettings;
	fileContentMove: FileContentMoveSettings;
	relatedLinks: RelatedLinksSettings;
	fileNameSync: FileNameSyncSettings;
	frontmatterAutomation: FrontmatterAutomationSettings;
	projectRouting: ProjectRoutingSettings;
	relatedDocumentWorkflow: RelatedDocumentWorkflowSettings;
	sameFolderNote: SameFolderNoteSettings;
}

export const DEFAULT_SETTINGS: OBPMPluginSettings = {
	basesFileReveal: {
		enabled: false,
	},
	basesGroupFold: {
		debugMode: false,
		enabled: false,
		filesState: {},
		rememberState: true,
	},
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
	fileContentMove: {
		enableFileExplorer: true,
		enabled: false,
		stripSingleH1: true,
	},
	relatedLinks: {
		enabled: false,
		relationProperty: 'obpm_related',
		displayProperty: 'obpm_title',
		inboxHeading: DEFAULT_RELATED_LINKS_INBOX_HEADING,
		includeInheritedLinks: false,
		missingLinkGracePeriodSeconds: DEFAULT_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
		recognizeProjectMarkdownLinks: false,
		verboseLogging: false,
	},
	fileNameSync: {
		enabled: false,
		propertyName: 'obpm_title',
		invalidCharacterReplacement: '_',
		maxFileNameLength: DEFAULT_FILE_NAME_MAX_LENGTH,
	},
	frontmatterAutomation: normalizeFrontmatterAutomationSettings(undefined),
	projectRouting: normalizeProjectRoutingSettings(undefined),
	relatedDocumentWorkflow: {
		enabled: false,
		targetSubfolderPath: 'related',
	},
	sameFolderNote: {
		enabled: false,
	},
};

export function normalizePluginSettings(settings: Partial<OBPMPluginSettings> | null | undefined): OBPMPluginSettings {
	return {
		basesFileReveal: {
			enabled: normalizeBoolean(settings?.basesFileReveal?.enabled, DEFAULT_SETTINGS.basesFileReveal.enabled),
		},
		basesGroupFold: {
			debugMode: normalizeBoolean(settings?.basesGroupFold?.debugMode, DEFAULT_SETTINGS.basesGroupFold.debugMode),
			enabled: normalizeBoolean(settings?.basesGroupFold?.enabled, DEFAULT_SETTINGS.basesGroupFold.enabled),
			filesState: normalizeBasesGroupFoldFileStateMap(settings?.basesGroupFold?.filesState),
			rememberState: normalizeBoolean(
				settings?.basesGroupFold?.rememberState,
				DEFAULT_SETTINGS.basesGroupFold.rememberState,
			),
		},
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
		fileContentMove: {
			enableFileExplorer: normalizeBoolean(
				settings?.fileContentMove?.enableFileExplorer,
				DEFAULT_SETTINGS.fileContentMove.enableFileExplorer,
			),
			enabled: normalizeBoolean(settings?.fileContentMove?.enabled, DEFAULT_SETTINGS.fileContentMove.enabled),
			stripSingleH1: normalizeBoolean(
				settings?.fileContentMove?.stripSingleH1,
				DEFAULT_SETTINGS.fileContentMove.stripSingleH1,
			),
		},
		relatedLinks: {
			enabled: normalizeBoolean(settings?.relatedLinks?.enabled, DEFAULT_SETTINGS.relatedLinks.enabled),
			relationProperty: normalizeText(settings?.relatedLinks?.relationProperty, DEFAULT_SETTINGS.relatedLinks.relationProperty),
			displayProperty: normalizeText(settings?.relatedLinks?.displayProperty, DEFAULT_SETTINGS.relatedLinks.displayProperty),
			inboxHeading: normalizeRequiredText(
				settings?.relatedLinks?.inboxHeading,
				DEFAULT_SETTINGS.relatedLinks.inboxHeading,
			),
			includeInheritedLinks: normalizeBoolean(
				settings?.relatedLinks?.includeInheritedLinks,
				DEFAULT_SETTINGS.relatedLinks.includeInheritedLinks,
			),
			missingLinkGracePeriodSeconds: normalizeRelatedLinksMissingLinkGracePeriodSeconds(
				settings?.relatedLinks?.missingLinkGracePeriodSeconds,
				DEFAULT_SETTINGS.relatedLinks.missingLinkGracePeriodSeconds,
			),
			recognizeProjectMarkdownLinks: normalizeBoolean(
				settings?.relatedLinks?.recognizeProjectMarkdownLinks,
				DEFAULT_SETTINGS.relatedLinks.recognizeProjectMarkdownLinks,
			),
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
		frontmatterAutomation: normalizeFrontmatterAutomationSettings(settings?.frontmatterAutomation),
		projectRouting: normalizeProjectRoutingSettings(settings?.projectRouting),
		relatedDocumentWorkflow: {
			enabled: normalizeBoolean(
				settings?.relatedDocumentWorkflow?.enabled,
				DEFAULT_SETTINGS.relatedDocumentWorkflow.enabled,
			),
			targetSubfolderPath: normalizeProjectSubfolderPath(
				settings?.relatedDocumentWorkflow?.targetSubfolderPath,
				DEFAULT_SETTINGS.relatedDocumentWorkflow.targetSubfolderPath,
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

function normalizeRequiredText(value: unknown, fallback: string): string {
	const normalized = normalizeText(value, fallback);
	return normalized.length > 0 ? normalized : fallback;
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

function normalizeRelatedLinksMissingLinkGracePeriodSeconds(value: unknown, fallback: number): number {
	if (typeof value === 'number' && Number.isInteger(value)) {
		return clamp(
			value,
			MIN_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
			MAX_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
		);
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		const parsedValue = Number.parseInt(value, 10);
		if (Number.isInteger(parsedValue)) {
			return clamp(
				parsedValue,
				MIN_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
				MAX_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
			);
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

function normalizeBasesGroupFoldFileStateMap(value: unknown): Record<string, BasesGroupFoldFileState> {
	if (!isObjectRecord(value)) {
		return {};
	}

	const normalizedEntries = Object.entries(value)
		.map(([filePath, fileState]) => {
			const normalizedPath = typeof filePath === 'string' ? filePath.trim() : '';
			if (!normalizedPath || !isObjectRecord(fileState)) {
				return null;
			}

			const viewsState = normalizeBasesGroupFoldViewStateMap(fileState.viewsState);
			if (Object.keys(viewsState).length === 0) {
				return null;
			}

			return [normalizedPath, {viewsState}] as const;
		})
		.filter((entry): entry is readonly [string, BasesGroupFoldFileState] => entry !== null);

	return Object.fromEntries(normalizedEntries);
}

function normalizeBasesGroupFoldViewStateMap(value: unknown): Record<string, BasesGroupFoldViewState> {
	if (!isObjectRecord(value)) {
		return {};
	}

	const normalizedEntries = Object.entries(value)
		.map(([viewStateKey, viewState]) => {
			const normalizedViewStateKey = typeof viewStateKey === 'string' ? viewStateKey.trim() : '';
			if (!normalizedViewStateKey || !isObjectRecord(viewState)) {
				return null;
			}

			const collapsedGroupKeys = normalizeStringArray(viewState.collapsedGroupKeys);
			if (collapsedGroupKeys.length === 0) {
				return null;
			}

			return [normalizedViewStateKey, {collapsedGroupKeys}] as const;
		})
		.filter((entry): entry is readonly [string, BasesGroupFoldViewState] => entry !== null);

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
	private activeTab: SettingsPageTabId = 'bases';

	constructor(app: App, plugin: OBPMPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private getSettingsPageTabs(strings: SettingsLocalization): readonly SettingsPageTabDefinition[] {
		return [
			{
				description: strings.settingsTabBasesDesc,
				id: 'bases',
				label: strings.settingsTabBases,
			},
			{
				description: strings.settingsTabProjectDesc,
				id: 'project',
				label: strings.settingsTabProject,
			},
			{
				description: strings.settingsTabWorkflowDesc,
				id: 'workflow',
				label: strings.settingsTabWorkflow,
			},
			{
				description: strings.settingsTabAutomationDesc,
				id: 'automation',
				label: strings.settingsTabAutomation,
			},
			{
				description: strings.settingsTabMetadataDesc,
				id: 'metadata',
				label: strings.settingsTabMetadata,
			},
			{
				description: strings.settingsTabRelationsDesc,
				id: 'relations',
				label: strings.settingsTabRelations,
			},
		];
	}

	private bindCommittedTextSetting(
		text: CommittedTextSettingControl,
		options: CommittedTextSettingOptions,
	): CommittedTextSettingControl {
		let lastCommittedValue = options.initialValue;
		text.setValue(options.initialValue);

		const commitValue = async () => {
			const normalizedValue = options.normalize(text.inputEl.value);
			if (normalizedValue === lastCommittedValue && text.inputEl.value === normalizedValue) {
				return;
			}

			options.onCommit(normalizedValue);
			await this.saveSettingsFor(...(options.refreshFeatures ?? []));
			lastCommittedValue = normalizedValue;

			if (text.inputEl.value !== normalizedValue) {
				text.setValue(normalizedValue);
				if (options.notice) {
					new Notice(options.notice);
				}
			}
		};

		text.inputEl.addEventListener('change', () => {
			void commitValue();
		});
		text.inputEl.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') {
				return;
			}

			event.preventDefault();
			void commitValue();
		});

		return text;
	}

	private async saveSettingsFor(...features: RefreshableFeatureId[]): Promise<void> {
		await this.plugin.saveSettings({
			refreshFeatures: features.length > 0 ? features : false,
		});
	}

	private renderSettingsPageChrome(containerEl: HTMLElement, strings: SettingsLocalization): HTMLElement {
		containerEl.addClass('obpm-settings-root');

		const tabs = this.getSettingsPageTabs(strings);
		const activeTab = tabs.find((tab) => tab.id === this.activeTab) ?? tabs[0]!;
		this.activeTab = activeTab.id;

		const pageEl = containerEl.createDiv({cls: 'obpm-settings-page'});
		const heroEl = pageEl.createDiv({cls: 'obpm-settings-hero'});
		const titleSetting = new Setting(heroEl)
			.setName(strings.settingsPageTitle)
			.setHeading();
		titleSetting.settingEl.addClass('obpm-settings-page-heading');
		heroEl.createEl('p', {
			cls: 'obpm-settings-page-description',
			text: strings.settingsPageDesc,
		});

		const tabsEl = pageEl.createDiv({cls: 'obpm-settings-tabs-nav'});
		tabsEl.setAttr('role', 'tablist');

		tabs.forEach((tab) => {
			const buttonEl = tabsEl.createEl('button', {
				cls: 'obpm-settings-tab-button',
				text: tab.label,
			});
			buttonEl.type = 'button';
			buttonEl.setAttr('role', 'tab');
			buttonEl.setAttr('aria-selected', String(tab.id === activeTab.id));

			if (tab.id === activeTab.id) {
				buttonEl.addClass('is-active');
			}

			buttonEl.addEventListener('click', () => {
				if (this.activeTab === tab.id) {
					return;
				}

				this.activeTab = tab.id;
				this.display();
			});
		});

		pageEl.createEl('p', {
			cls: 'obpm-settings-tab-description',
			text: activeTab.description,
		});

		return pageEl.createDiv({cls: 'obpm-settings-tab-content'});
	}

	private renderSettingsPanel(
		containerEl: HTMLElement,
		renderContent: (panelBodyEl: HTMLElement) => void,
	): void {
		const panelEl = containerEl.createDiv({cls: 'obpm-settings-panel'});
		const panelBodyEl = panelEl.createDiv({cls: 'obpm-settings-panel-body'});
		renderContent(panelBodyEl);
	}

	private renderActiveTab(containerEl: HTMLElement): void {
		switch (this.activeTab) {
			case 'bases':
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderBasesFileRevealSettingsSection(panelBodyEl);
				});
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderBasesGroupFoldSettingsSection(panelBodyEl);
				});
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderBasesTopTabsSettingsSection(panelBodyEl);
				});
				break;
			case 'metadata':
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderFileNameSyncSettingsSection(panelBodyEl);
				});
				break;
			case 'relations':
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderRelatedLinksSettingsSection(panelBodyEl);
				});
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderProjectMarkdownRelationSettingsSection(panelBodyEl);
				});
				break;
			case 'automation':
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderFrontmatterAutomationSettingsSection(panelBodyEl);
				});
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderProjectRoutingSettingsSection(panelBodyEl);
				});
				break;
			case 'project':
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderProjectRecognitionSettingsSection(panelBodyEl);
				});
				break;
			case 'workflow':
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderFileContentMoveSettingsSection(panelBodyEl);
				});
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderRelatedDocumentWorkflowSettingsSection(panelBodyEl);
				});
				this.renderSettingsPanel(containerEl, (panelBodyEl) => {
					this.renderSameFolderNoteSettingsSection(panelBodyEl);
				});
				break;
		}
	}

	private renderBasesFileRevealSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveBasesFileRevealSettings = async () => this.saveSettingsFor('basesFileReveal');

		new Setting(containerEl)
			.setName(strings.basesFileRevealHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.basesFileRevealEnableName)
			.setDesc(strings.basesFileRevealEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesFileReveal.enabled)
				.onChange(async (value) => {
					this.plugin.settings.basesFileReveal.enabled = value;
					await saveBasesFileRevealSettings();
				}));
	}

	private renderBasesGroupFoldSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveBasesGroupFoldSettings = async () => this.saveSettingsFor('basesGroupFold');
		const saveWithoutRefresh = async () => this.saveSettingsFor();

		new Setting(containerEl)
			.setName(strings.basesGroupFoldHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.basesGroupFoldEnableName)
			.setDesc(strings.basesGroupFoldEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesGroupFold.enabled)
				.onChange(async (value) => {
					this.plugin.settings.basesGroupFold.enabled = value;
					await saveBasesGroupFoldSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesGroupFoldRememberStateName)
			.setDesc(strings.basesGroupFoldRememberStateDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesGroupFold.rememberState)
				.onChange(async (value) => {
					this.plugin.settings.basesGroupFold.rememberState = value;
					await saveWithoutRefresh();
				}));

		new Setting(containerEl)
			.setName(strings.basesGroupFoldDebugModeName)
			.setDesc(strings.basesGroupFoldDebugModeDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesGroupFold.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.basesGroupFold.debugMode = value;
					await saveWithoutRefresh();
				}));
	}

	private renderBasesTopTabsSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveBasesTopTabsSettings = async () => this.saveSettingsFor('basesTopTabs');
		const saveWithoutRefresh = async () => this.saveSettingsFor();

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
					await saveBasesTopTabsSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsShowIconsName)
			.setDesc(strings.basesTopTabsShowIconsDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.showIcons)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.showIcons = value;
					await saveBasesTopTabsSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsHideWhenSingleViewName)
			.setDesc(strings.basesTopTabsHideWhenSingleViewDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.hideWhenSingleView)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.hideWhenSingleView = value;
					await saveBasesTopTabsSettings();
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
					await saveBasesTopTabsSettings();
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
					await saveBasesTopTabsSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsScrollableName)
			.setDesc(strings.basesTopTabsScrollableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.scrollable)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.scrollable = value;
					await saveBasesTopTabsSettings();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsShowViewCountName)
			.setDesc(strings.basesTopTabsShowViewCountDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.showViewCount)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.showViewCount = value;
					await saveBasesTopTabsSettings();
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
					await saveBasesTopTabsSettings();

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
					await saveWithoutRefresh();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsAutoRefreshName)
			.setDesc(strings.basesTopTabsAutoRefreshDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.autoRefresh)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.autoRefresh = value;
					await saveWithoutRefresh();
				}));

		new Setting(containerEl)
			.setName(strings.basesTopTabsDebugModeName)
			.setDesc(strings.basesTopTabsDebugModeDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.basesTopTabs.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.basesTopTabs.debugMode = value;
					await saveWithoutRefresh();
				}));
	}

	private renderRelatedLinksSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveRelatedLinksSettings = async () => this.saveSettingsFor('relatedLinks');
		const saveWithoutRefresh = async () => this.saveSettingsFor();

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
					await saveRelatedLinksSettings();
				}));

		new Setting(containerEl)
			.setName(strings.relationPropertyName)
			.setDesc(strings.relationPropertyDesc)
			.addText((text) => {
				text.setPlaceholder(strings.relationPropertyPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.relatedLinks.relationProperty,
					normalize: (value) => value.trim(),
					onCommit: (value) => {
						this.plugin.settings.relatedLinks.relationProperty = value;
					},
					refreshFeatures: ['relatedLinks'],
				});
			});

		new Setting(containerEl)
			.setName(strings.displayPropertyName)
			.setDesc(strings.displayPropertyDesc)
			.addText((text) => {
				text.setPlaceholder(strings.displayPropertyPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.relatedLinks.displayProperty,
					normalize: (value) => value.trim(),
					onCommit: (value) => {
						this.plugin.settings.relatedLinks.displayProperty = value;
					},
					refreshFeatures: ['relatedLinks'],
				});
			});

		new Setting(containerEl)
			.setName(strings.inboxHeadingName)
			.setDesc(strings.inboxHeadingDesc)
			.addText((text) => {
				text.setPlaceholder(strings.inboxHeadingPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.relatedLinks.inboxHeading,
					normalize: (value) => normalizeRequiredText(value, DEFAULT_SETTINGS.relatedLinks.inboxHeading),
					onCommit: (value) => {
						this.plugin.settings.relatedLinks.inboxHeading = value;
					},
					refreshFeatures: ['relatedLinks'],
				});
			});

		new Setting(containerEl)
			.setName(strings.includeInheritedRelatedLinksName)
			.setDesc(strings.includeInheritedRelatedLinksDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedLinks.includeInheritedLinks)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.includeInheritedLinks = value;
					await saveRelatedLinksSettings();
				}));

		new Setting(containerEl)
			.setName(strings.missingLinkGracePeriodName)
			.setDesc(strings.missingLinkGracePeriodDesc(
				MIN_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
				MAX_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
				DEFAULT_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
			))
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = String(MIN_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS);
				text.inputEl.max = String(MAX_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS);
				text.inputEl.step = '1';
				text.setValue(this.plugin.settings.relatedLinks.missingLinkGracePeriodSeconds.toString());

				const applyValue = async () => {
					const normalizedValue = normalizeRelatedLinksMissingLinkGracePeriodSeconds(
						text.inputEl.value,
						DEFAULT_SETTINGS.relatedLinks.missingLinkGracePeriodSeconds,
					);
					this.plugin.settings.relatedLinks.missingLinkGracePeriodSeconds = normalizedValue;
					await saveRelatedLinksSettings();

					if (text.inputEl.value !== normalizedValue.toString()) {
						text.setValue(normalizedValue.toString());
						new Notice(strings.missingLinkGracePeriodNotice(
							MIN_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
							MAX_RELATED_LINKS_MISSING_LINK_GRACE_PERIOD_SECONDS,
						));
					}
				};

				text.inputEl.addEventListener('change', () => {
					void applyValue();
				});

				return text;
			});

		new Setting(containerEl)
			.setName(strings.verboseLoggingName)
			.setDesc(strings.verboseLoggingDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedLinks.verboseLogging)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.verboseLogging = value;
					await saveWithoutRefresh();
				}));
	}

	private renderProjectMarkdownRelationSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveRelatedLinksSettings = async () => this.saveSettingsFor('relatedLinks');

		new Setting(containerEl)
			.setName(strings.projectMarkdownRelationsHeading)
			.setDesc(strings.projectMarkdownRelationsDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.recognizeProjectMarkdownLinksName)
			.setDesc(strings.recognizeProjectMarkdownLinksDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedLinks.recognizeProjectMarkdownLinks)
				.onChange(async (value) => {
					this.plugin.settings.relatedLinks.recognizeProjectMarkdownLinks = value;
					await saveRelatedLinksSettings();
				}));
	}

	private renderFileNameSyncSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveFileNameSyncSettings = async () => this.saveSettingsFor('fileNameSync');

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
					await saveFileNameSyncSettings();
				}));

		new Setting(containerEl)
			.setName(strings.fileNamePropertyName)
			.setDesc(strings.fileNamePropertyDesc)
			.addText((text) => {
				text.setPlaceholder(strings.fileNamePropertyPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.fileNameSync.propertyName,
					normalize: (value) => value.trim(),
					onCommit: (value) => {
						this.plugin.settings.fileNameSync.propertyName = value;
					},
					refreshFeatures: ['fileNameSync'],
				});
			});

		new Setting(containerEl)
			.setName(strings.invalidCharacterReplacementName)
			.setDesc(strings.invalidCharacterReplacementDesc)
			.addText((text) => {
				text.setPlaceholder(strings.invalidCharacterReplacementPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.fileNameSync.invalidCharacterReplacement,
					normalize: (value) =>
						normalizeInvalidCharacterReplacement(value, DEFAULT_SETTINGS.fileNameSync.invalidCharacterReplacement),
					notice: strings.invalidCharacterReplacementNotice,
					onCommit: (value) => {
						this.plugin.settings.fileNameSync.invalidCharacterReplacement = value;
					},
					refreshFeatures: ['fileNameSync'],
				});
			});

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
					await saveFileNameSyncSettings();

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
	}

	private renderFrontmatterAutomationSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveFrontmatterAutomationSettings = async () => this.saveSettingsFor('frontmatterAutomation');

		new Setting(containerEl)
			.setName(strings.frontmatterAutomationHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.frontmatterAutomationEnableName)
			.setDesc(strings.frontmatterAutomationEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.frontmatterAutomation.enableFrontmatterAutomation)
				.onChange(async (value) => {
					this.plugin.settings.frontmatterAutomation.enableFrontmatterAutomation = value;
					await saveFrontmatterAutomationSettings();
				}));

		new Setting(containerEl)
			.setName(strings.frontmatterAutomationTimeFormatName)
			.setDesc(strings.frontmatterAutomationTimeFormatDesc)
			.addText((text) => {
				text.setPlaceholder(strings.frontmatterAutomationTimeFormatPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.frontmatterAutomation.timeFormat,
					normalize: (value) =>
						value.trim().length > 0
							? value.trim()
							: DEFAULT_SETTINGS.frontmatterAutomation.timeFormat,
					onCommit: (value) => {
						this.plugin.settings.frontmatterAutomation.timeFormat = value;
					},
					refreshFeatures: ['frontmatterAutomation'],
				});
			});

		this.renderFrontmatterAutomationRuleListSection(containerEl, {
			addRuleButton: strings.frontmatterAutomationAddRuleButton,
			addRuleDesc: strings.frontmatterAutomationAddRuleDesc,
			addRuleName: strings.frontmatterAutomationAddRuleName,
			noRulesText: strings.frontmatterAutomationNoRules,
			removeRuleButton: strings.frontmatterAutomationRemoveRuleButton,
			removeRuleDesc: strings.frontmatterAutomationRemoveRuleDesc,
			removeRuleName: strings.frontmatterAutomationRemoveRuleName,
			ruleLabel: strings.frontmatterAutomationRuleLabel,
		});
	}

	private renderSameFolderNoteSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveWithoutRefresh = async () => this.saveSettingsFor();

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
					await saveWithoutRefresh();
				}));
	}

	private renderFileContentMoveSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveFileContentMoveSettings = async () => this.saveSettingsFor('fileContentMove');
		const saveWithoutRefresh = async () => this.saveSettingsFor();

		new Setting(containerEl)
			.setName(strings.fileContentMoveHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.fileContentMoveEnableName)
			.setDesc(strings.fileContentMoveEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.fileContentMove.enabled)
				.onChange(async (value) => {
					this.plugin.settings.fileContentMove.enabled = value;
					await saveFileContentMoveSettings();
				}));

		new Setting(containerEl)
			.setName(strings.fileContentMoveStripSingleH1Name)
			.setDesc(strings.fileContentMoveStripSingleH1Desc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.fileContentMove.stripSingleH1)
				.onChange(async (value) => {
					this.plugin.settings.fileContentMove.stripSingleH1 = value;
					await saveWithoutRefresh();
				}));

		new Setting(containerEl)
			.setName(strings.fileContentMoveFileExplorerName)
			.setDesc(strings.fileContentMoveFileExplorerDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.fileContentMove.enableFileExplorer)
				.onChange(async (value) => {
					this.plugin.settings.fileContentMove.enableFileExplorer = value;
					await saveFileContentMoveSettings();
				}));
	}

	private renderRelatedDocumentWorkflowSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveRelatedDocumentWorkflowSettings = async () => this.saveSettingsFor('relatedDocumentWorkflow');

		new Setting(containerEl)
			.setName(strings.relatedDocumentWorkflowHeading)
			.setDesc(strings.relatedDocumentWorkflowDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.relatedDocumentWorkflowEnableName)
			.setDesc(strings.relatedDocumentWorkflowEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.relatedDocumentWorkflow.enabled)
				.onChange(async (value) => {
					this.plugin.settings.relatedDocumentWorkflow.enabled = value;
					await saveRelatedDocumentWorkflowSettings();
				}));

		new Setting(containerEl)
			.setName(strings.relatedDocumentWorkflowTargetSubfolderPathName)
			.setDesc(strings.relatedDocumentWorkflowTargetSubfolderPathDesc)
			.addText((text) => {
				text.setPlaceholder(strings.relatedDocumentWorkflowTargetSubfolderPathPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.relatedDocumentWorkflow.targetSubfolderPath,
					normalize: (value) => normalizeProjectSubfolderPath(
						value,
						this.plugin.settings.relatedDocumentWorkflow.targetSubfolderPath,
					),
					onCommit: (value) => {
						this.plugin.settings.relatedDocumentWorkflow.targetSubfolderPath = value;
					},
					refreshFeatures: ['relatedDocumentWorkflow'],
				});
			});
	}

	private renderProjectRoutingRuleListSection(
		containerEl: HTMLElement,
		options: ProjectRoutingRuleListSectionOptions,
	): void {
		const strings = getSettingsLocalization();
		const refreshFeatures: readonly RefreshableFeatureId[] = options.refreshFeatures ?? ['projectRouting'];
		const saveProjectRoutingSettings = async () => this.saveSettingsFor(...refreshFeatures);

		new Setting(containerEl)
			.setName(options.headingName)
			.setDesc(options.headingDesc)
			.setHeading();

		const rules = options.getRules();
		if (rules.length === 0) {
			containerEl.createEl('p', {
				cls: 'setting-item-description',
				text: options.noRulesText,
			});
		} else {
			const tableWrapEl = containerEl.createDiv({cls: 'obpm-rule-table-wrap'});
			const tableEl = tableWrapEl.createEl('table', {cls: 'obpm-rule-table'});
			const headerRowEl = tableEl.createEl('thead').createEl('tr');
			headerRowEl.createEl('th', {text: '#'});
			headerRowEl.createEl('th', {text: strings.projectRoutingRuleKeyName});
			headerRowEl.createEl('th', {text: strings.projectRoutingRuleMatchModeName});
			headerRowEl.createEl('th', {text: strings.projectRoutingRuleValueName});
			headerRowEl.createEl('th', {text: options.removeRuleButton});

			const bodyEl = tableEl.createEl('tbody');
			rules.forEach((rule, index) => {
				const rowEl = bodyEl.createEl('tr');
				rowEl.createEl('td', {
					cls: 'obpm-rule-table-index',
					text: String(index + 1),
				});

				const keyInputEl = rowEl.createEl('td').createEl('input', {
					attr: {
						'aria-label': `${options.ruleLabel(index + 1)} ${strings.projectRoutingRuleKeyName}`,
						placeholder: strings.projectRoutingRuleKeyPlaceholder,
						type: 'text',
					},
					cls: 'obpm-rule-table-input',
					value: rule.key,
				});

				const matchModeSelectEl = rowEl.createEl('td').createEl('select', {
					attr: {
						'aria-label': `${options.ruleLabel(index + 1)} ${strings.projectRoutingRuleMatchModeName}`,
					},
					cls: 'obpm-rule-table-select',
				});
				matchModeSelectEl.createEl('option', {
					attr: {value: 'key-exists'},
					text: strings.projectRoutingMatchModeKeyExistsLabel,
				});
				matchModeSelectEl.createEl('option', {
					attr: {value: 'key-value-equals'},
					text: strings.projectRoutingMatchModeKeyValueEqualsLabel,
				});
				matchModeSelectEl.value = rule.matchMode;

				const valueInputEl = rowEl.createEl('td').createEl('input', {
					attr: {
						'aria-label': `${options.ruleLabel(index + 1)} ${strings.projectRoutingRuleValueName}`,
						placeholder: strings.projectRoutingRuleValuePlaceholder,
						type: 'text',
					},
					cls: 'obpm-rule-table-input',
					value: rule.value ?? '',
				});
				valueInputEl.disabled = rule.matchMode !== 'key-value-equals';

				const commitKey = async () => {
					const nextRules = [...options.getRules()];
					const currentRule = nextRules[index] ?? rule;
					const nextValue = keyInputEl.value.trim() || currentRule.key;
					keyInputEl.value = nextValue;
					if (currentRule.key === nextValue) {
						return;
					}

					nextRules[index] = {
						...currentRule,
						key: nextValue,
					};
					options.setRules(nextRules);
					await saveProjectRoutingSettings();
				};

				const commitValue = async () => {
					if (valueInputEl.disabled) {
						return;
					}

					const nextValue = valueInputEl.value.trim();
					valueInputEl.value = nextValue;
					const nextRules = [...options.getRules()];
					const currentRule = nextRules[index] ?? rule;
					if (currentRule.matchMode !== 'key-value-equals' || currentRule.value === nextValue) {
						return;
					}

					nextRules[index] = {
						...currentRule,
						value: nextValue,
					};
					options.setRules(nextRules);
					await saveProjectRoutingSettings();
				};

				keyInputEl.addEventListener('change', () => {
					void commitKey();
				});
				keyInputEl.addEventListener('keydown', (event) => {
					if (event.key !== 'Enter') {
						return;
					}

					event.preventDefault();
					void commitKey();
				});
				valueInputEl.addEventListener('change', () => {
					void commitValue();
				});
				valueInputEl.addEventListener('keydown', (event) => {
					if (event.key !== 'Enter') {
						return;
					}

					event.preventDefault();
					void commitValue();
				});

				matchModeSelectEl.addEventListener('change', () => {
					void (async () => {
						const nextRules = [...options.getRules()];
						const currentRule = nextRules[index] ?? rule;
						const nextMatchMode = normalizeFrontmatterMatchMode(matchModeSelectEl.value, currentRule.matchMode);
						nextRules[index] = nextMatchMode === 'key-value-equals'
							? {
								...currentRule,
								matchMode: nextMatchMode,
								value: currentRule.value ?? valueInputEl.value.trim(),
							}
							: {
								key: currentRule.key,
								matchMode: nextMatchMode,
							};
						options.setRules(nextRules);
						valueInputEl.disabled = nextMatchMode !== 'key-value-equals';
						if (valueInputEl.disabled) {
							valueInputEl.value = '';
						}

						await saveProjectRoutingSettings();
					})();
				});

				const actionCellEl = rowEl.createEl('td', {cls: 'obpm-rule-table-action'});
				const removeButtonEl = actionCellEl.createEl('button', {
					cls: 'mod-warning',
					text: options.removeRuleButton,
				});
				removeButtonEl.type = 'button';
				removeButtonEl.setAttr('aria-label', `${options.removeRuleName}: ${options.ruleLabel(index + 1)}`);
				removeButtonEl.setAttr('title', options.removeRuleDesc);
				removeButtonEl.addEventListener('click', () => {
					void (async () => {
						const nextRules = [...options.getRules()];
						nextRules.splice(index, 1);
						options.setRules(nextRules);
						await saveProjectRoutingSettings();
						this.display();
					})();
				});
			});
		}

		const footerEl = containerEl.createDiv({cls: 'obpm-rule-table-footer'});
		const footerTextEl = footerEl.createDiv({cls: 'obpm-rule-table-footer-text'});
		footerTextEl.createDiv({
			cls: 'obpm-rule-table-footer-name',
			text: options.addRuleName,
		});
		footerTextEl.createDiv({
			cls: 'obpm-rule-table-footer-desc',
			text: options.addRuleDesc,
		});

		const addButtonEl = footerEl.createEl('button', {text: options.addRuleButton});
		addButtonEl.type = 'button';
		addButtonEl.addEventListener('click', () => {
			void (async () => {
				options.setRules([
					...options.getRules(),
					options.createRule(),
				]);
				await saveProjectRoutingSettings();
				this.display();
			})();
		});
	}

	private renderProjectRecognitionSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveProjectRoutingSettings = async () => this.saveSettingsFor('projectRouting', 'relatedLinks');

		new Setting(containerEl)
			.setName(strings.projectRoutingProjectRuleHeading)
			.setDesc(strings.projectRoutingProjectRuleDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.projectRoutingDuplicateProjectDetectionName)
			.setDesc(strings.projectRoutingDuplicateProjectDetectionDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.detectDuplicateProjectFiles)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.detectDuplicateProjectFiles = value;
					await saveProjectRoutingSettings();
				}));

		new Setting(containerEl)
			.setName(strings.projectRoutingRecognizeFilenameMatchesFolderNameName)
			.setDesc(strings.projectRoutingRecognizeFilenameMatchesFolderNameDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.recognizeFilenameMatchesFolderAsProject)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.recognizeFilenameMatchesFolderAsProject = value;
					await saveProjectRoutingSettings();
				}));

		this.renderProjectRoutingRuleListSection(containerEl, {
			addRuleButton: strings.projectRoutingProjectFileAddRuleButton,
			addRuleDesc: strings.projectRoutingProjectFileAddRuleDesc,
			addRuleName: strings.projectRoutingProjectFileAddRuleName,
			createRule: createDefaultProjectFileRule,
			getRules: () => this.plugin.settings.projectRouting.projectFileRules,
			headingDesc: strings.projectRoutingProjectFileRulesDesc,
			headingName: strings.projectRoutingProjectFileRulesHeading,
			noRulesText: strings.projectRoutingNoProjectFileRules,
			removeRuleButton: strings.projectRoutingProjectFileRemoveRuleButton,
			removeRuleDesc: strings.projectRoutingProjectFileRemoveRuleDesc,
			removeRuleName: strings.projectRoutingProjectFileRemoveRuleName,
			refreshFeatures: ['projectRouting', 'relatedLinks'],
			ruleLabel: strings.projectRoutingProjectFileRuleLabel,
			setRules: (rules) => {
				this.plugin.settings.projectRouting.projectFileRules = rules;
			},
		});
	}

	private renderProjectRoutingSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const saveProjectRoutingSettings = async () => this.saveSettingsFor('projectRouting');
		const saveWithoutRefresh = async () => this.saveSettingsFor();

		new Setting(containerEl)
			.setName(strings.projectRoutingHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.projectRoutingEnableName)
			.setDesc(strings.projectRoutingEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.enabled)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.enabled = value;
					await saveProjectRoutingSettings();
				}));

		new Setting(containerEl)
			.setName(strings.projectRoutingAutoMoveName)
			.setDesc(strings.projectRoutingAutoMoveDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.autoMoveWhenSingleCandidate)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.autoMoveWhenSingleCandidate = value;
					await saveProjectRoutingSettings();
				}));

		new Setting(containerEl)
			.setName(strings.projectRoutingShowStatusBarName)
			.setDesc(strings.projectRoutingShowStatusBarDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.showStatusBar = value;
					await saveProjectRoutingSettings();
				}));

		new Setting(containerEl)
			.setName(strings.projectRoutingShowNoticeName)
			.setDesc(strings.projectRoutingShowNoticeDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.showNoticeAfterMove)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.showNoticeAfterMove = value;
					await saveProjectRoutingSettings();
				}));

		new Setting(containerEl)
			.setName(strings.projectRoutingDebugLogName)
			.setDesc(strings.projectRoutingDebugLogDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.debugLog)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.debugLog = value;
					await saveWithoutRefresh();
				}));

		new Setting(containerEl)
			.setName(strings.projectRoutingSubfolderPathName)
			.setDesc(strings.projectRoutingSubfolderPathDesc)
			.addText((text) => {
				text.setPlaceholder(strings.projectRoutingSubfolderPathPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.projectRouting.projectSubfolderPath,
					normalize: (value) => normalizeProjectSubfolderPath(
						value,
						this.plugin.settings.projectRouting.projectSubfolderPath,
					),
					onCommit: (value) => {
						this.plugin.settings.projectRouting.projectSubfolderPath = value;
					},
					refreshFeatures: ['projectRouting'],
				});
			});

		this.renderProjectRoutingRuleListSection(containerEl, {
			addRuleButton: strings.projectRoutingAddRuleButton,
			addRuleDesc: strings.projectRoutingAddRuleDesc,
			addRuleName: strings.projectRoutingAddRuleName,
			createRule: createDefaultRoutableFileRule,
			getRules: () => this.plugin.settings.projectRouting.routableFileRules,
			headingDesc: strings.projectRoutingRoutableRulesDesc,
			headingName: strings.projectRoutingRoutableRulesHeading,
			noRulesText: strings.projectRoutingNoRoutableRules,
			removeRuleButton: strings.projectRoutingRemoveRuleButton,
			removeRuleDesc: strings.projectRoutingRemoveRuleDesc,
			removeRuleName: strings.projectRoutingRemoveRuleName,
			ruleLabel: strings.projectRoutingRoutableRuleLabel,
			setRules: (rules) => {
				this.plugin.settings.projectRouting.routableFileRules = rules;
			},
		});

		new Setting(containerEl)
			.setName(strings.projectRoutingCurrentFileCommandHeading)
			.setDesc(strings.projectRoutingCurrentFileCommandDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.projectRoutingCurrentFileCommandLimitName)
			.setDesc(strings.projectRoutingCurrentFileCommandLimitDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectRouting.currentFileCommand.limitToMatchingFiles)
				.onChange(async (value) => {
					this.plugin.settings.projectRouting.currentFileCommand.limitToMatchingFiles = value;
					await saveProjectRoutingSettings();
				}));

		this.renderProjectRoutingRuleListSection(containerEl, {
			addRuleButton: strings.projectRoutingCurrentFileCommandAddRuleButton,
			addRuleDesc: strings.projectRoutingCurrentFileCommandAddRuleDesc,
			addRuleName: strings.projectRoutingCurrentFileCommandAddRuleName,
			createRule: createDefaultCurrentFileCommandRule,
			getRules: () => this.plugin.settings.projectRouting.currentFileCommand.matchRules,
			headingDesc: strings.projectRoutingCurrentFileCommandRulesDesc,
			headingName: strings.projectRoutingCurrentFileCommandRulesHeading,
			noRulesText: strings.projectRoutingCurrentFileCommandNoRules,
			removeRuleButton: strings.projectRoutingCurrentFileCommandRemoveRuleButton,
			removeRuleDesc: strings.projectRoutingCurrentFileCommandRemoveRuleDesc,
			removeRuleName: strings.projectRoutingCurrentFileCommandRemoveRuleName,
			ruleLabel: strings.projectRoutingCurrentFileCommandRuleLabel,
			setRules: (rules) => {
				this.plugin.settings.projectRouting.currentFileCommand.matchRules = rules;
			},
		});
	}

	private renderFrontmatterAutomationRuleListSection(
		containerEl: HTMLElement,
		options: FrontmatterAutomationRuleListSectionOptions,
	): void {
		const strings = getSettingsLocalization();
		const saveFrontmatterAutomationSettings = async () => this.saveSettingsFor('frontmatterAutomation');
		const rules = this.plugin.settings.frontmatterAutomation.rules;
		const bindCommittedInput = (
			inputEl: HTMLInputElement,
			getCurrentValue: () => string,
			onCommit: (value: string) => Promise<void>,
		) => {
			const commitValue = async () => {
				if (inputEl.disabled) {
					return;
				}

				const nextValue = inputEl.value.trim();
				inputEl.value = nextValue;
				if (getCurrentValue() === nextValue) {
					return;
				}

				await onCommit(nextValue);
			};

			inputEl.addEventListener('change', () => {
				void commitValue();
			});
			inputEl.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter') {
					return;
				}

				event.preventDefault();
				void commitValue();
			});
		};

		new Setting(containerEl)
			.setName(strings.frontmatterAutomationRulesHeading)
			.setDesc(strings.frontmatterAutomationRulesDesc)
			.setHeading();

		if (rules.length === 0) {
			containerEl.createEl('p', {
				cls: 'setting-item-description',
				text: options.noRulesText,
			});
		} else {
			const ruleListEl = containerEl.createDiv({cls: 'obpm-automation-rule-list'});
			rules.forEach((rule, index) => {
				const ruleLabel = options.ruleLabel(index + 1);
				const getLatestRule = () => {
					return this.plugin.settings.frontmatterAutomation.rules.find((existingRule) => existingRule.id === rule.id) ?? rule;
				};
				const updateRule = async (updater: (currentRule: FrontmatterAutomationRule) => FrontmatterAutomationRule) => {
					const nextRules = [...this.plugin.settings.frontmatterAutomation.rules];
					const ruleIndex = nextRules.findIndex((existingRule) => existingRule.id === rule.id);
					if (ruleIndex === -1) {
						return;
					}

					nextRules[ruleIndex] = updater(nextRules[ruleIndex]!);
					this.plugin.settings.frontmatterAutomation.rules = nextRules;
					await saveFrontmatterAutomationSettings();
				};
				const createFieldControl = (
					label: string,
					description: string,
					controlClass = '',
				) => {
					const fieldEl = formEl.createDiv({
						cls: `obpm-automation-rule-field${controlClass ? ` ${controlClass}` : ''}`,
					});
					fieldEl.createDiv({
						cls: 'obpm-automation-rule-field-label',
						text: label,
					});
					if (description) {
						fieldEl.createDiv({
							cls: 'obpm-automation-rule-field-desc',
							text: description,
						});
					}

					return fieldEl.createDiv({cls: 'obpm-automation-rule-field-control'});
				};
				const actionTypeLabel = getFrontmatterAutomationActionTypeLabel(rule.actionType, strings);
				const cardEl = ruleListEl.createDiv({cls: 'obpm-automation-rule-card'});
				const headerEl = cardEl.createDiv({cls: 'obpm-automation-rule-card-header'});
				const titleWrapEl = headerEl.createDiv({cls: 'obpm-automation-rule-card-title-wrap'});
				titleWrapEl.createDiv({
					cls: 'obpm-automation-rule-card-title',
					text: ruleLabel,
				});
				titleWrapEl.createDiv({
					cls: 'obpm-automation-rule-card-summary',
					text: `${rule.triggerField || strings.frontmatterAutomationTriggerFieldPlaceholder} -> ${actionTypeLabel}`,
				});
				const headerActionsEl = headerEl.createDiv({cls: 'obpm-automation-rule-card-actions'});
				const enabledInputEl = headerActionsEl.createEl('input', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationRuleEnabledName}`,
						type: 'checkbox',
					},
				});
				enabledInputEl.checked = rule.enabled;
				enabledInputEl.addEventListener('change', () => {
					void (async () => {
						await updateRule((currentRule) => ({
							...currentRule,
							enabled: enabledInputEl.checked,
						}));
					})();
				});
				const removeButtonEl = headerActionsEl.createEl('button', {
					cls: 'mod-warning',
					text: options.removeRuleButton,
				});
				removeButtonEl.type = 'button';
				removeButtonEl.setAttr('aria-label', `${options.removeRuleName}: ${ruleLabel}`);
				removeButtonEl.setAttr('title', `${options.removeRuleDesc} ${rule.id}`);
				removeButtonEl.addEventListener('click', () => {
					void (async () => {
						this.plugin.settings.frontmatterAutomation.rules =
							this.plugin.settings.frontmatterAutomation.rules.filter((existingRule) => existingRule.id !== rule.id);
						await saveFrontmatterAutomationSettings();
						this.display();
					})();
				});

				const formEl = cardEl.createDiv({cls: 'obpm-automation-rule-form'});
				const triggerFieldInputEl = createFieldControl(
					strings.frontmatterAutomationTriggerFieldName,
					strings.frontmatterAutomationTriggerFieldDesc,
				).createEl('input', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationTriggerFieldName}`,
						placeholder: strings.frontmatterAutomationTriggerFieldPlaceholder,
						type: 'text',
					},
					cls: 'obpm-rule-table-input',
					value: rule.triggerField,
				});
				bindCommittedInput(
					triggerFieldInputEl,
					() => getLatestRule().triggerField,
					async (value) => {
						await updateRule((currentRule) => ({
							...currentRule,
							triggerField: value,
						}));
					},
				);

				const triggerOperatorSelectEl = createFieldControl(
					strings.frontmatterAutomationTriggerOperatorName,
					strings.frontmatterAutomationTriggerOperatorDesc,
				).createEl('select', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationTriggerOperatorName}`,
					},
					cls: 'obpm-rule-table-select',
				});
				triggerOperatorSelectEl.createEl('option', {
					attr: {value: 'contains'},
					text: strings.frontmatterAutomationTriggerOperatorContainsLabel,
				});
				triggerOperatorSelectEl.createEl('option', {
					attr: {value: 'equals'},
					text: strings.frontmatterAutomationTriggerOperatorEqualsLabel,
				});
				triggerOperatorSelectEl.value = rule.triggerOperator;
				triggerOperatorSelectEl.addEventListener('change', () => {
					void (async () => {
						const triggerOperator = normalizeFrontmatterAutomationTriggerOperator(
							triggerOperatorSelectEl.value,
							getLatestRule().triggerOperator,
						);
						triggerOperatorSelectEl.value = triggerOperator;
						await updateRule((currentRule) => ({
							...currentRule,
							triggerOperator,
						}));
					})();
				});

				const triggerValueInputEl = createFieldControl(
					strings.frontmatterAutomationTriggerValueName,
					strings.frontmatterAutomationTriggerValueDesc,
				).createEl('input', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationTriggerValueName}`,
						placeholder: strings.frontmatterAutomationTriggerValuePlaceholder,
						type: 'text',
					},
					cls: 'obpm-rule-table-input',
					value: rule.triggerValue,
				});
				bindCommittedInput(
					triggerValueInputEl,
					() => getLatestRule().triggerValue,
					async (value) => {
						await updateRule((currentRule) => ({
							...currentRule,
							triggerValue: value,
						}));
					},
				);

				const actionTypeSelectEl = createFieldControl(
					strings.frontmatterAutomationActionTypeName,
					strings.frontmatterAutomationActionTypeDesc,
				).createEl('select', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationActionTypeName}`,
					},
					cls: 'obpm-rule-table-select',
				});
				actionTypeSelectEl.createEl('option', {
					attr: {value: 'set_current_time'},
					text: strings.frontmatterAutomationActionTypeCurrentTimeLabel,
				});
				actionTypeSelectEl.createEl('option', {
					attr: {value: 'set_static_value'},
					text: strings.frontmatterAutomationActionTypeStaticValueLabel,
				});
				actionTypeSelectEl.createEl('option', {
					attr: {value: 'ensure_project_folder'},
					text: strings.frontmatterAutomationActionTypeProjectFolderLabel,
				});
				actionTypeSelectEl.value = rule.actionType;
				actionTypeSelectEl.addEventListener('change', () => {
					void (async () => {
						const actionType = normalizeFrontmatterAutomationActionType(
							actionTypeSelectEl.value,
							getLatestRule().actionType,
						);
						actionTypeSelectEl.value = actionType;
						await updateRule((currentRule) => ({
							...currentRule,
							actionType,
						}));
						this.display();
					})();
				});

				if (rule.actionType === 'ensure_project_folder') {
					const targetSubfolderPathInputEl = createFieldControl(
						strings.frontmatterAutomationTargetSubfolderPathName,
						strings.frontmatterAutomationTargetSubfolderPathDesc,
						'obpm-automation-rule-field-wide',
					).createEl('input', {
						attr: {
							'aria-label': `${ruleLabel} ${strings.frontmatterAutomationTargetSubfolderPathName}`,
							placeholder: strings.frontmatterAutomationTargetSubfolderPathPlaceholder,
							type: 'text',
						},
						cls: 'obpm-rule-table-input',
						value: rule.targetSubfolderPath ?? '',
					});
					bindCommittedInput(
						targetSubfolderPathInputEl,
						() => getLatestRule().targetSubfolderPath ?? '',
						async (value) => {
							await updateRule((currentRule) => ({
								...currentRule,
								targetSubfolderPath: normalizeProjectSubfolderPath(
									value,
									currentRule.targetSubfolderPath ?? '',
								),
							}));
						},
					);
				} else {
					const targetFieldInputEl = createFieldControl(
						strings.frontmatterAutomationTargetFieldName,
						strings.frontmatterAutomationTargetFieldDesc,
					).createEl('input', {
						attr: {
							'aria-label': `${ruleLabel} ${strings.frontmatterAutomationTargetFieldName}`,
							placeholder: strings.frontmatterAutomationTargetFieldPlaceholder,
							type: 'text',
						},
						cls: 'obpm-rule-table-input',
						value: rule.targetField,
					});
					bindCommittedInput(
						targetFieldInputEl,
						() => getLatestRule().targetField,
						async (value) => {
							await updateRule((currentRule) => ({
								...currentRule,
								targetField: value,
							}));
						},
					);

					if (rule.actionType === 'set_static_value') {
						const staticValueInputEl = createFieldControl(
							strings.frontmatterAutomationStaticValueName,
							strings.frontmatterAutomationStaticValueDesc,
						).createEl('input', {
							attr: {
								'aria-label': `${ruleLabel} ${strings.frontmatterAutomationStaticValueName}`,
								placeholder: strings.frontmatterAutomationStaticValuePlaceholder,
								type: 'text',
							},
							cls: 'obpm-rule-table-input',
							value: rule.staticValue ?? '',
						});
						bindCommittedInput(
							staticValueInputEl,
							() => getLatestRule().staticValue ?? '',
							async (value) => {
								await updateRule((currentRule) => ({
									...currentRule,
									staticValue: value,
								}));
							},
						);
					}

					const writeModeSelectEl = createFieldControl(
						strings.frontmatterAutomationWriteModeName,
						strings.frontmatterAutomationWriteModeDesc,
					).createEl('select', {
						attr: {
							'aria-label': `${ruleLabel} ${strings.frontmatterAutomationWriteModeName}`,
						},
						cls: 'obpm-rule-table-select',
					});
					writeModeSelectEl.createEl('option', {
						attr: {value: 'always'},
						text: strings.frontmatterAutomationWriteModeAlwaysLabel,
					});
					writeModeSelectEl.createEl('option', {
						attr: {value: 'when-empty'},
						text: strings.frontmatterAutomationWriteModeWhenEmptyLabel,
					});
					writeModeSelectEl.value = rule.writeMode;
					writeModeSelectEl.addEventListener('change', () => {
						void (async () => {
							const writeMode = normalizeFrontmatterAutomationWriteMode(
								writeModeSelectEl.value,
								getLatestRule().writeMode,
							);
							writeModeSelectEl.value = writeMode;
							await updateRule((currentRule) => ({
								...currentRule,
								writeMode,
							}));
						})();
					});
				}
			});
		}

		const footerEl = containerEl.createDiv({cls: 'obpm-rule-table-footer'});
		const footerTextEl = footerEl.createDiv({cls: 'obpm-rule-table-footer-text'});
		footerTextEl.createDiv({
			cls: 'obpm-rule-table-footer-name',
			text: options.addRuleName,
		});
		footerTextEl.createDiv({
			cls: 'obpm-rule-table-footer-desc',
			text: options.addRuleDesc,
		});

		const addButtonEl = footerEl.createEl('button', {text: options.addRuleButton});
		addButtonEl.type = 'button';
		addButtonEl.addEventListener('click', () => {
			void (async () => {
				this.plugin.settings.frontmatterAutomation.rules = [
					...this.plugin.settings.frontmatterAutomation.rules,
					createDefaultFrontmatterAutomationRule({
						id: `frontmatter-automation-rule-${Date.now()}`,
					}),
				];
				await saveFrontmatterAutomationSettings();
				this.display();
			})();
		});
	}

	display(): void {
		const {containerEl} = this;
		const strings = getSettingsLocalization();
		containerEl.empty();
		const contentEl = this.renderSettingsPageChrome(containerEl, strings);
		this.renderActiveTab(contentEl);
	}
}

function normalizeFrontmatterAutomationActionType(
	value: string,
	fallback: FrontmatterAutomationActionType,
): FrontmatterAutomationActionType {
	if (value === 'ensure_project_folder' || value === 'set_current_time' || value === 'set_static_value') {
		return value;
	}

	return fallback;
}

function getFrontmatterAutomationActionTypeLabel(
	actionType: FrontmatterAutomationActionType,
	strings: SettingsLocalization,
): string {
	switch (actionType) {
		case 'ensure_project_folder':
			return strings.frontmatterAutomationActionTypeProjectFolderLabel;
		case 'set_static_value':
			return strings.frontmatterAutomationActionTypeStaticValueLabel;
		case 'set_current_time':
			return strings.frontmatterAutomationActionTypeCurrentTimeLabel;
	}
}

function normalizeFrontmatterAutomationTriggerOperator(
	value: string,
	fallback: FrontmatterAutomationTriggerOperator,
): FrontmatterAutomationTriggerOperator {
	return value === 'contains' ? 'contains' : value === 'equals' ? 'equals' : fallback;
}

function normalizeFrontmatterAutomationWriteMode(
	value: string,
	fallback: FrontmatterAutomationWriteMode,
): FrontmatterAutomationWriteMode {
	return value === 'when-empty' ? 'when-empty' : value === 'always' ? 'always' : fallback;
}
