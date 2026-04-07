import {Component, Menu, Notice, TAbstractFile, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {getSameFolderNoteLocalization} from './same-folder-note-localization';
import {SameFolderNotePromptModal} from './same-folder-note-modal';
import {
	buildSiblingMarkdownPath,
	findAvailableSiblingMarkdownBasename,
	normalizeRequestedMarkdownBasename,
	SameFolderNoteNameIssue,
	validateRequestedMarkdownBasename,
} from './same-folder-note-utils';

export class SameFolderNoteFeature extends Component {
	private readonly localization = getSameFolderNoteLocalization();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload() {
		this.plugin.addCommand({
			id: 'create-note-in-same-folder',
			name: this.localization.commandName,
			checkCallback: (checking) => {
				if (!this.plugin.settings.sameFolderNote.enabled) {
					return false;
				}

				const activeFile = this.plugin.app.workspace.getActiveFile();
				if (!activeFile) {
					return false;
				}

				if (!checking) {
					void this.createNoteNextToFile(activeFile);
				}

				return true;
			},
		});

		this.registerEvent(this.plugin.app.workspace.on('file-menu', (menu, file) => {
			this.registerMenuItem(menu, file);
		}));

		this.registerEvent(this.plugin.app.workspace.on('files-menu', (menu, files) => {
			if (files.length !== 1) {
				return;
			}

			const selectedFile = files[0];
			if (!selectedFile) {
				return;
			}

			this.registerMenuItem(menu, selectedFile);
		}));
	}

	private registerMenuItem(menu: Menu, file: TAbstractFile) {
		if (!this.plugin.settings.sameFolderNote.enabled || !(file instanceof TFile)) {
			return;
		}

		menu.addItem((item) => item
			.setTitle(this.localization.menuItemLabel)
			.setIcon('file-plus')
			.onClick(() => {
				void this.createNoteNextToFile(file);
			}));
	}

	private async createNoteNextToFile(referenceFile: TFile) {
		const folderLabel = referenceFile.parent?.path || this.localization.vaultRootLabel;
		const initialValue = findAvailableSiblingMarkdownBasename(
			this.plugin.app.vault,
			referenceFile,
			this.localization.defaultBasename,
		);
		const modal = new SameFolderNotePromptModal(this.plugin.app, {
			cancelLabel: this.localization.cancelButtonLabel,
			description: this.localization.promptDescription(folderLabel),
			initialValue,
			inputPlaceholder: this.localization.promptPlaceholder,
			submitLabel: this.localization.submitButtonLabel,
			title: this.localization.promptTitle(referenceFile.name),
			validate: (value) => this.validateNoteName(referenceFile, value),
		});
		const requestedValue = await modal.openAndGetValue();
		if (requestedValue === null) {
			return;
		}

		const normalizedBasename = normalizeRequestedMarkdownBasename(requestedValue);
		if (!normalizedBasename) {
			return;
		}

		const targetPath = buildSiblingMarkdownPath(referenceFile, normalizedBasename);
		try {
			await this.plugin.app.vault.create(targetPath, '');
		} catch (error) {
			console.error('[OBPM] Failed to create a note in the same folder as the selected file.', {
				error,
				referencePath: referenceFile.path,
				targetPath,
			});
			new Notice(this.localization.createFailureNotice);
		}
	}

	private validateNoteName(referenceFile: TFile, value: string): string | null {
		const issue = validateRequestedMarkdownBasename(value);
		if (issue) {
			return this.getValidationMessage(issue);
		}

		const normalizedBasename = normalizeRequestedMarkdownBasename(value);
		const targetPath = buildSiblingMarkdownPath(referenceFile, normalizedBasename);
		if (this.plugin.app.vault.getAbstractFileByPath(targetPath)) {
			return this.localization.fileExistsNotice(normalizedBasename);
		}

		return null;
	}

	private getValidationMessage(issue: SameFolderNoteNameIssue): string {
		switch (issue) {
			case 'contains-invalid-character':
				return this.localization.invalidCharacterNotice;
			case 'contains-path-separator':
				return this.localization.pathSeparatorNotice;
			case 'empty':
				return this.localization.emptyNameNotice;
			case 'reserved-name':
				return this.localization.reservedNameNotice;
			case 'trailing-period':
				return this.localization.trailingPeriodNotice;
			default:
				return this.localization.invalidCharacterNotice;
		}
	}
}
