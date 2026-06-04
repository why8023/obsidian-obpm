import {Notice, Setting, ToggleComponent} from 'obsidian';
import OBPMPlugin from '../main';
import {
	DEFAULT_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL,
	DEFAULT_FRONTMATTER_AUTOMATION_PROJECT_MOVE_TIME_FORMAT,
	DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS,
	MAX_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL,
	MIN_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL,
	createDefaultFrontmatterAutomationRule,
	normalizeFrontmatterAutomationProjectContentHeadingLevel,
	normalizeFrontmatterAutomationProjectContentPlacementMode,
	normalizeFrontmatterAutomationProjectMoveTimePosition,
} from '../features/frontmatter-automation/frontmatter-automation-settings';
import {
	FrontmatterAutomationActionType,
	FrontmatterAutomationRule,
	FrontmatterAutomationTriggerOperator,
	FrontmatterAutomationWriteMode,
} from '../features/frontmatter-automation/frontmatter-automation-types';
import {normalizeProjectSubfolderPath} from '../features/project-routing/settings';
import {RefreshableFeatureId} from '../save-settings-options';
import {getSettingsLocalization, SettingsLocalization} from '../settings-localization';

interface CommittedTextSettingControl {
	inputEl: HTMLInputElement;
	setValue(value: string): unknown;
}

interface FrontmatterAutomationSectionOptions {
	containerEl: HTMLElement;
	display: () => void;
	plugin: OBPMPlugin;
	saveSettingsFor: (...features: RefreshableFeatureId[]) => Promise<void>;
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

interface CommittedTextSettingOptions {
	initialValue: string;
	normalize: (value: string) => string;
	notice?: string;
	onCommit: (value: string) => void;
	refreshFeatures?: readonly RefreshableFeatureId[];
}

const MAX_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_PARENT_HEADING_LEVEL =
	MAX_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL - 1;

export function renderFrontmatterAutomationSettingsSection(options: FrontmatterAutomationSectionOptions): void {
	const {containerEl, plugin} = options;
	const strings = getSettingsLocalization();
	const saveFrontmatterAutomationSettings = async () => options.saveSettingsFor('frontmatterAutomation');

	new Setting(containerEl)
		.setName(strings.frontmatterAutomationHeading)
		.setHeading();

	new Setting(containerEl)
		.setName(strings.frontmatterAutomationEnableName)
		.setDesc(strings.frontmatterAutomationEnableDesc)
		.addToggle((toggle) => toggle
			.setValue(plugin.settings.frontmatterAutomation.enableFrontmatterAutomation)
			.onChange(async (value) => {
				plugin.settings.frontmatterAutomation.enableFrontmatterAutomation = value;
				await saveFrontmatterAutomationSettings();
			}));

	new Setting(containerEl)
		.setName(strings.frontmatterAutomationTimeFormatName)
		.setDesc(strings.frontmatterAutomationTimeFormatDesc)
		.addText((text) => {
			text.setPlaceholder(strings.frontmatterAutomationTimeFormatPlaceholder);
			return bindCommittedTextSetting(text, {
				initialValue: plugin.settings.frontmatterAutomation.timeFormat,
				normalize: (value) => value.trim().length > 0
					? value.trim()
					: DEFAULT_FRONTMATTER_AUTOMATION_SETTINGS.timeFormat,
				onCommit: (value) => {
					plugin.settings.frontmatterAutomation.timeFormat = value;
				},
				refreshFeatures: ['frontmatterAutomation'],
			}, options.saveSettingsFor);
		});

	renderFrontmatterAutomationRuleListSection(options, {
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

function bindCommittedTextSetting(
	text: CommittedTextSettingControl,
	options: CommittedTextSettingOptions,
	saveSettingsFor: (...features: RefreshableFeatureId[]) => Promise<void>,
): CommittedTextSettingControl {
	let lastCommittedValue = options.initialValue;
	text.setValue(options.initialValue);

	const commitValue = async () => {
		const normalizedValue = options.normalize(text.inputEl.value);
		if (normalizedValue === lastCommittedValue && text.inputEl.value === normalizedValue) {
			return;
		}

		options.onCommit(normalizedValue);
		await saveSettingsFor(...(options.refreshFeatures ?? []));
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

function renderFrontmatterAutomationRuleListSection(
	sectionOptions: FrontmatterAutomationSectionOptions,
	options: FrontmatterAutomationRuleListSectionOptions,
): void {
	const {containerEl, display, plugin} = sectionOptions;
	const strings = getSettingsLocalization();
	const saveFrontmatterAutomationSettings = async () => sectionOptions.saveSettingsFor('frontmatterAutomation');
	const rules = plugin.settings.frontmatterAutomation.rules;
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
				return plugin.settings.frontmatterAutomation.rules.find((existingRule) => existingRule.id === rule.id) ?? rule;
			};
			const updateRule = async (updater: (currentRule: FrontmatterAutomationRule) => FrontmatterAutomationRule) => {
				const nextRules = [...plugin.settings.frontmatterAutomation.rules];
				const ruleIndex = nextRules.findIndex((existingRule) => existingRule.id === rule.id);
				if (ruleIndex === -1) {
					return;
				}

				nextRules[ruleIndex] = updater(nextRules[ruleIndex]!);
				plugin.settings.frontmatterAutomation.rules = nextRules;
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
			const enabledToggle = new ToggleComponent(headerActionsEl)
				.setValue(rule.enabled)
				.setTooltip(strings.frontmatterAutomationRuleEnabledDesc)
				.onChange(async (enabled) => {
					await updateRule((currentRule) => ({
						...currentRule,
						enabled,
					}));
				});
			enabledToggle.toggleEl.setAttribute('aria-label', `${ruleLabel} ${strings.frontmatterAutomationRuleEnabledName}`);
			const removeButtonEl = headerActionsEl.createEl('button', {
				cls: 'mod-warning',
				text: options.removeRuleButton,
			});
			removeButtonEl.type = 'button';
			removeButtonEl.setAttr('aria-label', `${options.removeRuleName}: ${ruleLabel}`);
			removeButtonEl.setAttr('title', `${options.removeRuleDesc} ${rule.id}`);
			removeButtonEl.addEventListener('click', () => {
				void (async () => {
					plugin.settings.frontmatterAutomation.rules =
						plugin.settings.frontmatterAutomation.rules.filter((existingRule) => existingRule.id !== rule.id);
					await saveFrontmatterAutomationSettings();
					display();
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
			actionTypeSelectEl.createEl('option', {
				attr: {value: 'send_content_to_project_file'},
				text: strings.frontmatterAutomationActionTypeProjectContentLabel,
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
					display();
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

				const moveTimeControlEl = createFieldControl(
					strings.frontmatterAutomationProjectMoveTimeEnabledName,
					strings.frontmatterAutomationProjectMoveTimeEnabledDesc,
				);
				const moveTimeToggle = new ToggleComponent(moveTimeControlEl)
					.setValue(rule.projectMoveTimeEnabled)
					.onChange(async (projectMoveTimeEnabled) => {
						await updateRule((currentRule) => ({
							...currentRule,
							projectMoveTimeEnabled,
						}));
						display();
					});
				moveTimeToggle.toggleEl.setAttribute(
					'aria-label',
					`${ruleLabel} ${strings.frontmatterAutomationProjectMoveTimeEnabledName}`,
				);

				if (rule.projectMoveTimeEnabled) {
					const moveTimeFormatInputEl = createFieldControl(
						strings.frontmatterAutomationProjectMoveTimeFormatName,
						strings.frontmatterAutomationProjectMoveTimeFormatDesc,
						'obpm-automation-rule-field-wide',
					).createEl('input', {
						attr: {
							'aria-label': `${ruleLabel} ${strings.frontmatterAutomationProjectMoveTimeFormatName}`,
							placeholder: strings.frontmatterAutomationProjectMoveTimeFormatPlaceholder,
							type: 'text',
						},
						cls: 'obpm-rule-table-input',
						value: rule.projectMoveTimeFormat,
					});
					bindCommittedInput(
						moveTimeFormatInputEl,
						() => getLatestRule().projectMoveTimeFormat,
						async (value) => {
							await updateRule((currentRule) => ({
								...currentRule,
								projectMoveTimeFormat: value.trim().length > 0
									? value.trim()
									: DEFAULT_FRONTMATTER_AUTOMATION_PROJECT_MOVE_TIME_FORMAT,
							}));
						},
					);

					const moveTimePositionSelectEl = createFieldControl(
						strings.frontmatterAutomationProjectMoveTimePositionName,
						strings.frontmatterAutomationProjectMoveTimePositionDesc,
					).createEl('select', {
						attr: {
							'aria-label': `${ruleLabel} ${strings.frontmatterAutomationProjectMoveTimePositionName}`,
						},
						cls: 'obpm-rule-table-select',
					});
					moveTimePositionSelectEl.createEl('option', {
						attr: {value: 'prefix'},
						text: strings.frontmatterAutomationProjectMoveTimePositionPrefixLabel,
					});
					moveTimePositionSelectEl.createEl('option', {
						attr: {value: 'suffix'},
						text: strings.frontmatterAutomationProjectMoveTimePositionSuffixLabel,
					});
					moveTimePositionSelectEl.value = rule.projectMoveTimePosition;
					moveTimePositionSelectEl.addEventListener('change', () => {
						void (async () => {
							const projectMoveTimePosition = normalizeFrontmatterAutomationProjectMoveTimePosition(
								moveTimePositionSelectEl.value,
								getLatestRule().projectMoveTimePosition,
							);
							moveTimePositionSelectEl.value = projectMoveTimePosition;
							await updateRule((currentRule) => ({
								...currentRule,
								projectMoveTimePosition,
							}));
						})();
					});
				}
			} else if (rule.actionType === 'send_content_to_project_file') {
				const placementModeSelectEl = createFieldControl(
					strings.frontmatterAutomationProjectContentPlacementModeName,
					strings.frontmatterAutomationProjectContentPlacementModeDesc,
				).createEl('select', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationProjectContentPlacementModeName}`,
					},
					cls: 'obpm-rule-table-select',
				});
				placementModeSelectEl.createEl('option', {
					attr: {value: 'target_heading'},
					text: strings.frontmatterAutomationProjectContentPlacementModeTargetHeadingLabel,
				});
				placementModeSelectEl.createEl('option', {
					attr: {value: 'source_name_heading'},
					text: strings.frontmatterAutomationProjectContentPlacementModeSourceNameHeadingLabel,
				});
				placementModeSelectEl.value = rule.projectContentPlacementMode;
				placementModeSelectEl.addEventListener('change', () => {
					void (async () => {
						const projectContentPlacementMode = normalizeFrontmatterAutomationProjectContentPlacementMode(
							placementModeSelectEl.value,
							getLatestRule().projectContentPlacementMode,
						);
						placementModeSelectEl.value = projectContentPlacementMode;
						await updateRule((currentRule) => ({
							...currentRule,
							projectContentHeadingLevel: normalizeProjectContentHeadingLevelForPlacement(
								currentRule.projectContentHeadingLevel,
								currentRule.projectContentHeadingLevel,
								projectContentPlacementMode,
							),
							projectContentPlacementMode,
						}));
						display();
					})();
				});

				const maxProjectContentHeadingLevel = getMaxProjectContentHeadingLevelForPlacement(
					rule.projectContentPlacementMode,
				);
				const projectContentHeadingLevel = normalizeProjectContentHeadingLevelForPlacement(
					rule.projectContentHeadingLevel,
					DEFAULT_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL,
					rule.projectContentPlacementMode,
				);
				const headingLevelSelectEl = createFieldControl(
					strings.frontmatterAutomationProjectContentHeadingLevelName,
					strings.frontmatterAutomationProjectContentHeadingLevelDesc(
						MIN_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL,
						maxProjectContentHeadingLevel,
						DEFAULT_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL,
					),
				).createEl('select', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationProjectContentHeadingLevelName}`,
					},
					cls: 'obpm-rule-table-select',
				});
				for (
					let level = MIN_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL;
					level <= maxProjectContentHeadingLevel;
					level += 1
				) {
					headingLevelSelectEl.createEl('option', {
						attr: {value: level.toString()},
						text: strings.frontmatterAutomationProjectContentHeadingLevelOption(level),
					});
				}
				headingLevelSelectEl.value = projectContentHeadingLevel.toString();
				headingLevelSelectEl.addEventListener('change', () => {
					void (async () => {
						const latestRule = getLatestRule();
						const projectContentHeadingLevel = normalizeFrontmatterAutomationProjectContentHeadingLevel(
							headingLevelSelectEl.value,
							latestRule.projectContentHeadingLevel,
						);
						const normalizedProjectContentHeadingLevel = normalizeProjectContentHeadingLevelForPlacement(
							projectContentHeadingLevel,
							latestRule.projectContentHeadingLevel,
							latestRule.projectContentPlacementMode,
						);
						headingLevelSelectEl.value = normalizedProjectContentHeadingLevel.toString();
						await updateRule((currentRule) => ({
							...currentRule,
							projectContentHeadingLevel: normalizedProjectContentHeadingLevel,
						}));
					})();
				});

				const preservePropertiesControlEl = createFieldControl(
					strings.frontmatterAutomationProjectContentPreserveSourcePropertiesName,
					strings.frontmatterAutomationProjectContentPreserveSourcePropertiesDesc,
				);
				const preservePropertiesToggle = new ToggleComponent(preservePropertiesControlEl)
					.setValue(rule.projectContentPreserveSourceProperties)
					.onChange(async (projectContentPreserveSourceProperties) => {
						await updateRule((currentRule) => ({
							...currentRule,
							projectContentPreserveSourceProperties,
						}));
					});
				preservePropertiesToggle.toggleEl.setAttribute(
					'aria-label',
					`${ruleLabel} ${strings.frontmatterAutomationProjectContentPreserveSourcePropertiesName}`,
				);

				const targetHeadingInputEl = createFieldControl(
					strings.frontmatterAutomationProjectContentTargetHeadingName,
					strings.frontmatterAutomationProjectContentTargetHeadingDesc,
					'obpm-automation-rule-field-wide',
				).createEl('input', {
					attr: {
						'aria-label': `${ruleLabel} ${strings.frontmatterAutomationProjectContentTargetHeadingName}`,
						placeholder: strings.frontmatterAutomationProjectContentTargetHeadingPlaceholder,
						type: 'text',
					},
					cls: 'obpm-rule-table-input',
					value: rule.projectContentTargetHeading,
				});
				bindCommittedInput(
					targetHeadingInputEl,
					() => getLatestRule().projectContentTargetHeading,
					async (value) => {
						await updateRule((currentRule) => ({
							...currentRule,
							projectContentTargetHeading: value.trim(),
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
			plugin.settings.frontmatterAutomation.rules = [
				...plugin.settings.frontmatterAutomation.rules,
				createDefaultFrontmatterAutomationRule({
					id: `frontmatter-automation-rule-${Date.now()}`,
				}),
			];
			await saveFrontmatterAutomationSettings();
			display();
		})();
	});
}

function normalizeFrontmatterAutomationActionType(
	value: string,
	fallback: FrontmatterAutomationActionType,
): FrontmatterAutomationActionType {
	if (
		value === 'ensure_project_folder'
		|| value === 'send_content_to_project_file'
		|| value === 'set_current_time'
		|| value === 'set_static_value'
	) {
		return value;
	}

	return fallback;
}

function getMaxProjectContentHeadingLevelForPlacement(
	placementMode: FrontmatterAutomationRule['projectContentPlacementMode'],
): number {
	return placementMode === 'source_name_heading'
		? MAX_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_PARENT_HEADING_LEVEL
		: MAX_FRONTMATTER_AUTOMATION_PROJECT_CONTENT_HEADING_LEVEL;
}

function normalizeProjectContentHeadingLevelForPlacement(
	value: unknown,
	fallback: number,
	placementMode: FrontmatterAutomationRule['projectContentPlacementMode'],
): number {
	return Math.min(
		getMaxProjectContentHeadingLevelForPlacement(placementMode),
		normalizeFrontmatterAutomationProjectContentHeadingLevel(value, fallback),
	);
}

function getFrontmatterAutomationActionTypeLabel(
	actionType: FrontmatterAutomationActionType,
	strings: SettingsLocalization,
): string {
	switch (actionType) {
		case 'ensure_project_folder':
			return strings.frontmatterAutomationActionTypeProjectFolderLabel;
		case 'send_content_to_project_file':
			return strings.frontmatterAutomationActionTypeProjectContentLabel;
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
