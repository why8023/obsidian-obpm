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
	normalizeFrontmatterAutomationSettings,
} from './features/frontmatter-automation/frontmatter-automation-settings';
import {FrontmatterAutomationSettings} from './features/frontmatter-automation/frontmatter-automation-types';
import {
	createDefaultCurrentFileCommandRule,
	createDefaultProjectFileRule,
	createDefaultRoutableFileRule,
	normalizeFrontmatterMatchMode,
	normalizeProjectSubfolderPath,
	normalizeProjectRoutingSettings,
} from './features/project-routing/settings';
import {
	DEFAULT_PROJECT_FOLDER_SETTINGS,
	normalizeProjectFolderSettings,
	ProjectFolderSettings,
} from './features/project-folder/project-folder-settings';
import {normalizeProjectParentFolderPath} from './features/project-folder/project-folder-utils';
import {FrontmatterMatchRule, ProjectRoutingSettings} from './features/project-routing/types';
import {
	createDefaultPinnedRelationTargetRule,
	DEFAULT_PINNED_RELATION_TARGET_SETTINGS,
	normalizePinnedRelationTargetSettings,
	normalizePinnedRelationTargetPathMatchMode,
	PinnedRelationTargetRule,
	PinnedRelationTargetSettings,
	PinnedRelationTargetSettingsInput,
} from './features/pinned-project/pinned-relation-target-settings';
import {RefreshableFeatureId} from './save-settings-options';
import {getSettingsLocalization, SettingsLocalization} from './settings-localization';
import {
	renderFrontmatterAutomationSettingsSection as renderFrontmatterAutomationSection,
} from './settings-ui/frontmatter-automation-section';

export type BasesTopTabsPlacement = 'above-toolbar' | 'inside-toolbar';
export type BasesTopTabsOrientation = 'horizontal' | 'vertical';

const DEFAULT_BASES_TOP_TABS_MAX_VISIBLE_TABS = 8;
const MAX_BASES_TOP_TABS_MAX_VISIBLE_TABS = 50;
const MIN_BASES_TOP_TABS_MAX_VISIBLE_TABS = 0;
const DEFAULT_RELATED_LINKS_SECTION_HEADING = 'Related';
const DEFAULT_RELATED_LINKS_SECTION_HEADING_LEVEL = 2;
const MAX_RELATED_LINKS_SECTION_HEADING_LEVEL = 6;
const MIN_RELATED_LINKS_SECTION_HEADING_LEVEL = 1;
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

interface PinnedRelationTargetRuleListSectionOptions {
	addRuleButton: string;
	addRuleDesc: string;
	addRuleName: string;
	getRules: () => PinnedRelationTargetRule[];
	headingDesc: string;
	headingName: string;
	noRulesText: string;
	removeRuleButton: string;
	removeRuleDesc: string;
	removeRuleName: string;
	ruleLabel: (index: number) => string;
	setRules: (rules: PinnedRelationTargetRule[]) => void;
}

export interface RelatedLinksSettings {
	enabled: boolean;
	relationProperty: string;
	displayProperty: string;
	linkSectionHeading: string;
	linkSectionHeadingLevel: number;
	includeInheritedLinks: boolean;
	missingLinkGracePeriodSeconds: number;
	recognizeProjectMarkdownLinks: boolean;
	verboseLogging: boolean;
}

type RelatedLinksSettingsInput = Partial<RelatedLinksSettings> & {
	inboxHeading?: unknown;
};

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
	preserveSourceProperties: boolean;
	stripSingleH1: boolean;
}

export interface RelatedDocumentWorkflowSettings {
	enabled: boolean;
	targetSubfolderPath: string;
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
	projectFolder: ProjectFolderSettings;
	projectRouting: ProjectRoutingSettings;
	relatedDocumentWorkflow: RelatedDocumentWorkflowSettings;
	pinnedRelationTarget: PinnedRelationTargetSettings;
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
		preserveSourceProperties: false,
		stripSingleH1: true,
	},
	relatedLinks: {
		enabled: false,
		relationProperty: 'obpm_related',
		displayProperty: 'obpm_title',
		linkSectionHeading: DEFAULT_RELATED_LINKS_SECTION_HEADING,
		linkSectionHeadingLevel: DEFAULT_RELATED_LINKS_SECTION_HEADING_LEVEL,
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
	projectFolder: DEFAULT_PROJECT_FOLDER_SETTINGS,
	projectRouting: normalizeProjectRoutingSettings(undefined),
	relatedDocumentWorkflow: {
		enabled: false,
		targetSubfolderPath: 'related',
	},
	pinnedRelationTarget: DEFAULT_PINNED_RELATION_TARGET_SETTINGS,
	sameFolderNote: {
		enabled: false,
	},
};

export function normalizePluginSettings(
	settings: (Partial<OBPMPluginSettings> & PinnedRelationTargetSettingsInput) | null | undefined,
): OBPMPluginSettings {
	const relatedLinksInput = settings?.relatedLinks as RelatedLinksSettingsInput | undefined;

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
			preserveSourceProperties: normalizeBoolean(
				settings?.fileContentMove?.preserveSourceProperties,
				DEFAULT_SETTINGS.fileContentMove.preserveSourceProperties,
			),
			stripSingleH1: normalizeBoolean(
				settings?.fileContentMove?.stripSingleH1,
				DEFAULT_SETTINGS.fileContentMove.stripSingleH1,
			),
		},
		relatedLinks: {
			enabled: normalizeBoolean(relatedLinksInput?.enabled, DEFAULT_SETTINGS.relatedLinks.enabled),
			relationProperty: normalizeText(relatedLinksInput?.relationProperty, DEFAULT_SETTINGS.relatedLinks.relationProperty),
			displayProperty: normalizeText(relatedLinksInput?.displayProperty, DEFAULT_SETTINGS.relatedLinks.displayProperty),
			linkSectionHeading: normalizeRequiredText(
				relatedLinksInput?.linkSectionHeading ?? relatedLinksInput?.inboxHeading,
				DEFAULT_SETTINGS.relatedLinks.linkSectionHeading,
			),
			linkSectionHeadingLevel: normalizeRelatedLinksSectionHeadingLevel(
				relatedLinksInput?.linkSectionHeadingLevel,
				DEFAULT_SETTINGS.relatedLinks.linkSectionHeadingLevel,
			),
			includeInheritedLinks: normalizeBoolean(
				relatedLinksInput?.includeInheritedLinks,
				DEFAULT_SETTINGS.relatedLinks.includeInheritedLinks,
			),
			missingLinkGracePeriodSeconds: normalizeRelatedLinksMissingLinkGracePeriodSeconds(
				relatedLinksInput?.missingLinkGracePeriodSeconds,
				DEFAULT_SETTINGS.relatedLinks.missingLinkGracePeriodSeconds,
			),
			recognizeProjectMarkdownLinks: normalizeBoolean(
				relatedLinksInput?.recognizeProjectMarkdownLinks,
				DEFAULT_SETTINGS.relatedLinks.recognizeProjectMarkdownLinks,
			),
			verboseLogging: normalizeBoolean(relatedLinksInput?.verboseLogging, DEFAULT_SETTINGS.relatedLinks.verboseLogging),
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
		projectFolder: normalizeProjectFolderSettings(settings?.projectFolder),
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
		pinnedRelationTarget: normalizePinnedRelationTargetSettings(settings),
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

function normalizeRelatedLinksSectionHeadingLevel(value: unknown, fallback: number): number {
	if (typeof value === 'number' && Number.isInteger(value)) {
		return clamp(value, MIN_RELATED_LINKS_SECTION_HEADING_LEVEL, MAX_RELATED_LINKS_SECTION_HEADING_LEVEL);
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		const parsedValue = Number.parseInt(value, 10);
		if (Number.isInteger(parsedValue)) {
			return clamp(parsedValue, MIN_RELATED_LINKS_SECTION_HEADING_LEVEL, MAX_RELATED_LINKS_SECTION_HEADING_LEVEL);
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
					this.renderProjectFolderSettingsSection(panelBodyEl);
				});
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
					this.renderPinnedRelationTargetSettingsSection(panelBodyEl);
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
			.setName(strings.linkSectionHeadingName)
			.setDesc(strings.linkSectionHeadingDesc)
			.addText((text) => {
				text.setPlaceholder(strings.linkSectionHeadingPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.relatedLinks.linkSectionHeading,
					normalize: (value) => normalizeRequiredText(value, DEFAULT_SETTINGS.relatedLinks.linkSectionHeading),
					onCommit: (value) => {
						this.plugin.settings.relatedLinks.linkSectionHeading = value;
					},
					refreshFeatures: ['relatedLinks'],
				});
			});

		new Setting(containerEl)
			.setName(strings.linkSectionHeadingLevelName)
			.setDesc(strings.linkSectionHeadingLevelDesc(
				MIN_RELATED_LINKS_SECTION_HEADING_LEVEL,
				MAX_RELATED_LINKS_SECTION_HEADING_LEVEL,
				DEFAULT_RELATED_LINKS_SECTION_HEADING_LEVEL,
			))
			.addDropdown((dropdown) => {
				for (
					let level = MIN_RELATED_LINKS_SECTION_HEADING_LEVEL;
					level <= MAX_RELATED_LINKS_SECTION_HEADING_LEVEL;
					level += 1
				) {
					dropdown.addOption(level.toString(), strings.linkSectionHeadingLevelOption(level));
				}

				return dropdown
					.setValue(this.plugin.settings.relatedLinks.linkSectionHeadingLevel.toString())
					.onChange(async (value) => {
						this.plugin.settings.relatedLinks.linkSectionHeadingLevel = normalizeRelatedLinksSectionHeadingLevel(
							value,
							DEFAULT_SETTINGS.relatedLinks.linkSectionHeadingLevel,
						);
						await saveRelatedLinksSettings();
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
		renderFrontmatterAutomationSection({
			containerEl,
			display: () => this.display(),
			plugin: this.plugin,
			saveSettingsFor: (...features) => this.saveSettingsFor(...features),
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
			.setName(strings.fileContentMovePreserveSourcePropertiesName)
			.setDesc(strings.fileContentMovePreserveSourcePropertiesDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.fileContentMove.preserveSourceProperties)
				.onChange(async (value) => {
					this.plugin.settings.fileContentMove.preserveSourceProperties = value;
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

	private renderPinnedRelationTargetSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();
		const savePinnedRelationTargetSettings = async () => this.saveSettingsFor('pinnedRelationTarget');
		const targetPath = this.plugin.settings.pinnedRelationTarget.targetPath;

		new Setting(containerEl)
			.setName(strings.pinnedProjectHeading)
			.setDesc(strings.pinnedProjectDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.pinnedProjectEnableName)
			.setDesc(strings.pinnedProjectEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.pinnedRelationTarget.enabled)
				.onChange(async (value) => {
					this.plugin.settings.pinnedRelationTarget.enabled = value;
					await savePinnedRelationTargetSettings();
				}));

		const currentTargetSetting = new Setting(containerEl)
			.setName(strings.pinnedProjectCurrentName)
			.setDesc(
				targetPath
					? strings.pinnedProjectCurrentDesc(targetPath)
					: strings.pinnedProjectNoCurrentDesc,
			);
		if (targetPath) {
			currentTargetSetting.addButton((button) => button
				.setButtonText(strings.pinnedProjectClearButton)
				.onClick(async () => {
					this.plugin.settings.pinnedRelationTarget.enabled = false;
					this.plugin.settings.pinnedRelationTarget.targetPath = '';
					await savePinnedRelationTargetSettings();
					this.display();
				}));
		}

		this.renderPinnedRelationTargetRuleListSection(containerEl, {
			addRuleButton: strings.pinnedProjectAddIncludeRuleButton,
			addRuleDesc: strings.pinnedProjectAddIncludeRuleDesc,
			addRuleName: strings.pinnedProjectAddIncludeRuleName,
			getRules: () => this.plugin.settings.pinnedRelationTarget.includeRules,
			headingDesc: strings.pinnedProjectIncludeRulesDesc,
			headingName: strings.pinnedProjectIncludeRulesHeading,
			noRulesText: strings.pinnedProjectNoIncludeRules,
			removeRuleButton: strings.pinnedProjectRemoveIncludeRuleButton,
			removeRuleDesc: strings.pinnedProjectRemoveIncludeRuleDesc,
			removeRuleName: strings.pinnedProjectRemoveIncludeRuleName,
			ruleLabel: strings.pinnedProjectIncludeRuleLabel,
			setRules: (rules) => {
				this.plugin.settings.pinnedRelationTarget.includeRules = rules;
			},
		});

		this.renderPinnedRelationTargetRuleListSection(containerEl, {
			addRuleButton: strings.pinnedProjectAddExcludeRuleButton,
			addRuleDesc: strings.pinnedProjectAddExcludeRuleDesc,
			addRuleName: strings.pinnedProjectAddExcludeRuleName,
			getRules: () => this.plugin.settings.pinnedRelationTarget.excludeRules,
			headingDesc: strings.pinnedProjectExcludeRulesDesc,
			headingName: strings.pinnedProjectExcludeRulesHeading,
			noRulesText: strings.pinnedProjectNoExcludeRules,
			removeRuleButton: strings.pinnedProjectRemoveExcludeRuleButton,
			removeRuleDesc: strings.pinnedProjectRemoveExcludeRuleDesc,
			removeRuleName: strings.pinnedProjectRemoveExcludeRuleName,
			ruleLabel: strings.pinnedProjectExcludeRuleLabel,
			setRules: (rules) => {
				this.plugin.settings.pinnedRelationTarget.excludeRules = rules;
			},
		});
	}

	private renderPinnedRelationTargetRuleListSection(
		containerEl: HTMLElement,
		options: PinnedRelationTargetRuleListSectionOptions,
	): void {
		const strings = getSettingsLocalization();
		const savePinnedRelationTargetSettings = async () => this.saveSettingsFor('pinnedRelationTarget');

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
			const tableEl = tableWrapEl.createEl('table', {cls: 'obpm-rule-table obpm-rule-table-pinned-target'});
			const headerRowEl = tableEl.createEl('thead').createEl('tr');
			headerRowEl.createEl('th', {text: '#'});
			headerRowEl.createEl('th', {text: strings.pinnedProjectRuleSourceName});
			headerRowEl.createEl('th', {text: strings.pinnedProjectRuleKeyOrPathName});
			headerRowEl.createEl('th', {text: options.removeRuleButton});

			const bodyEl = tableEl.createEl('tbody');
			rules.forEach((rule, index) => {
				const rowEl = bodyEl.createEl('tr');
				rowEl.createEl('td', {
					cls: 'obpm-rule-table-index',
					text: String(index + 1),
				});

				const sourceSelectEl = rowEl.createEl('td').createEl('select', {
					attr: {
						'aria-label': `${options.ruleLabel(index + 1)} ${strings.pinnedProjectRuleSourceName}`,
					},
					cls: 'obpm-rule-table-select',
				});
				sourceSelectEl.createEl('option', {
					attr: {value: 'frontmatter'},
					text: strings.pinnedProjectRuleSourceFrontmatterLabel,
				});
				sourceSelectEl.createEl('option', {
					attr: {value: 'path'},
					text: strings.pinnedProjectRuleSourcePathLabel,
				});
				sourceSelectEl.value = rule.source;

				const conditionCellEl = rowEl.createEl('td');
				const conditionEl = conditionCellEl.createDiv({
					cls: rule.source === 'path'
						? 'obpm-pinned-rule-condition is-path-rule'
						: 'obpm-pinned-rule-condition',
				});

				const keyOrPathInputEl = conditionEl.createEl('input', {
					attr: {
						'aria-label': `${options.ruleLabel(index + 1)} ${strings.pinnedProjectRuleKeyOrPathName}`,
						placeholder: rule.source === 'path'
							? strings.pinnedProjectRulePathPlaceholder
							: strings.projectRoutingRuleKeyPlaceholder,
						type: 'text',
					},
					cls: 'obpm-rule-table-input',
					value: rule.source === 'path' ? rule.value : rule.key,
				});

				const matchModeSelectEl = conditionEl.createEl('select', {
					attr: {
						'aria-label': `${options.ruleLabel(index + 1)} ${strings.projectRoutingRuleMatchModeName}`,
					},
					cls: 'obpm-rule-table-select',
				});
				if (rule.source === 'path') {
					matchModeSelectEl.createEl('option', {
						attr: {value: 'path-contains'},
						text: strings.pinnedProjectPathMatchModeContainsLabel,
					});
					matchModeSelectEl.createEl('option', {
						attr: {value: 'path-starts-with'},
						text: strings.pinnedProjectPathMatchModeStartsWithLabel,
					});
					matchModeSelectEl.createEl('option', {
						attr: {value: 'path-glob'},
						text: strings.pinnedProjectPathMatchModeGlobLabel,
					});
				} else {
					matchModeSelectEl.createEl('option', {
						attr: {value: 'key-exists'},
						text: strings.projectRoutingMatchModeKeyExistsLabel,
					});
					matchModeSelectEl.createEl('option', {
						attr: {value: 'key-value-equals'},
						text: strings.projectRoutingMatchModeKeyValueEqualsLabel,
					});
				}
				matchModeSelectEl.value = rule.matchMode;

				const valueInputEl = conditionEl.createEl('input', {
					attr: {
						'aria-label': `${options.ruleLabel(index + 1)} ${strings.projectRoutingRuleValueName}`,
						placeholder: strings.projectRoutingRuleValuePlaceholder,
						type: 'text',
					},
					cls: 'obpm-rule-table-input',
					value: rule.source === 'frontmatter' ? rule.value ?? '' : '',
				});
				valueInputEl.disabled = rule.source === 'path' || rule.matchMode !== 'key-value-equals';
				valueInputEl.hidden = rule.source === 'path';

				const commitKeyOrPath = async () => {
					const nextRules = [...options.getRules()];
					const currentRule = nextRules[index] ?? rule;
					const nextValue = keyOrPathInputEl.value.trim()
						|| (currentRule.source === 'path' ? currentRule.value : currentRule.key);
					keyOrPathInputEl.value = nextValue;
					if (currentRule.source === 'path') {
						if (currentRule.value === nextValue) {
							return;
						}

						nextRules[index] = {
							...currentRule,
							value: nextValue,
						};
					} else {
						if (currentRule.key === nextValue) {
							return;
						}

						nextRules[index] = {
							...currentRule,
							key: nextValue,
						};
					}

					options.setRules(nextRules);
					await savePinnedRelationTargetSettings();
				};

				const commitValue = async () => {
					if (valueInputEl.disabled) {
						return;
					}

					const nextValue = valueInputEl.value.trim();
					valueInputEl.value = nextValue;
					const nextRules = [...options.getRules()];
					const currentRule = nextRules[index] ?? rule;
					if (currentRule.source !== 'frontmatter'
						|| currentRule.matchMode !== 'key-value-equals'
						|| currentRule.value === nextValue) {
						return;
					}

					nextRules[index] = {
						...currentRule,
						value: nextValue,
					};
					options.setRules(nextRules);
					await savePinnedRelationTargetSettings();
				};

				keyOrPathInputEl.addEventListener('change', () => {
					void commitKeyOrPath();
				});
				keyOrPathInputEl.addEventListener('keydown', (event) => {
					if (event.key !== 'Enter') {
						return;
					}

					event.preventDefault();
					void commitKeyOrPath();
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

				sourceSelectEl.addEventListener('change', () => {
					void (async () => {
						const nextRules = [...options.getRules()];
						const currentRule = nextRules[index] ?? rule;
						if (sourceSelectEl.value === currentRule.source) {
							return;
						}

						nextRules[index] = sourceSelectEl.value === 'path'
							? {
								matchMode: 'path-contains',
								source: 'path',
								value: currentRule.source === 'frontmatter' ? currentRule.key : currentRule.value,
							}
							: createDefaultPinnedRelationTargetRule();
						options.setRules(nextRules);
						await savePinnedRelationTargetSettings();
						this.display();
					})();
				});

				matchModeSelectEl.addEventListener('change', () => {
					void (async () => {
						const nextRules = [...options.getRules()];
						const currentRule = nextRules[index] ?? rule;
						if (currentRule.source === 'path') {
							const nextMatchMode = normalizePinnedRelationTargetPathMatchMode(
								matchModeSelectEl.value,
								currentRule.matchMode,
							);
							if (currentRule.matchMode === nextMatchMode) {
								return;
							}

							nextRules[index] = {
								...currentRule,
								matchMode: nextMatchMode,
							};
						} else {
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
									source: 'frontmatter',
								};
							valueInputEl.disabled = nextMatchMode !== 'key-value-equals';
							if (valueInputEl.disabled) {
								valueInputEl.value = '';
							}
						}

						options.setRules(nextRules);
						await savePinnedRelationTargetSettings();
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
						await savePinnedRelationTargetSettings();
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
					createDefaultPinnedRelationTargetRule(),
				]);
				await savePinnedRelationTargetSettings();
				this.display();
			})();
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
		const saveProjectRoutingSettings = async () => this.saveSettingsFor('projectRouting', 'projectFolder', 'relatedLinks');

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

	private renderProjectFolderSettingsSection(containerEl: HTMLElement): void {
		const strings = getSettingsLocalization();

		new Setting(containerEl)
			.setName(strings.projectFolderHeading)
			.setDesc(strings.projectFolderDesc)
			.setHeading();

		new Setting(containerEl)
			.setName(strings.projectFolderEnableName)
			.setDesc(strings.projectFolderEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectFolder.enabled)
				.onChange(async (value) => {
					this.plugin.settings.projectFolder.enabled = value;
					await this.saveSettingsFor('projectFolder');
				}));

		new Setting(containerEl)
			.setName(strings.projectFolderCreateProjectCommandEnableName)
			.setDesc(strings.projectFolderCreateProjectCommandEnableDesc)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.projectFolder.createProjectCommandEnabled)
				.onChange(async (value) => {
					this.plugin.settings.projectFolder.createProjectCommandEnabled = value;
					await this.saveSettingsFor();
				}));

		new Setting(containerEl)
			.setName(strings.projectFolderCreateProjectParentFolderPathName)
			.setDesc(strings.projectFolderCreateProjectParentFolderPathDesc)
			.addText((text) => {
				text.setPlaceholder(strings.projectFolderCreateProjectParentFolderPathPlaceholder);
				return this.bindCommittedTextSetting(text, {
					initialValue: this.plugin.settings.projectFolder.createProjectParentFolderPath,
					normalize: normalizeProjectParentFolderPath,
					onCommit: (value) => {
						this.plugin.settings.projectFolder.createProjectParentFolderPath = value;
					},
				});
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

	display(): void {
		const {containerEl} = this;
		const strings = getSettingsLocalization();
		containerEl.empty();
		const contentEl = this.renderSettingsPageChrome(containerEl, strings);
		this.renderActiveTab(contentEl);
	}
}
