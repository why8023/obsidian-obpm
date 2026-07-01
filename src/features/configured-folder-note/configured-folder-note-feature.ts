import {Component, Notice, TFile, parseYaml, stringifyYaml} from 'obsidian';
import type {BasesConfigFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {ensureFolderExists} from '../project-routing/file-move-utils';
import {getConfiguredFolderNoteLocalization} from './configured-folder-note-localization';
import {
	BaseConfigLike,
	buildBaseFrontmatterTemplate,
	buildConfiguredFolderNoteCreationPlan,
	buildMarkdownContentWithFrontmatter,
} from './configured-folder-note-utils';

export class ConfiguredFolderNoteFeature extends Component {
	private readonly localization = getConfiguredFolderNoteLocalization();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload(): void {
		this.plugin.addCommand({
			id: 'create-note-in-configured-folder',
			name: this.localization.commandName,
			checkCallback: (checking) => {
				if (!this.plugin.settings.configuredFolderNote.enabled) {
					return false;
				}

				if (!checking) {
					void this.createNoteInConfiguredFolder();
				}

				return true;
			},
		});
	}

	private async buildInitialContent(): Promise<string | null> {
		const settings = this.plugin.settings.configuredFolderNote;
		if (!settings.baseFilePath && !settings.baseViewName) {
			return '';
		}

		if (!settings.baseFilePath || !settings.baseViewName) {
			new Notice(this.localization.baseConfigIncompleteNotice);
			return null;
		}

		const baseFile = this.plugin.app.vault.getAbstractFileByPath(settings.baseFilePath);
		if (!(baseFile instanceof TFile) || baseFile.extension !== 'base') {
			new Notice(this.localization.baseFileInvalidNotice(settings.baseFilePath));
			return null;
		}

		const baseConfig = await this.readBaseConfig(baseFile);
		if (!baseConfig) {
			return null;
		}

		const template = buildBaseFrontmatterTemplate(baseConfig, {
			includeFilterDefaults: settings.includeFilterDefaults,
			targetFolderPath: settings.targetFolderPath,
			viewName: settings.baseViewName,
		});
		switch (template.kind) {
			case 'success':
				return buildMarkdownContentWithFrontmatter(template.frontmatter, stringifyYaml);
			case 'folder-not-matched':
				new Notice(this.localization.baseFolderNotMatchedNotice);
				return null;
			case 'view-not-found':
				new Notice(this.localization.baseViewMissingNotice(settings.baseViewName));
				return null;
		}
	}

	private async createNoteInConfiguredFolder(): Promise<void> {
		const settings = this.plugin.settings.configuredFolderNote;
		const content = await this.buildInitialContent();
		if (content === null) {
			return;
		}

		const plan = buildConfiguredFolderNoteCreationPlan({
			defaultBasename: this.localization.defaultBasename,
			pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
			targetFolderPath: settings.targetFolderPath,
		});

		try {
			await ensureFolderExists(this.plugin.app, settings.targetFolderPath);
		} catch (error) {
			console.error('[OBPM:configured-folder-note] Failed to create the configured target folder.', {
				error,
				targetFolderPath: settings.targetFolderPath,
			});
			new Notice(this.localization.targetFolderFailureNotice(settings.targetFolderPath));
			return;
		}

		try {
			const createdFile = await this.plugin.app.vault.create(plan.filePath, content);
			const leaf = this.plugin.app.workspace.getLeaf(false);
			await leaf.openFile(createdFile);
			new Notice(this.localization.createSuccessNotice(plan.filePath));
		} catch (error) {
			console.error('[OBPM:configured-folder-note] Failed to create a configured-folder note.', {
				error,
				targetPath: plan.filePath,
			});
			new Notice(this.localization.createFailureNotice);
		}
	}

	private async readBaseConfig(file: TFile): Promise<BaseConfigLike | null> {
		let content: string;
		try {
			content = await this.plugin.app.vault.cachedRead(file);
		} catch (error) {
			console.error('[OBPM:configured-folder-note] Failed to read a configured Base file.', {
				error,
				filePath: file.path,
			});
			new Notice(this.localization.baseFileReadFailureNotice);
			return null;
		}

		let parsedValue: unknown;
		try {
			parsedValue = parseYaml(content) as BasesConfigFile;
		} catch (error) {
			console.error('[OBPM:configured-folder-note] Failed to parse a configured Base file.', {
				error,
				filePath: file.path,
			});
			new Notice(this.localization.baseFileInvalidNotice(file.path));
			return null;
		}

		if (typeof parsedValue !== 'object' || parsedValue === null) {
			new Notice(this.localization.baseFileInvalidNotice(file.path));
			return null;
		}

		return parsedValue as BaseConfigLike;
	}
}
