import {Component, Notice, TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {isProjectFile} from '../project-routing/project-resolver';
import {ensureFolderExists} from '../project-routing/file-move-utils';
import {getRelatedDocumentWorkflowLocalization} from './related-document-workflow-localization';
import {RelatedDocumentWorkflowMoveRecord, RelatedDocumentWorkflowUndoBatch} from './related-document-workflow-history';
import {
	buildRelatedDocumentMovePlans,
	RelatedDocumentWorkflowFileInfo,
} from './related-document-workflow-planner';

interface MoveExecutionResult {
	failedCount: number;
	records: RelatedDocumentWorkflowMoveRecord[];
	movedCount: number;
	skippedCount: number;
}

interface UndoExecutionResult {
	failedCount: number;
	remainingRecords: RelatedDocumentWorkflowMoveRecord[];
	skippedCount: number;
	undoneCount: number;
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

		this.plugin.addCommand({
			id: 'undo-related-documents-project-folder-move',
			name: this.localization.undoCommandName,
			callback: () => {
				void this.undoLastRelatedDocumentMove();
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
				if (result.records.length > 0) {
					await this.plugin.saveRelatedDocumentWorkflowUndoBatch({
						createdAt: Date.now(),
						records: result.records,
					});
				}

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

	private async undoLastRelatedDocumentMove(): Promise<void> {
		await this.enqueue(async () => {
			const batch = this.plugin.getRelatedDocumentWorkflowUndoBatch();
			if (!batch) {
				new Notice(this.localization.undoNoHistoryNotice);
				return;
			}

			try {
				const result = await this.executeUndoBatch(batch);
				await this.plugin.saveRelatedDocumentWorkflowUndoBatch(
					result.remainingRecords.length > 0
						? {
							createdAt: batch.createdAt,
							records: result.remainingRecords,
						}
						: null,
				);
				new Notice(this.localization.undoSummaryNotice(
					result.undoneCount,
					result.skippedCount,
					result.failedCount,
				));
			} catch (error) {
				console.error('[OBPM] Failed to undo related document moves.', error);
				new Notice(this.localization.undoFailureNotice);
			}
		});
	}

	private async executeMovePlans(): Promise<MoveExecutionResult> {
		const plans = this.buildMovePlans();
		let failedCount = 0;
		let movedCount = 0;
		const records: RelatedDocumentWorkflowMoveRecord[] = [];

		for (const plan of plans.plans) {
			const sourceFile = this.plugin.app.vault.getAbstractFileByPath(plan.sourcePath);
			if (!(sourceFile instanceof TFile)) {
				failedCount += 1;
				continue;
			}

			try {
				await ensureFolderExists(this.plugin.app, plan.targetFolderPath);
				await this.plugin.app.fileManager.renameFile(sourceFile, plan.targetPath);
				records.push({
					projectPath: plan.projectPath,
					sourcePath: plan.sourcePath,
					targetPath: plan.targetPath,
				});
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
			records,
			skippedCount: this.countSkippedPlans(plans.stats),
		};
	}

	private async executeUndoBatch(batch: RelatedDocumentWorkflowUndoBatch): Promise<UndoExecutionResult> {
		let failedCount = 0;
		let skippedCount = 0;
		let undoneCount = 0;
		const remainingRecords: RelatedDocumentWorkflowMoveRecord[] = [];

		for (const record of [...batch.records].reverse()) {
			const movedFile = this.plugin.app.vault.getAbstractFileByPath(record.targetPath);
			if (!(movedFile instanceof TFile)) {
				skippedCount += 1;
				remainingRecords.push(record);
				continue;
			}

			if (this.plugin.app.vault.getAbstractFileByPath(record.sourcePath)) {
				skippedCount += 1;
				remainingRecords.push(record);
				continue;
			}

			try {
				await ensureFolderExists(this.plugin.app, getParentFolderPath(record.sourcePath));
				await this.plugin.app.fileManager.renameFile(movedFile, record.sourcePath);
				undoneCount += 1;
			} catch (error) {
				failedCount += 1;
				remainingRecords.push(record);
				console.error('[OBPM] Failed to undo a related document move.', {
					error,
					record,
				});
			}
		}

		return {
			failedCount,
			remainingRecords: remainingRecords.reverse(),
			skippedCount,
			undoneCount,
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
		alreadyInProjectFolderCount: number;
		alreadyInTargetCount: number;
		ambiguousDocumentCount: number;
		missingEndpointCount: number;
		noProjectRelationCount: number;
		projectToProjectRelationCount: number;
	}): number {
		return stats.alreadyInProjectFolderCount
			+ stats.alreadyInTargetCount
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

function getParentFolderPath(path: string): string {
	const separatorIndex = path.lastIndexOf('/');
	return separatorIndex === -1 ? '' : path.slice(0, separatorIndex);
}
