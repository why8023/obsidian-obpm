import {Component, Notice, TFile, TFolder, WorkspaceLeaf, debounce} from 'obsidian';
import type {TAbstractFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {ensureFolderExists} from '../project-routing/file-move-utils';
import {validateRequestedMarkdownBasename} from '../same-folder-note/same-folder-note-utils';
import type {SameFolderNoteNameIssue} from '../same-folder-note/same-folder-note-utils';
import {runCreateProjectFolderCommand} from './project-folder-command';
import {ProjectFolderCreateModal} from './project-folder-create-modal';
import {ProjectFolderFileTreeController} from './project-folder-file-tree-controller';
import {getProjectFolderLocalization} from './project-folder-localization';
import {executeProjectFolderRenamePlan} from './project-folder-rename-executor';
import {ProjectFolderSyncConfirmModal} from './project-folder-sync-modal';
import {
	buildNewProjectFolderCreationPlan,
	buildProjectFolderChildRenameSyncPlan,
	buildProjectFileRenameSyncPlan,
	buildProjectFolderRenameSyncPlan,
	findProjectParentFolderFileConflict,
	ProjectFolderSyncPlan,
} from './project-folder-utils';

const FEATURE_ID = 'project-folder';
const PENDING_FOLDER_RENAME_DELAY_MS = 800;

interface PendingProjectFolderRename {
	newFolderPath: string;
	oldFolderPath: string;
}

export class ProjectFolderFeature extends Component {
	private readonly controllers = new Map<WorkspaceLeaf, ProjectFolderFileTreeController>();
	private readonly localization = getProjectFolderLocalization();
	private readonly pendingFolderRenames = new Map<string, PendingProjectFolderRename>();
	private readonly pendingOwnRenames = new Map<string, string>();
	private readonly syncControllers = debounce(() => {
		this.reconcileControllers();
	}, 100, true);
	private pendingFolderRenameTimer: number | null = null;
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload(): void {
		this.plugin.addCommand({
			id: 'create-project-folder',
			name: this.localization.createProjectCommandName,
			checkCallback: (checking) => {
				if (!this.plugin.settings.projectFolder.createProjectCommandEnabled) {
					return false;
				}

				if (!checking) {
					void this.createProjectFolderFromCommand();
				}

				return true;
			},
		});

		this.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
			this.requestSync('active-leaf-change');
		}));

		this.registerEvent(this.plugin.app.workspace.on('layout-change', () => {
			this.requestSync('layout-change');
		}));

		this.registerEvent(this.plugin.app.workspace.on('file-open', () => {
			this.requestSync('file-open');
		}));

		this.registerEvent(this.plugin.app.vault.on('create', () => {
			this.requestSync('create');
		}));

		this.registerEvent(this.plugin.app.vault.on('delete', () => {
			this.requestSync('delete');
		}));

		this.registerEvent(this.plugin.app.vault.on('rename', (file, oldPath) => {
			this.handleRename(file, oldPath);
			this.requestSync('rename');
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			this.requestSync('layout-ready');
		});

		this.requestSync('feature-load');
	}

	onunload(): void {
		this.clearPendingFolderRenameTimer();
		this.syncControllers.cancel();
		this.destroyAllControllers();
		this.pendingFolderRenames.clear();
		this.pendingOwnRenames.clear();
	}

	async refresh(): Promise<void> {
		this.syncControllers.cancel();
		if (!this.isEnabled()) {
			this.clearPendingFolderRenameTimer();
			this.pendingFolderRenames.clear();
		}

		this.reconcileControllers();
	}

	private async applyRenamePlan(plan: ProjectFolderSyncPlan): Promise<void> {
		try {
			await executeProjectFolderRenamePlan<TAbstractFile>(plan, {
				getFileByPath: (path) => this.plugin.app.vault.getAbstractFileByPath(path),
				onConflict: (targetPath) => {
					new Notice(this.localization.conflictNotice(targetPath));
				},
				pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
				renameFile: async (sourceFile, targetPath) => {
					this.pendingOwnRenames.set(plan.sourcePath, targetPath);
					await this.plugin.app.fileManager.renameFile(sourceFile, targetPath);
				},
			});
		} catch (error) {
			this.pendingOwnRenames.delete(plan.sourcePath);
			console.error('[OBPM:project-folder] Failed to sync a project folder name.', {
				error,
				sourcePath: plan.sourcePath,
				targetPath: plan.targetPath,
			});
			new Notice(this.localization.syncFailureNotice);
		}
	}

	private async confirmAndApplyPlan(plan: ProjectFolderSyncPlan, context: 'file' | 'folder'): Promise<void> {
		if (plan.kind === 'conflict') {
			new Notice(this.localization.conflictNotice(plan.targetPath));
			return;
		}

		const modal = new ProjectFolderSyncConfirmModal(this.plugin.app, {
			cancelLabel: this.localization.cancelButtonLabel,
			description: context === 'folder'
				? this.localization.folderRenameSyncDescription(plan.sourcePath, plan.targetPath)
				: this.localization.fileRenameSyncDescription(plan.sourcePath, plan.targetPath),
			submitLabel: this.localization.syncButtonLabel,
			title: context === 'folder'
				? this.localization.folderRenameSyncTitle
				: this.localization.fileRenameSyncTitle,
		});
		const confirmed = await modal.openAndGetConfirmation();
		if (!confirmed) {
			return;
		}

		await this.applyRenamePlan(plan);
	}

	private async createProjectFolderFromCommand(): Promise<void> {
		await runCreateProjectFolderCommand({
			createProject: async (projectName) => {
				await this.createProjectFolder(projectName);
			},
			enqueue: (task) => this.enqueue(task),
			isEnabled: () => this.plugin.settings.projectFolder.createProjectCommandEnabled,
			onDisabled: () => {
				new Notice(this.localization.createProjectCommandDisabledNotice);
			},
			openPrompt: async () => {
				const modal = new ProjectFolderCreateModal(this.plugin.app, {
					cancelLabel: this.localization.cancelButtonLabel,
					description: this.localization.createProjectPromptDescription(this.getCreateProjectParentFolderLabel()),
					inputPlaceholder: this.localization.createProjectPromptPlaceholder,
					submitLabel: this.localization.createProjectSubmitButtonLabel,
					title: this.localization.createProjectPromptTitle,
					validate: (value) => this.validateProjectName(value),
				});
				return await modal.openAndGetValue();
			},
		});
	}

	private async createProjectFolder(requestedValue: string): Promise<void> {
		const parentFolderConflictPath = this.findParentFolderFileConflict();
		if (parentFolderConflictPath) {
			new Notice(this.localization.createProjectParentFolderConflictNotice(parentFolderConflictPath));
			return;
		}

		const plan = buildNewProjectFolderCreationPlan({
			parentFolderPath: this.plugin.settings.projectFolder.createProjectParentFolderPath,
			pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
			projectName: requestedValue,
		});
		if (!plan) {
			return;
		}

		if (plan.kind === 'conflict') {
			new Notice(this.localization.createProjectConflictNotice(plan.conflictPath));
			return;
		}

		try {
			await ensureFolderExists(this.plugin.app, plan.folderPath);
			await this.plugin.app.vault.create(plan.filePath, '');
			new Notice(this.localization.createProjectSuccessNotice(plan.projectName));
			this.requestSync('create-project-folder-command');
		} catch (error) {
			console.error('[OBPM:project-folder] Failed to create a project folder.', {
				error,
				filePath: plan.filePath,
				folderPath: plan.folderPath,
			});
			new Notice(this.localization.createProjectFailureNotice);
		}
	}

	private destroyAllControllers(): void {
		for (const controller of this.controllers.values()) {
			controller.destroy();
		}

		this.controllers.clear();
	}

	private clearPendingFolderRenameTimer(): void {
		if (this.pendingFolderRenameTimer === null) {
			return;
		}

		window.clearTimeout(this.pendingFolderRenameTimer);
		this.pendingFolderRenameTimer = null;
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		this.workQueue = this.workQueue.then(task, task);
		return this.workQueue;
	}

	private getCreateProjectParentFolderLabel(): string {
		return this.plugin.settings.projectFolder.createProjectParentFolderPath || this.localization.vaultRootLabel;
	}

	private findParentFolderFileConflict(): string | null {
		return findProjectParentFolderFileConflict({
			parentFolderPath: this.plugin.settings.projectFolder.createProjectParentFolderPath,
			pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
			pathIsFolder: (path) => this.plugin.app.vault.getAbstractFileByPath(path) instanceof TFolder,
		});
	}

	private handleFileRename(file: TFile, oldPath: string): void {
		const pendingFolderPlan = this.resolvePendingFolderRenameFromChildFileRename(file, oldPath);
		if (pendingFolderPlan) {
			void this.enqueue(async () => {
				await this.confirmAndApplyPlan(pendingFolderPlan, 'folder');
			});
			return;
		}

		const plan = buildProjectFileRenameSyncPlan({
			newFileBasename: file.basename,
			newFileExtension: file.extension,
			newFileParentPath: file.parent?.path ?? '',
			oldFilePath: oldPath,
			pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
		});
		if (!plan) {
			return;
		}

		void this.enqueue(async () => {
			await this.confirmAndApplyPlan(plan, 'file');
		});
	}

	private handleFolderRename(file: TFolder, oldPath: string): void {
		const plan = buildProjectFolderRenameSyncPlan({
			newFolderPath: file.path,
			oldFolderPath: oldPath,
			pathExists: (path) => {
				const targetFile = this.plugin.app.vault.getAbstractFileByPath(path);
				return targetFile instanceof TFile && targetFile.extension === 'md';
			},
		});
		if (!plan) {
			this.queuePendingFolderRename(oldPath, file.path);
			return;
		}

		void this.enqueue(async () => {
			await this.confirmAndApplyPlan(plan, 'folder');
		});
	}

	private handleRename(file: TAbstractFile, oldPath: string): void {
		if (!this.isEnabled()) {
			return;
		}

		if (this.shouldIgnoreOwnRename(file, oldPath)) {
			return;
		}

		if (file instanceof TFolder) {
			this.handleFolderRename(file, oldPath);
			return;
		}

		if (file instanceof TFile && file.extension === 'md') {
			this.handleFileRename(file, oldPath);
		}
	}

	private isEnabled(): boolean {
		return this.plugin.settings.projectFolder.enabled;
	}

	private async openProjectFile(file: TFile): Promise<void> {
		try {
			const leaf = this.plugin.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		} catch (error) {
			console.error('[OBPM:project-folder] Failed to open a project file from the file tree.', {
				error,
				filePath: file.path,
			});
			new Notice(this.localization.fileOpenFailureNotice);
		}
	}

	private reconcileControllers(): void {
		if (!this.isEnabled()) {
			this.destroyAllControllers();
			return;
		}

		const fileExplorerLeaves = this.plugin.app.workspace.getLeavesOfType('file-explorer');
		const activeLeaves = new Set(fileExplorerLeaves);
		for (const [leaf, controller] of [...this.controllers.entries()]) {
			if (activeLeaves.has(leaf)) {
				controller.requestRefresh();
				continue;
			}

			controller.destroy();
			this.controllers.delete(leaf);
		}

		for (const leaf of fileExplorerLeaves) {
			let controller = this.controllers.get(leaf);
			if (!controller) {
				controller = new ProjectFolderFileTreeController(this.plugin.app, leaf, {
					getOpenIndicatorLabel: (fileName) => this.localization.openIndicatorLabel(fileName),
					openProjectFile: (file) => this.openProjectFile(file),
				});
				this.controllers.set(leaf, controller);
			}

			controller.requestRefresh();
		}
	}

	private requestSync(reason: string): void {
		if (!this.isEnabled()) {
			this.destroyAllControllers();
			return;
		}

		this.plugin.debugFeatureLog(FEATURE_ID, this.plugin.settings.projectRouting.debugLog, 'Requesting project-folder sync.', {
			reason,
		});
		this.syncControllers();
	}

	private queuePendingFolderRename(oldFolderPath: string, newFolderPath: string): void {
		this.pendingFolderRenames.set(getPendingFolderRenameKey(oldFolderPath, newFolderPath), {
			newFolderPath,
			oldFolderPath,
		});
		this.schedulePendingFolderRenameFlush();
	}

	private resolvePendingFolderRenameFromChildFileRename(file: TFile, oldPath: string): ProjectFolderSyncPlan | null {
		for (const [key, pendingRename] of this.pendingFolderRenames.entries()) {
			const plan = buildProjectFolderChildRenameSyncPlan({
				newFilePath: file.path,
				newFolderPath: pendingRename.newFolderPath,
				oldFilePath: oldPath,
				oldFolderPath: pendingRename.oldFolderPath,
				pathExists: (path) => this.isMarkdownFilePath(path),
			});
			if (!plan) {
				continue;
			}

			this.pendingFolderRenames.delete(key);
			if (this.pendingFolderRenames.size === 0) {
				this.clearPendingFolderRenameTimer();
			}

			return plan;
		}

		return null;
	}

	private schedulePendingFolderRenameFlush(): void {
		this.clearPendingFolderRenameTimer();
		this.pendingFolderRenameTimer = window.setTimeout(() => {
			this.pendingFolderRenameTimer = null;
			this.flushPendingFolderRenames();
		}, PENDING_FOLDER_RENAME_DELAY_MS);
	}

	private flushPendingFolderRenames(): void {
		if (!this.isEnabled()) {
			this.pendingFolderRenames.clear();
			return;
		}

		for (const [key, pendingRename] of [...this.pendingFolderRenames.entries()]) {
			this.pendingFolderRenames.delete(key);
			const plan = buildProjectFolderRenameSyncPlan({
				newFolderPath: pendingRename.newFolderPath,
				oldFolderPath: pendingRename.oldFolderPath,
				pathExists: (path) => this.isMarkdownFilePath(path),
			});
			if (!plan) {
				continue;
			}

			void this.enqueue(async () => {
				await this.confirmAndApplyPlan(plan, 'folder');
			});
		}
	}

	private validateProjectName(value: string): string | null {
		const issue = validateRequestedMarkdownBasename(value);
		if (issue) {
			return this.getProjectNameValidationMessage(issue);
		}

		const parentFolderConflictPath = this.findParentFolderFileConflict();
		if (parentFolderConflictPath) {
			return this.localization.createProjectParentFolderConflictNotice(parentFolderConflictPath);
		}

		const plan = buildNewProjectFolderCreationPlan({
			parentFolderPath: this.plugin.settings.projectFolder.createProjectParentFolderPath,
			pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
			projectName: value,
		});
		if (plan?.kind === 'conflict') {
			return this.localization.createProjectConflictNotice(plan.conflictPath);
		}

		return null;
	}

	private getProjectNameValidationMessage(issue: SameFolderNoteNameIssue): string {
		switch (issue) {
			case 'contains-invalid-character':
				return this.localization.createProjectInvalidCharacterNotice;
			case 'contains-path-separator':
				return this.localization.createProjectPathSeparatorNotice;
			case 'empty':
				return this.localization.createProjectEmptyNameNotice;
			case 'reserved-name':
				return this.localization.createProjectReservedNameNotice;
			case 'trailing-period':
				return this.localization.createProjectTrailingPeriodNotice;
			default:
				return this.localization.createProjectInvalidCharacterNotice;
		}
	}

	private isMarkdownFilePath(path: string): boolean {
		const targetFile = this.plugin.app.vault.getAbstractFileByPath(path);
		return targetFile instanceof TFile && targetFile.extension === 'md';
	}

	private shouldIgnoreOwnRename(file: TAbstractFile, oldPath: string): boolean {
		const expectedTargetPath = this.pendingOwnRenames.get(oldPath);
		if (!expectedTargetPath) {
			return false;
		}

		this.pendingOwnRenames.delete(oldPath);
		return expectedTargetPath === file.path;
	}
}

function getPendingFolderRenameKey(oldFolderPath: string, newFolderPath: string): string {
	return `${oldFolderPath}\u0000${newFolderPath}`;
}
