import {Component, Notice, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {isProjectFile} from '../project-routing/project-resolver';
import {ensureFolderExists} from '../project-routing/file-move-utils';
import {getRelatedDocumentWorkflowLocalization} from './related-document-workflow-localization';
import {
	buildRelatedDocumentMovePlans,
	RelatedDocumentWorkflowFileInfo,
} from './related-document-workflow-planner';

interface MoveExecutionResult {
	failedCount: number;
	movedCount: number;
	skippedCount: number;
}

export class RelatedDocumentWorkflowFeature extends Component {
	private readonly localization = getRelatedDocumentWorkflowLocalization();
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload(): void {
		this.plugin.addCommand({
			id: 'move-related-documents-into-project-folder',
			name: this.localization.commandName,
			checkCallback: (checking) => {
				if (!this.plugin.settings.relatedDocumentWorkflow.enabled) {
					return false;
				}

				if (!checking) {
					void this.moveRelatedDocumentsIntoProjectFolders();
				}

				return true;
			},
		});
	}

	async refresh(): Promise<void> {
		return Promise.resolve();
	}

	private async moveRelatedDocumentsIntoProjectFolders(): Promise<void> {
		await this.enqueue(async () => {
			if (!this.plugin.settings.relatedDocumentWorkflow.enabled) {
				new Notice(this.localization.disabledNotice);
				return;
			}

			if (!this.plugin.settings.relatedLinks.enabled) {
				new Notice(this.localization.relatedLinksDisabledNotice);
				return;
			}

			try {
				await this.plugin.runRelatedLinksFullSync();
				const result = await this.executeMovePlans();
				if (result.movedCount === 0 && result.failedCount === 0) {
					new Notice(this.localization.noRelatedDocumentsNotice);
					return;
				}

				new Notice(this.localization.moveSummaryNotice(
					result.movedCount,
					result.skippedCount,
					result.failedCount,
				));
			} catch (error) {
				console.error('[OBPM] Failed to run related document workflow.', error);
				new Notice(this.localization.failureNotice);
			}
		});
	}

	private async executeMovePlans(): Promise<MoveExecutionResult> {
		const plans = this.buildMovePlans();
		let failedCount = 0;
		let movedCount = 0;

		for (const plan of plans.plans) {
			const sourceFile = this.plugin.app.vault.getAbstractFileByPath(plan.sourcePath);
			if (!(sourceFile instanceof TFile)) {
				failedCount += 1;
				continue;
			}

			try {
				await ensureFolderExists(this.plugin.app, plan.targetFolderPath);
				await this.plugin.app.fileManager.renameFile(sourceFile, plan.targetPath);
				movedCount += 1;
			} catch (error) {
				failedCount += 1;
				console.error('[OBPM] Failed to move a related document into its project folder.', {
					error,
					plan,
				});
			}
		}

		return {
			failedCount,
			movedCount,
			skippedCount: this.countSkippedPlans(plans.stats),
		};
	}

	private buildMovePlans() {
		const files = this.plugin.app.vault.getMarkdownFiles().map((file): RelatedDocumentWorkflowFileInfo => ({
			isProject: isProjectFile(this.plugin.app, file, {
				projectFileRules: this.plugin.settings.projectRouting.projectFileRules,
				projectSubfolderPath: this.plugin.settings.projectRouting.projectSubfolderPath,
				recognizeFilenameMatchesFolderAsProject:
					this.plugin.settings.projectRouting.recognizeFilenameMatchesFolderAsProject,
			}),
			name: file.name,
			parentPath: file.parent?.path ?? '',
			path: file.path,
		}));

		return buildRelatedDocumentMovePlans({
			files,
			pathExists: (path) => Boolean(this.plugin.app.vault.getAbstractFileByPath(path)),
			relationState: this.plugin.getRelatedLinksState(),
			targetSubfolderPath: this.plugin.settings.relatedDocumentWorkflow.targetSubfolderPath,
		});
	}

	private countSkippedPlans(stats: {
		alreadyInTargetCount: number;
		ambiguousDocumentCount: number;
		missingEndpointCount: number;
		noProjectRelationCount: number;
		projectToProjectRelationCount: number;
	}): number {
		return stats.alreadyInTargetCount
			+ stats.ambiguousDocumentCount
			+ stats.missingEndpointCount
			+ stats.noProjectRelationCount
			+ stats.projectToProjectRelationCount;
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		this.workQueue = this.workQueue.then(task, task);
		return this.workQueue;
	}
}
