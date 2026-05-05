import {
	Component,
	Editor,
	EditorPosition,
	MarkdownFileInfo,
	MarkdownView,
	Menu,
	Notice,
	TAbstractFile,
	TFile,
	TFolder,
	normalizePath,
} from 'obsidian';
import OBPMPlugin from '../../main';
import {sendContentToTarget, SentContentTransactionRecord} from '../sent-content/send-transaction';
import {buildMovedContentList} from '../sent-content/source-content';
import {buildOffsetInsertionPlan, removeInsertedText, RemovalPlan} from '../sent-content/target-insertion';
import {getFileContentMoveLocalization} from './localization';

const MAX_UNDO_ENTRIES = 20;
const TARGET_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedEditorTarget {
	filePath: string;
	insertOffset: number;
	recordedAt: number;
}

interface EditorInsertionTarget {
	editor: Editor;
	file: TFile;
	info: MarkdownFileInfo;
	insertOffset: number;
}

export class FileContentMoveFeature extends Component {
	private cachedEditorTarget: CachedEditorTarget | null = null;
	private readonly captureTimeouts = new Set<number>();
	private readonly localization = getFileContentMoveLocalization();
	private readonly undoStack: SentContentTransactionRecord[] = [];
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload(): void {
		this.plugin.addCommand({
			id: 'undo-last-sent-content-move',
			name: this.localization.undoCommandName,
			checkCallback: (checking) => {
				if (this.undoStack.length === 0) {
					return false;
				}

				if (!checking) {
					void this.undoLastMove();
				}

				return true;
			},
		});

		this.registerEditorTargetTracking();

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

		this.plugin.app.workspace.onLayoutReady(() => {
			this.scheduleActiveEditorCapture();
		});
	}

	onunload(): void {
		for (const timeout of this.captureTimeouts) {
			window.clearTimeout(timeout);
		}
		this.captureTimeouts.clear();
	}

	async refresh(): Promise<void> {
		return Promise.resolve();
	}

	private applyRemovalToEditor(editor: Editor, removalPlan: RemovalPlan): void {
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
		}, 'obpm-file-content-move-undo');
	}

	private applyTextInsertion(editor: Editor, insertOffset: number, insertedText: string): void {
		const from = editor.offsetToPos(insertOffset);
		const end = getPositionAfterText(from, insertedText);
		editor.transaction({
			changes: [{
				from,
				text: insertedText,
			}],
			selection: {
				from: end,
				to: end,
			},
		}, 'obpm-file-content-move');
	}

	private cacheEditorTarget(editor: Editor, file: TFile, insertOffset: number): void {
		this.cachedEditorTarget = {
			filePath: file.path,
			insertOffset: clamp(insertOffset, 0, editor.getValue().length),
			recordedAt: Date.now(),
		};
	}

	private cacheEditorTargetFromInfo(info: MarkdownFileInfo | null): void {
		if (!info?.editor || !this.isMarkdownFile(info.file)) {
			return;
		}

		this.cacheEditorTarget(info.editor, info.file, info.editor.posToOffset(info.editor.getCursor()));
	}

	private async createSourceFileFromUndo(entry: SentContentTransactionRecord): Promise<void> {
		const existingEntry = this.plugin.app.vault.getAbstractFileByPath(entry.sourcePath);
		if (existingEntry) {
			if (!(existingEntry instanceof TFile)) {
				throw new Error('Source restore path is occupied by a folder.');
			}

			const existingContent = await this.plugin.app.vault.read(existingEntry);
			if (existingContent !== entry.sourceContent) {
				throw new Error('Source restore path is occupied by another file.');
			}

			return;
		}

		await this.ensureParentFolderExists(entry.sourcePath);
		await this.plugin.app.vault.create(entry.sourcePath, entry.sourceContent);
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (!folderPath) {
			return;
		}

		const existingEntry = this.plugin.app.vault.getAbstractFileByPath(folderPath);
		if (existingEntry) {
			if (existingEntry instanceof TFolder) {
				return;
			}

			throw new Error(`Cannot create folder because a file already exists at ${folderPath}.`);
		}

		const parentFolderPath = getParentFolderPath(folderPath);
		if (parentFolderPath) {
			await this.ensureFolderExists(parentFolderPath);
		}

		await this.plugin.app.vault.createFolder(folderPath);
	}

	private async ensureParentFolderExists(filePath: string): Promise<void> {
		await this.ensureFolderExists(getParentFolderPath(filePath));
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		this.workQueue = this.workQueue.then(task, task);
		return this.workQueue;
	}

	private findOpenMarkdownView(filePath: string): MarkdownView | null {
		let matchedView: MarkdownView | null = null;
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
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

	private captureActiveEditorTarget(): void {
		this.cacheEditorTargetFromInfo(this.getActiveEditorInfo());
	}

	private getActiveEditorInfo(): MarkdownFileInfo | null {
		const activeEditor = this.plugin.app.workspace.activeEditor;
		if (activeEditor?.editor) {
			return activeEditor;
		}

		const activeMarkdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		return activeMarkdownView?.editor ? activeMarkdownView : null;
	}

	private getSettings() {
		return this.plugin.settings.fileContentMove;
	}

	private getTargetMenuLabel(): string {
		return this.localization.menuItemLabel(this.resolveEditorTarget()?.file.name ?? null);
	}

	private isEnabledForFileExplorer(): boolean {
		const settings = this.getSettings();
		return settings.enabled && settings.enableFileExplorer;
	}

	private isMarkdownFile(file: TAbstractFile | null): file is TFile {
		return file instanceof TFile && file.extension === 'md';
	}

	private async moveSourceContentIntoEditor(
		sourcePath: string,
		target: EditorInsertionTarget,
	): Promise<boolean> {
		const sourceFile = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
		const {editor, file: targetFile, info} = target;

		if (!this.isMarkdownFile(sourceFile)) {
			new Notice(this.localization.sourceMissingNotice);
			return false;
		}

		if (sourceFile.path === targetFile.path) {
			new Notice(this.localization.sameFileNotice);
			return false;
		}

		const originalSourceName = sourceFile.name;
		const originalSourcePath = sourceFile.path;
		const originalTargetName = targetFile.name;
		const originalTargetPath = targetFile.path;
		const targetContentBefore = editor.getValue();
		let transactionRecord: SentContentTransactionRecord | null = null;

		try {
			transactionRecord = await sendContentToTarget({
				buildInsertionPlan: ({sourceContent, targetContentBefore}) => {
					const listBlock = buildMovedContentList({
						sourceBasename: sourceFile.basename,
						sourceContent,
						stripSingleH1: this.getSettings().stripSingleH1,
					});
					return buildOffsetInsertionPlan({
						block: listBlock,
						content: targetContentBefore,
						insertOffset: target.insertOffset,
					});
				},
				readSourceContent: async () => this.plugin.app.vault.read(sourceFile),
				readTargetContent: async () => targetContentBefore,
				rollbackTargetContent: async (record) => {
					await this.rollbackEditorInsertion(editor, info, targetFile, record.insertOffset, record.insertedText);
				},
				sourcePath: originalSourcePath,
				targetPath: originalTargetPath,
				trashSource: async () => {
					await this.plugin.app.fileManager.trashFile(sourceFile);
				},
				writeTargetContent: async (_nextContent, insertionPlan) => {
					this.applyTextInsertion(editor, insertionPlan.offset, insertionPlan.insertedText);
					await this.saveEditorTarget(info, targetFile, editor);
					return editor.getValue();
				},
			});
			this.pushUndoEntry(transactionRecord);
			this.cacheEditorTarget(editor, targetFile, transactionRecord.insertOffset + transactionRecord.insertedText.length);
			new Notice(this.localization.moveNotice(originalSourceName, originalTargetName));
			return true;
		} catch (error) {
			console.error('[OBPM:file-content-move] Failed to move source content into the target editor.', {
				error,
				sourcePath: originalSourcePath,
				targetPath: originalTargetPath,
			});
			if (!transactionRecord) {
				await this.rollbackEditorInsertionFromContent(editor, info, targetFile, targetContentBefore);
			}
			new Notice(this.localization.moveFailureNotice);
			return false;
		}
	}

	private pushUndoEntry(entry: SentContentTransactionRecord): void {
		this.undoStack.push(entry);
		if (this.undoStack.length > MAX_UNDO_ENTRIES) {
			this.undoStack.shift();
		}
	}

	private registerMenuItem(menu: Menu, file: TAbstractFile): void {
		if (!this.isEnabledForFileExplorer() || !this.isMarkdownFile(file)) {
			return;
		}

		menu.addItem((item) => item
			.setTitle(this.getTargetMenuLabel())
			.setIcon('send')
			.onClick(() => {
				void this.sendFileToActiveCursor(file);
			}));
	}

	private registerEditorTargetTracking(): void {
		this.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
			this.scheduleActiveEditorCapture();
		}));
		this.registerEvent(this.plugin.app.workspace.on('file-open', () => {
			this.scheduleActiveEditorCapture();
		}));
		this.registerEvent(this.plugin.app.workspace.on('editor-change', (_editor, info) => {
			this.cacheEditorTargetFromInfo(info);
		}));
		this.registerDomEvent(document, 'keyup', () => {
			this.scheduleActiveEditorCapture();
		});
		this.registerDomEvent(document, 'mouseup', () => {
			this.scheduleActiveEditorCapture();
		});
		this.registerDomEvent(document, 'focusin', () => {
			this.scheduleActiveEditorCapture();
		});
	}

	private async rollbackEditorInsertion(
		editor: Editor,
		info: MarkdownFileInfo,
		targetFile: TFile,
		insertOffset: number,
		insertedText: string,
	): Promise<void> {
		const currentContent = editor.getValue();
		if (currentContent.slice(insertOffset, insertOffset + insertedText.length) !== insertedText) {
			return;
		}

		this.applyRemovalToEditor(editor, {
			end: insertOffset + insertedText.length,
			nextContent: currentContent.slice(0, insertOffset) + currentContent.slice(insertOffset + insertedText.length),
			start: insertOffset,
		});
		await this.saveEditorTarget(info, targetFile, editor);
	}

	private async rollbackEditorInsertionFromContent(
		editor: Editor,
		info: MarkdownFileInfo,
		targetFile: TFile,
		targetContentBefore: string,
	): Promise<void> {
		editor.setValue(targetContentBefore);
		await this.saveEditorTarget(info, targetFile, editor);
	}

	private async saveEditorTarget(info: MarkdownFileInfo, targetFile: TFile, editor: Editor): Promise<void> {
		if (hasSaveMethod(info)) {
			await info.save();
			return;
		}

		await this.plugin.app.vault.modify(targetFile, editor.getValue());
	}

	private resolveCachedEditorTarget(): EditorInsertionTarget | null {
		if (!this.cachedEditorTarget || Date.now() - this.cachedEditorTarget.recordedAt > TARGET_CACHE_TTL_MS) {
			return null;
		}

		const targetFile = this.plugin.app.vault.getAbstractFileByPath(this.cachedEditorTarget.filePath);
		if (!this.isMarkdownFile(targetFile)) {
			return null;
		}

		const openTargetView = this.findOpenMarkdownView(targetFile.path);
		if (!openTargetView) {
			return null;
		}

		return {
			editor: openTargetView.editor,
			file: targetFile,
			info: openTargetView,
			insertOffset: clamp(this.cachedEditorTarget.insertOffset, 0, openTargetView.editor.getValue().length),
		};
	}

	private resolveEditorInfoTarget(info: MarkdownFileInfo | null): EditorInsertionTarget | null {
		if (!info?.editor || !this.isMarkdownFile(info.file)) {
			return null;
		}

		return {
			editor: info.editor,
			file: info.file,
			info,
			insertOffset: info.editor.posToOffset(info.editor.getCursor()),
		};
	}

	private resolveEditorTarget(): EditorInsertionTarget | null {
		const activeTarget = this.resolveEditorInfoTarget(this.getActiveEditorInfo());
		if (activeTarget) {
			this.cacheEditorTarget(activeTarget.editor, activeTarget.file, activeTarget.insertOffset);
			return activeTarget;
		}

		return this.resolveCachedEditorTarget();
	}

	private scheduleActiveEditorCapture(): void {
		const timeout = window.setTimeout(() => {
			this.captureTimeouts.delete(timeout);
			this.captureActiveEditorTarget();
		}, 0);
		this.captureTimeouts.add(timeout);
	}

	private async sendFileToActiveCursor(sourceFile: TFile): Promise<void> {
		const target = this.resolveEditorTarget();
		if (!target) {
			new Notice(this.localization.targetMissingNotice);
			return;
		}

		await this.enqueue(async () => {
			await this.moveSourceContentIntoEditor(sourceFile.path, target);
		});
	}

	private async undoLastMove(): Promise<void> {
		const entry = this.undoStack.pop();
		if (!entry) {
			new Notice(this.localization.undoNoOperationNotice);
			return;
		}

		await this.enqueue(async () => {
			try {
				await this.undoMove(entry);
				new Notice(this.localization.undoSuccessNotice);
			} catch (error) {
				this.undoStack.push(entry);
				console.error('[OBPM:file-content-move] Failed to undo the last content move.', {
					error,
					sourcePath: entry.sourcePath,
					targetPath: entry.targetPath,
				});
				new Notice(error instanceof Error && error.message.includes('occupied')
					? this.localization.undoSourceConflictNotice
					: this.localization.undoFailureNotice);
			}
		});
	}

	private async undoMove(entry: SentContentTransactionRecord): Promise<void> {
		const targetFile = this.plugin.app.vault.getAbstractFileByPath(entry.targetPath);
		if (!this.isMarkdownFile(targetFile)) {
			throw new Error('Target markdown file no longer exists.');
		}

		const openTargetView = this.findOpenMarkdownView(entry.targetPath);
		const currentContent = openTargetView?.editor.getValue() ?? await this.plugin.app.vault.read(targetFile);
		const removalPlan = removeInsertedText(currentContent, entry);
		if (!removalPlan) {
			throw new Error('Inserted content could not be found in target file.');
		}

		await this.createSourceFileFromUndo(entry);

		if (openTargetView) {
			this.applyRemovalToEditor(openTargetView.editor, removalPlan);
			await openTargetView.save();
			return;
		}

		await this.plugin.app.vault.modify(targetFile, removalPlan.nextContent);
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
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

function hasSaveMethod(value: MarkdownFileInfo): value is MarkdownView {
	return typeof (value as Partial<MarkdownView>).save === 'function';
}
