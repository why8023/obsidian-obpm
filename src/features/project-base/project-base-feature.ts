import {Component, Notice, TFile, debounce, parseYaml, stringifyYaml} from 'obsidian';
import OBPMPlugin from '../../main';
import {normalizeProjectInboxFolderPath} from '../configured-folder-note/configured-folder-note-settings';
import {normalizeConfiguredBaseFilePath} from '../configured-folder-note/configured-folder-note-utils';
import {ensureFolderExists} from '../project-routing/file-move-utils';
import {getVaultProjectCandidates} from '../project-routing/project-resolver';
import {getParentPath} from '../project-folder/project-folder-utils';
import {getSettingsLocalization} from '../../settings-localization';
import {buildProjectBaseConfig} from './project-base-utils';
import {normalizeProjectBaseSettings} from './project-base-settings';

export class ProjectBaseFeature extends Component {
	private readonly requestSync = debounce(() => {
		void this.enqueueSync();
	}, 250);
	private syncQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload() {
		this.registerEvent(this.plugin.app.vault.on('create', () => this.requestSync()));
		this.registerEvent(this.plugin.app.vault.on('delete', () => this.requestSync()));
		this.registerEvent(this.plugin.app.vault.on('rename', () => this.requestSync()));
		this.registerEvent(this.plugin.app.metadataCache.on('changed', () => this.requestSync()));
		this.plugin.app.workspace.onLayoutReady(() => this.requestSync());
	}

	onunload() {
		this.requestSync.cancel();
	}

	async refresh(): Promise<void> {
		this.requestSync.cancel();
		if (!this.plugin.settings.projectBase.enabled) {
			return;
		}

		await this.enqueueSync();
	}

	private enqueueSync(): Promise<void> {
		this.syncQueue = this.syncQueue.then(
			() => this.syncNow(),
			() => this.syncNow(),
		);
		return this.syncQueue;
	}

	private async syncNow(): Promise<void> {
		const settings = normalizeProjectBaseSettings(this.plugin.settings.projectBase);
		if (!settings.enabled) {
			return;
		}

		const basePath = normalizeConfiguredBaseFilePath(settings.baseFilePath);
		const strings = getSettingsLocalization();
		if (!isValidProjectBasePath(basePath)) {
			new Notice(strings.projectBaseInvalidPathNotice);
			return;
		}

		const projects = getVaultProjectCandidates(this.plugin.app, {
			projectFileRules: this.plugin.settings.projectRouting.projectFileRules,
			recognizeFilenameMatchesFolderAsProject:
				this.plugin.settings.projectRouting.recognizeFilenameMatchesFolderAsProject,
		});
		const projectInboxFolderPath = normalizeProjectInboxFolderPath(
			this.plugin.settings.configuredFolderNote.projectInboxFolderPath,
		);
		const buildOptions = {
			projectFileScope: settings.fileScope,
			projectInboxFolderPath,
			projectViewProperties: settings.projectViewProperties,
			projects,
			totalViewProperties: settings.totalViewProperties,
		};
		const baseEntry = this.plugin.app.vault.getAbstractFileByPath(basePath);

		try {
			if (!baseEntry) {
				await ensureFolderExists(this.plugin.app, getParentPath(basePath));
				await this.plugin.app.vault.create(
					basePath,
					stringifyBaseConfig(buildProjectBaseConfig(undefined, buildOptions)),
				);
				return;
			}

			if (!(baseEntry instanceof TFile) || baseEntry.extension.toLowerCase() !== 'base') {
				new Notice(strings.projectBaseFileConflictNotice);
				return;
			}

			let invalidYaml = false;
			await this.plugin.app.vault.process(baseEntry, (content) => {
				let parsedConfig: unknown;
				try {
					parsedConfig = parseYaml(content);
				} catch (error) {
					invalidYaml = true;
					console.error('[OBPM:project-base] Invalid YAML', error);
					return content;
				}

				if (!isObjectRecord(parsedConfig)) {
					invalidYaml = true;
					return content;
				}

				return stringifyBaseConfig(buildProjectBaseConfig(parsedConfig, buildOptions));
			});

			if (invalidYaml) {
				new Notice(strings.projectBaseInvalidYamlNotice);
			}
		} catch (error) {
			console.error('[OBPM:project-base] Failed to synchronize Base', error);
			new Notice(strings.projectBaseWriteFailureNotice);
		}
	}
}

function stringifyBaseConfig(config: Record<string, unknown>): string {
	const serialized = stringifyYaml(config);
	return serialized.endsWith('\n') ? serialized : `${serialized}\n`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidProjectBasePath(path: string): boolean {
	return path.length > 0
		&& path.toLowerCase().endsWith('.base')
		&& path.split('/').every((segment) => segment.length > 0 && !/[<>:"|?*]/.test(segment));
}
