import {Component, Notice, TFile, parseYaml} from 'obsidian';
import type {BasesConfigFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {ensureFolderExists, joinPath} from '../project-routing/file-move-utils';
import {getProjectRoutingLocalization} from '../project-routing/localization';
import {ProjectRoutingSuggestModal} from '../project-routing/modal';
import {getVaultProjectCandidates, ProjectFileRecognitionOptions} from '../project-routing/project-resolver';
import {ProjectCandidate} from '../project-routing/types';
import {getConfiguredFolderNoteLocalization} from './configured-folder-note-localization';
import {
	BaseConfigLike,
	buildBaseFrontmatterTemplate,
	buildConfiguredFolderNoteCreationPlan,
	sortProjectCandidates,
} from './configured-folder-note-utils';

export class ConfiguredFolderNoteFeature extends Component {
	private readonly localization = getConfiguredFolderNoteLocalization();
	private readonly projectLocalization = getProjectRoutingLocalization();

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
					void this.createNoteInProjectInbox();
				}

				return true;
			},
		});
	}

	private async buildInitialFrontmatter(): Promise<Record<string, unknown> | null> {
		const settings = this.plugin.settings.configuredFolderNote;
		if (!settings.baseFilePath && !settings.baseViewName) {
			return {};
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
			viewName: settings.baseViewName,
		});
		switch (template.kind) {
			case 'success':
				return template.frontmatter;
			case 'view-not-found':
				new Notice(this.localization.baseViewMissingNotice(settings.baseViewName));
				return null;
		}
	}

	private async createNoteInProjectInbox(): Promise<void> {
		const settings = this.plugin.settings.configuredFolderNote;
		const project = await this.pickProject();
		if (!project) {
			return;
		}

		const initialFrontmatter = await this.buildInitialFrontmatter();
		if (initialFrontmatter === null) {
			return;
		}

		const targetFolderPath = joinPath(project.folderPath, settings.projectInboxFolderPath);
		const plan = buildConfiguredFolderNoteCreationPlan({
			defaultBasename: this.localization.defaultBasename,
			pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
			targetFolderPath,
		});

		try {
			await ensureFolderExists(this.plugin.app, targetFolderPath);
		} catch (error) {
			console.error('[OBPM:configured-folder-note] Failed to create the project Inbox folder.', {
				error,
				projectPath: project.file.path,
				targetFolderPath,
			});
			new Notice(this.localization.targetFolderFailureNotice(targetFolderPath));
			return;
		}

		let createdFile: TFile;
		try {
			createdFile = await this.plugin.app.vault.create(plan.filePath, '');
		} catch (error) {
			console.error('[OBPM:configured-folder-note] Failed to create a project Inbox note.', {
				error,
				targetPath: plan.filePath,
			});
			new Notice(this.localization.createFailureNotice);
			return;
		}

		if (Object.keys(initialFrontmatter).length > 0) {
			try {
				await this.plugin.app.fileManager.processFrontMatter(createdFile, (frontmatter) => {
					Object.assign(frontmatter, initialFrontmatter);
				});
			} catch (error) {
				console.error('[OBPM:configured-folder-note] Failed to write initial frontmatter.', {
					error,
					targetPath: plan.filePath,
				});
				new Notice(this.localization.frontmatterFailureNotice(plan.filePath));
				return;
			}
		}

		try {
			const leaf = this.plugin.app.workspace.getLeaf(false);
			await leaf.openFile(createdFile);
			new Notice(this.localization.createSuccessNotice(plan.filePath));
		} catch (error) {
			console.error('[OBPM:configured-folder-note] Failed to open a project Inbox note.', {
				error,
				targetPath: plan.filePath,
			});
			new Notice(this.localization.createFailureNotice);
		}
	}

	private async pickProject(): Promise<ProjectCandidate | null> {
		const projectCandidates = sortProjectCandidates(
			getVaultProjectCandidates(this.plugin.app, this.getProjectFileRecognitionOptions()),
			this.plugin.settings.configuredFolderNote.projectListSortBy,
			this.plugin.settings.configuredFolderNote.projectListSortDirection,
		);
		if (projectCandidates.length === 0) {
			new Notice(this.localization.noProjectCandidatesNotice);
			return null;
		}

		const modal = new ProjectRoutingSuggestModal(this.plugin.app, {
			candidates: projectCandidates,
			localization: this.projectLocalization,
		});
		return await modal.openAndGetResult();
	}

	private getProjectFileRecognitionOptions(): ProjectFileRecognitionOptions {
		return {
			projectFileRules: this.plugin.settings.projectRouting.projectFileRules,
			recognizeFilenameMatchesFolderAsProject:
				this.plugin.settings.projectRouting.recognizeFilenameMatchesFolderAsProject,
		};
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
