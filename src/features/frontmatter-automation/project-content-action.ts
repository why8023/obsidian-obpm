import {App, CachedMetadata, Editor, EditorPosition, MarkdownView, Notice, TFile, TFolder, normalizePath} from 'obsidian';
import {buildSourceContribution} from '../related-links/source-index';
import {resolveAssociatedProjectCandidate, ProjectAssociationCandidate} from '../project-routing/project-association-resolver';
import {
	getOpenProjectCandidates,
	getVaultProjectCandidates,
	ProjectFileRecognitionOptions,
} from '../project-routing/project-resolver';
import {ProjectCandidate} from '../project-routing/types';
import {sendContentToTarget, SentContentTransactionRecord} from '../sent-content/send-transaction';
import {OffsetInsertionPlan, RemovalPlan, removeInsertedText} from '../sent-content/target-insertion';
import {FrontmatterAutomationProjectContentAction} from './frontmatter-automation-types';
import {buildProjectFileContentSentContentInsertionPlan} from './project-content-insertion';
import {getProjectContentActionLocalization} from './project-content-action-localization';

interface SendContentToProjectFileOptions {
	app: App;
	autoMoveWhenSingleCandidate: boolean;
	cache: CachedMetadata | null;
	displayProperty: string;
	file: TFile;
	projectFileRecognition: ProjectFileRecognitionOptions;
	relationProperty: string;
	stripSingleH1: boolean;
	action: FrontmatterAutomationProjectContentAction;
}

type ProjectContentActionResult =
	| {
		kind: 'ambiguous-project';
		candidates: ProjectCandidate[];
	}
	| {
		kind: 'failed';
	}
	| {
		kind: 'no-project';
	}
	| {
		kind: 'sent';
		targetProject: ProjectCandidate;
		undoEntry: SentContentTransactionRecord;
	};

type ProjectResolution =
	| {
		kind: 'ambiguous';
		candidates: ProjectAssociationCandidateWithProject[];
	}
	| {
		kind: 'project';
		candidate: ProjectAssociationCandidateWithProject;
	}
	| {
		kind: 'none';
	};

type ProjectAssociationCandidateWithProject = ProjectAssociationCandidate & ProjectCandidate;

export async function sendContentToProjectFile(
	options: SendContentToProjectFileOptions,
): Promise<ProjectContentActionResult> {
	const localization = getProjectContentActionLocalization();
	const projectCandidates = getVaultProjectCandidates(options.app, options.projectFileRecognition);
	if (projectCandidates.length === 0) {
		new Notice(localization.noProjectNotice);
		return {kind: 'no-project'};
	}

	const targetProject = resolveTargetProjectCandidate(options, projectCandidates);
	if (targetProject.kind === 'none') {
		new Notice(localization.noProjectNotice);
		return {kind: 'no-project'};
	}

	if (targetProject.kind === 'ambiguous') {
		new Notice(localization.ambiguousProjectNotice);
		return {
			kind: 'ambiguous-project',
			candidates: targetProject.candidates,
		};
	}

	if (targetProject.candidate.file.path === options.file.path) {
		new Notice(localization.sameFileNotice);
		return {kind: 'failed'};
	}

	const sourceName = options.file.name;
	const projectName = targetProject.candidate.file.name;
	let transactionRecord: SentContentTransactionRecord | null = null;

	try {
		const targetView = findOpenMarkdownView(options.app, targetProject.candidate.file.path);
		transactionRecord = await sendContentToTarget({
			buildInsertionPlan: ({sourceContent, targetContentBefore}) => buildProjectFileContentSentContentInsertionPlan({
				placement: {
					headingLevel: options.action.headingLevel,
					mode: options.action.placementMode,
					targetHeading: options.action.targetHeading,
				},
				projectContent: targetContentBefore,
				sourceBasename: options.file.basename,
				sourceContent,
				stripSingleH1: options.stripSingleH1,
			}),
			readSourceContent: async () => options.app.vault.read(options.file),
			readTargetContent: async () => readProjectTargetContent(options.app, targetProject.candidate.file, targetView),
			rollbackTargetContent: async (record) => {
				await rollbackProjectTargetContent(options.app, targetProject.candidate.file, targetView, record);
			},
			sourcePath: options.file.path,
			targetPath: targetProject.candidate.file.path,
			trashSource: async () => {
				await options.app.fileManager.trashFile(options.file);
			},
			writeTargetContent: async (nextContent, insertionPlan) =>
				writeProjectTargetContent(options.app, targetProject.candidate.file, targetView, nextContent, insertionPlan),
		});
		new Notice(localization.successNotice(sourceName, projectName));
		return {
			kind: 'sent',
			targetProject: targetProject.candidate,
			undoEntry: transactionRecord,
		};
	} catch (error) {
		console.error('[OBPM] Failed to send source content to a project file.', {
			error,
			projectPath: targetProject.candidate.file.path,
			sourcePath: options.file.path,
		});
		new Notice(localization.failureNotice);
		return {kind: 'failed'};
	}
}

export async function undoProjectContentSend(
	app: App,
	entry: SentContentTransactionRecord,
): Promise<void> {
	const targetFile = app.vault.getAbstractFileByPath(entry.targetPath);
	if (!(targetFile instanceof TFile) || targetFile.extension !== 'md') {
		throw new Error('Target markdown file no longer exists.');
	}

	const targetView = findOpenMarkdownView(app, entry.targetPath);
	const currentContent = await readProjectTargetContent(app, targetFile, targetView);
	const removalPlan = removeInsertedText(currentContent, entry);
	if (!removalPlan) {
		throw new Error('Inserted content could not be found in target file.');
	}

	await createSourceFileFromUndo(app, entry);
	await removeProjectTargetInsertion(app, targetFile, targetView, removalPlan);
}

async function createSourceFileFromUndo(app: App, entry: SentContentTransactionRecord): Promise<void> {
	const existingEntry = app.vault.getAbstractFileByPath(entry.sourcePath);
	if (existingEntry) {
		if (!(existingEntry instanceof TFile)) {
			throw new Error('Source restore path is occupied by a folder.');
		}

		const existingContent = await app.vault.read(existingEntry);
		if (existingContent !== entry.sourceContent) {
			throw new Error('Source restore path is occupied by another file.');
		}

		return;
	}

	await ensureParentFolderExists(app, entry.sourcePath);
	await app.vault.create(entry.sourcePath, entry.sourceContent);
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	if (!folderPath) {
		return;
	}

	const existingEntry = app.vault.getAbstractFileByPath(folderPath);
	if (existingEntry) {
		if (existingEntry instanceof TFolder) {
			return;
		}

		throw new Error(`Cannot create folder because a file already exists at ${folderPath}.`);
	}

	const parentFolderPath = getParentFolderPath(folderPath);
	if (parentFolderPath) {
		await ensureFolderExists(app, parentFolderPath);
	}

	await app.vault.createFolder(folderPath);
}

async function ensureParentFolderExists(app: App, filePath: string): Promise<void> {
	await ensureFolderExists(app, getParentFolderPath(filePath));
}

function findOpenMarkdownView(app: App, filePath: string): MarkdownView | null {
	let matchedView: MarkdownView | null = null;
	app.workspace.iterateAllLeaves((leaf) => {
		if (matchedView) {
			return;
		}

		const view = leaf.view;
		if (view instanceof MarkdownView && view.file?.path === filePath) {
			matchedView = view;
		}
	});

	return matchedView;
}

function getParentFolderPath(path: string): string {
	const normalizedPath = normalizePath(path);
	const lastSlashIndex = normalizedPath.lastIndexOf('/');
	return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : '';
}

function getPositionAfterText(from: EditorPosition, text: string): EditorPosition {
	const lines = text.split('\n');
	if (lines.length === 1) {
		return {
			ch: from.ch + text.length,
			line: from.line,
		};
	}

	return {
		ch: lines[lines.length - 1]?.length ?? 0,
		line: from.line + lines.length - 1,
	};
}

function applyRemovalToEditor(editor: Editor, removalPlan: RemovalPlan): void {
	const from = editor.offsetToPos(removalPlan.start);
	const to = editor.offsetToPos(removalPlan.end);
	editor.transaction({
		changes: [{
			from,
			text: '',
			to,
		}],
		selection: {
			from,
			to: from,
		},
	}, 'obpm-project-content-send-undo');
}

function applyTextInsertion(editor: Editor, insertionPlan: OffsetInsertionPlan): void {
	const from = editor.offsetToPos(insertionPlan.offset);
	const end = getPositionAfterText(from, insertionPlan.insertedText);
	editor.transaction({
		changes: [{
			from,
			text: insertionPlan.insertedText,
			to: from,
		}],
		selection: {
			from: end,
			to: end,
		},
	}, 'obpm-project-content-send');
}

async function readProjectTargetContent(
	app: App,
	projectFile: TFile,
	targetView: MarkdownView | null,
): Promise<string> {
	return targetView?.editor.getValue() ?? await app.vault.read(projectFile);
}

async function removeProjectTargetInsertion(
	app: App,
	projectFile: TFile,
	targetView: MarkdownView | null,
	removalPlan: RemovalPlan,
): Promise<void> {
	if (targetView) {
		applyRemovalToEditor(targetView.editor, removalPlan);
		await targetView.save();
		return;
	}

	await app.vault.modify(projectFile, removalPlan.nextContent);
}

async function rollbackProjectTargetContent(
	app: App,
	projectFile: TFile,
	targetView: MarkdownView | null,
	record: SentContentTransactionRecord,
): Promise<void> {
	try {
		const currentContent = await readProjectTargetContent(app, projectFile, targetView);
		const removalPlan = removeInsertedText(currentContent, record);
		if (removalPlan) {
			await removeProjectTargetInsertion(app, projectFile, targetView, removalPlan);
			return;
		}

		if (currentContent === record.targetContentAfter) {
			await writeProjectTargetContent(app, projectFile, targetView, record.targetContentBefore);
		}
	} catch (error) {
		console.error('[OBPM] Failed to roll back project content insertion.', {
			error,
			projectPath: projectFile.path,
		});
	}
}

async function writeProjectTargetContent(
	app: App,
	projectFile: TFile,
	targetView: MarkdownView | null,
	nextContent: string,
	insertionPlan?: OffsetInsertionPlan,
): Promise<string> {
	if (targetView && insertionPlan) {
		applyTextInsertion(targetView.editor, insertionPlan);
		await targetView.save();
		return targetView.editor.getValue();
	}

	if (targetView) {
		targetView.editor.setValue(nextContent);
		await targetView.save();
		return targetView.editor.getValue();
	}

	await app.vault.modify(projectFile, nextContent);
	return nextContent;
}

function resolveTargetProjectCandidate(
	options: SendContentToProjectFileOptions,
	projectCandidates: readonly ProjectCandidate[],
): ProjectResolution {
	const contribution = buildSourceContribution(
		options.app,
		options.file,
		options.relationProperty.trim(),
		options.displayProperty.trim(),
		options.cache,
	);
	return resolveAssociatedProjectCandidate({
		autoUseSingleOpenProject: options.autoMoveWhenSingleCandidate,
		openProjectCandidates: getOpenProjectCandidates(
			options.app,
			options.projectFileRecognition,
			{excludePath: options.file.path},
		).map(toProjectAssociationCandidate),
		projectCandidates: projectCandidates.map(toProjectAssociationCandidate),
		relatedTargetPaths: contribution?.targetPaths ?? [],
		sourcePath: options.file.path,
	});
}

function toProjectAssociationCandidate(candidate: ProjectCandidate): ProjectAssociationCandidateWithProject {
	return {
		...candidate,
		filePath: candidate.file.path,
	};
}
