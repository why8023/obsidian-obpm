import {
	Component,
	Editor,
	EditorPosition,
	MarkdownFileInfo,
	MarkdownView,
	Notice,
	Platform,
	TAbstractFile,
	TFile,
	TFolder,
	WorkspaceLeaf,
	debounce,
	normalizePath,
} from 'obsidian';
import OBPMPlugin from '../../main';
import type {FileContentMoveModifierKey} from '../../settings';
import {getFileContentMoveLocalization} from './localization';
import {buildMovedContentList} from './markdown-list-converter';

const SOURCE_PATH_MIME = 'application/x-obpm-file-content-move-path';
const BASES_ROW_SELECTOR = '.bases-tr';
const INTERNAL_LINK_SELECTOR = '.internal-link[data-href]';
const SOURCE_PATH_SELECTOR = '[data-source-path]';
const FILE_EXPLORER_SOURCE_SELECTOR = '.nav-file, .nav-file-title, .tree-item-self';
const MAX_UNDO_ENTRIES = 20;

interface DragSourceResolution {
	dragEl: HTMLElement;
	file: TFile;
}

interface MoveUndoEntry {
	insertOffset: number;
	insertedText: string;
	sourceContent: string;
	sourcePath: string;
	targetContentAfter: string;
	targetContentBefore: string;
	targetPath: string;
}

interface RemovalPlan {
	end: number;
	nextContent: string;
	start: number;
}

class DragSourceController {
	private disposed = false;
	private pendingDragEl: HTMLElement | null = null;
	private pendingPath: string | null = null;
	private previousDraggable: boolean | null = null;
	private readonly dragEndHandler = () => {
		this.onSourceDragEnd();
		this.cleanupPendingDrag();
	};
	private readonly dragStartHandler = (event: DragEvent) => {
		this.handleDragStart(event);
	};
	private readonly mouseDownHandler = (event: MouseEvent) => {
		this.handleMouseDown(event);
	};
	private readonly mouseUpHandler = () => {
		this.cleanupPendingDrag();
	};

	constructor(
		private readonly rootEl: HTMLElement,
		private readonly isEnabled: () => boolean,
		private readonly getModifierKey: () => FileContentMoveModifierKey,
		private readonly onSourceDragEnd: () => void,
		private readonly onSourceDragStart: (sourcePath: string) => void,
		private readonly resolveDragSource: (targetEl: Element) => DragSourceResolution | null,
	) {
		this.rootEl.addEventListener('mousedown', this.mouseDownHandler, true);
		this.rootEl.addEventListener('dragstart', this.dragStartHandler, true);
		this.rootEl.addEventListener('dragend', this.dragEndHandler, true);
		window.addEventListener('mouseup', this.mouseUpHandler, true);
	}

	destroy(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.rootEl.removeEventListener('mousedown', this.mouseDownHandler, true);
		this.rootEl.removeEventListener('dragstart', this.dragStartHandler, true);
		this.rootEl.removeEventListener('dragend', this.dragEndHandler, true);
		window.removeEventListener('mouseup', this.mouseUpHandler, true);
		this.cleanupPendingDrag();
	}

	private cleanupPendingDrag(): void {
		if (this.pendingDragEl && this.previousDraggable !== null) {
			this.pendingDragEl.draggable = this.previousDraggable;
		}

		this.pendingDragEl = null;
		this.pendingPath = null;
		this.previousDraggable = null;
	}

	private handleDragStart(event: DragEvent): void {
		if (!this.isEnabled() || !event.dataTransfer) {
			this.cleanupPendingDrag();
			return;
		}

		const targetEl = event.target instanceof Element ? event.target : null;
		const resolved = targetEl ? this.resolveDragSource(targetEl) : null;
		const sourcePath = this.pendingPath ?? (eventMatchesModifier(event, this.getModifierKey()) ? resolved?.file.path : null);
		if (!sourcePath) {
			this.cleanupPendingDrag();
			return;
		}

		event.dataTransfer.setData(SOURCE_PATH_MIME, sourcePath);
		event.dataTransfer.setData('text/plain', sourcePath);
		event.dataTransfer.effectAllowed = 'move';
		const dragImageEl = this.pendingDragEl ?? resolved?.dragEl;
		if (dragImageEl) {
			event.dataTransfer.setDragImage(dragImageEl, 12, 12);
		}

		this.onSourceDragStart(sourcePath);
		event.stopPropagation();
	}

	private handleMouseDown(event: MouseEvent): void {
		this.cleanupPendingDrag();

		if (event.button !== 0 || !this.isEnabled() || !eventMatchesModifier(event, this.getModifierKey())) {
			return;
		}

		const targetEl = event.target instanceof Element ? event.target : null;
		if (!targetEl) {
			return;
		}

		const resolved = this.resolveDragSource(targetEl);
		if (!resolved) {
			return;
		}

		this.pendingDragEl = resolved.dragEl;
		this.pendingPath = resolved.file.path;
		this.previousDraggable = resolved.dragEl.draggable;
		resolved.dragEl.draggable = true;
	}
}

export class FileContentMoveFeature extends Component {
	private activeDragSourcePath: string | null = null;
	private readonly basesControllers = new Map<WorkspaceLeaf, DragSourceController>();
	private readonly fileExplorerControllers = new Map<WorkspaceLeaf, DragSourceController>();
	private readonly localization = getFileContentMoveLocalization();
	private readonly syncControllers = debounce(() => {
		this.reconcileControllers();
	}, 100, true);
	private readonly undoStack: MoveUndoEntry[] = [];
	private workQueue = Promise.resolve();

	constructor(private readonly plugin: OBPMPlugin) {
		super();
	}

	onload(): void {
		this.plugin.addCommand({
			id: 'undo-last-dragged-content-move',
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

		this.registerEvent(this.plugin.app.workspace.on('editor-drop', (event, editor, info) => {
			void this.handleEditorDrop(event, editor, info);
		}));

		this.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
			this.requestSync();
		}));

		this.registerEvent(this.plugin.app.workspace.on('layout-change', () => {
			this.requestSync();
		}));

		this.registerEvent(this.plugin.app.workspace.on('file-open', () => {
			this.requestSync();
		}));

		this.plugin.app.workspace.onLayoutReady(() => {
			this.requestSync();
		});

		this.requestSync();
	}

	onunload(): void {
		this.syncControllers.cancel();
		this.destroyAllControllers();
	}

	async refresh(): Promise<void> {
		this.syncControllers.cancel();
		this.reconcileControllers();
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

	private async createSourceFileFromUndo(entry: MoveUndoEntry): Promise<void> {
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

	private destroyAllControllers(): void {
		this.activeDragSourcePath = null;

		for (const controller of this.basesControllers.values()) {
			controller.destroy();
		}

		for (const controller of this.fileExplorerControllers.values()) {
			controller.destroy();
		}

		this.basesControllers.clear();
		this.fileExplorerControllers.clear();
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

	private getSettings() {
		return this.plugin.settings.fileContentMove;
	}

	private async handleEditorDrop(event: DragEvent, editor: Editor, info: MarkdownFileInfo): Promise<void> {
		if (!this.getSettings().enabled || event.defaultPrevented) {
			return;
		}

		const sourcePath = event.dataTransfer?.getData(SOURCE_PATH_MIME) || this.activeDragSourcePath;
		if (!sourcePath) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();

		try {
			await this.enqueue(async () => {
				await this.moveSourceContentIntoEditor(sourcePath, editor, info);
			});
		} finally {
			this.activeDragSourcePath = null;
		}
	}

	private isEnabledForBases(): boolean {
		return this.getSettings().enabled;
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
		editor: Editor,
		info: MarkdownFileInfo,
	): Promise<void> {
		const sourceFile = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
		const targetFile = info.file;

		if (!this.isMarkdownFile(sourceFile)) {
			new Notice(this.localization.sourceMissingNotice);
			return;
		}

		if (!this.isMarkdownFile(targetFile)) {
			new Notice(this.localization.targetMissingNotice);
			return;
		}

		if (sourceFile.path === targetFile.path) {
			new Notice(this.localization.sameFileNotice);
			return;
		}

		const originalSourceName = sourceFile.name;
		const originalSourcePath = sourceFile.path;
		const originalTargetName = targetFile.name;
		const originalTargetPath = targetFile.path;
		const sourceContent = await this.plugin.app.vault.read(sourceFile);
		const targetContentBefore = editor.getValue();
		const insertOffset = editor.posToOffset(editor.getCursor());
		const listBlock = buildMovedContentList({
			sourceBasename: sourceFile.basename,
			sourceContent,
			stripSingleH1: this.getSettings().stripSingleH1,
		});
		const insertedText = buildInsertionText(targetContentBefore, insertOffset, listBlock);

		try {
			this.applyTextInsertion(editor, insertOffset, insertedText);
			await this.saveEditorTarget(info, targetFile, editor);
			await this.plugin.app.fileManager.trashFile(sourceFile);

			this.pushUndoEntry({
				insertOffset,
				insertedText,
				sourceContent,
				sourcePath: originalSourcePath,
				targetContentAfter: editor.getValue(),
				targetContentBefore,
				targetPath: originalTargetPath,
			});
			new Notice(this.localization.moveNotice(originalSourceName, originalTargetName));
		} catch (error) {
			console.error('[OBPM:file-content-move] Failed to move source content into the target editor.', {
				error,
				sourcePath: originalSourcePath,
				targetPath: originalTargetPath,
			});
			await this.rollbackEditorInsertion(editor, info, targetFile, insertOffset, insertedText);
			new Notice(this.localization.moveFailureNotice);
		}
	}

	private pushUndoEntry(entry: MoveUndoEntry): void {
		this.undoStack.push(entry);
		if (this.undoStack.length > MAX_UNDO_ENTRIES) {
			this.undoStack.shift();
		}
	}

	private reconcileControllerMap(
		leaves: readonly WorkspaceLeaf[],
		controllers: Map<WorkspaceLeaf, DragSourceController>,
		createController: (leaf: WorkspaceLeaf) => DragSourceController | null,
	): void {
		const activeLeaves = new Set(leaves);

		for (const [leaf, controller] of [...controllers.entries()]) {
			if (activeLeaves.has(leaf)) {
				continue;
			}

			controller.destroy();
			controllers.delete(leaf);
		}

		for (const leaf of leaves) {
			if (controllers.has(leaf)) {
				continue;
			}

			const controller = createController(leaf);
			if (controller) {
				controllers.set(leaf, controller);
			}
		}
	}

	private reconcileControllers(): void {
		if (!this.getSettings().enabled) {
			this.destroyAllControllers();
			return;
		}

		this.reconcileControllerMap(
			this.plugin.app.workspace.getLeavesOfType('bases'),
			this.basesControllers,
			(leaf) => this.createBasesController(leaf),
		);

		if (!this.getSettings().enableFileExplorer) {
			for (const controller of this.fileExplorerControllers.values()) {
				controller.destroy();
			}
			this.fileExplorerControllers.clear();
			return;
		}

		this.reconcileControllerMap(
			this.plugin.app.workspace.getLeavesOfType('file-explorer'),
			this.fileExplorerControllers,
			(leaf) => this.createFileExplorerController(leaf),
		);
	}

	private createBasesController(leaf: WorkspaceLeaf): DragSourceController | null {
		const rootEl = leaf.view.containerEl instanceof HTMLElement ? leaf.view.containerEl : null;
		if (!rootEl) {
			return null;
		}

		return new DragSourceController(
			rootEl,
			() => this.isEnabledForBases(),
			() => this.getSettings().modifierKey,
			() => {
				this.activeDragSourcePath = null;
			},
			(sourcePath) => {
				this.activeDragSourcePath = sourcePath;
			},
			(targetEl) => this.resolveBasesDragSource(leaf, targetEl),
		);
	}

	private createFileExplorerController(leaf: WorkspaceLeaf): DragSourceController | null {
		const rootEl = leaf.view.containerEl instanceof HTMLElement ? leaf.view.containerEl : null;
		if (!rootEl) {
			return null;
		}

		return new DragSourceController(
			rootEl,
			() => this.isEnabledForFileExplorer(),
			() => this.getSettings().modifierKey,
			() => {
				this.activeDragSourcePath = null;
			},
			(sourcePath) => {
				this.activeDragSourcePath = sourcePath;
			},
			(targetEl) => this.resolveFileExplorerDragSource(rootEl, targetEl),
		);
	}

	private removeInsertedText(currentContent: string, entry: MoveUndoEntry): RemovalPlan | null {
		const exactStart = entry.insertOffset;
		const exactEnd = exactStart + entry.insertedText.length;
		if (currentContent.slice(exactStart, exactEnd) === entry.insertedText) {
			return {
				end: exactEnd,
				nextContent: currentContent.slice(0, exactStart) + currentContent.slice(exactEnd),
				start: exactStart,
			};
		}

		if (currentContent === entry.targetContentAfter) {
			return {
				end: exactEnd,
				nextContent: entry.targetContentBefore,
				start: exactStart,
			};
		}

		const singleOccurrenceStart = findSingleOccurrence(currentContent, entry.insertedText);
		if (singleOccurrenceStart !== null) {
			const singleOccurrenceEnd = singleOccurrenceStart + entry.insertedText.length;
			return {
				end: singleOccurrenceEnd,
				nextContent: currentContent.slice(0, singleOccurrenceStart) + currentContent.slice(singleOccurrenceEnd),
				start: singleOccurrenceStart,
			};
		}

		return null;
	}

	private requestSync(): void {
		if (!this.getSettings().enabled) {
			this.destroyAllControllers();
			return;
		}

		this.syncControllers();
	}

	private resolveBasesDragSource(leaf: WorkspaceLeaf, targetEl: Element): DragSourceResolution | null {
		const rowEl = targetEl.closest<HTMLElement>(BASES_ROW_SELECTOR);
		if (!rowEl) {
			return null;
		}

		const filePath = this.resolveBasesFilePath(leaf, targetEl, rowEl);
		const file = filePath ? this.resolveMarkdownFile(filePath, this.getCurrentBaseFilePath(leaf) ?? '') : null;
		if (!file) {
			return null;
		}

		return {
			dragEl: targetEl.closest<HTMLElement>(INTERNAL_LINK_SELECTOR) ?? rowEl,
			file,
		};
	}

	private resolveBasesFilePath(leaf: WorkspaceLeaf, targetEl: Element, rowEl: HTMLElement): string | null {
		const targetPath = this.resolvePathFromBasesElement(leaf, targetEl);
		if (targetPath) {
			return targetPath;
		}

		const rowLinkEl = rowEl.querySelector<HTMLElement>(INTERNAL_LINK_SELECTOR);
		const rowLinkPath = this.resolvePathFromInternalLink(leaf, rowLinkEl);
		if (rowLinkPath) {
			return rowLinkPath;
		}

		return normalizePathValue(rowEl.querySelector<HTMLElement>(SOURCE_PATH_SELECTOR)?.dataset.sourcePath);
	}

	private resolveFileExplorerDragSource(rootEl: HTMLElement, targetEl: Element): DragSourceResolution | null {
		const sourceEl = targetEl.closest<HTMLElement>(FILE_EXPLORER_SOURCE_SELECTOR);
		if (!sourceEl || !rootEl.contains(sourceEl)) {
			return null;
		}

		const filePath = this.resolvePathFromElementAncestry(rootEl, sourceEl);
		const file = filePath ? this.resolveMarkdownFile(filePath, '') : null;
		if (!file) {
			return null;
		}

		return {
			dragEl: sourceEl,
			file,
		};
	}

	private resolveMarkdownFile(path: string, sourcePath: string): TFile | null {
		const normalizedPath = normalizePathValue(path);
		if (!normalizedPath) {
			return null;
		}

		const directFile = this.plugin.app.vault.getAbstractFileByPath(normalizePath(normalizedPath));
		if (this.isMarkdownFile(directFile)) {
			return directFile;
		}

		const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(normalizedPath, sourcePath);
		return this.isMarkdownFile(resolvedFile) ? resolvedFile : null;
	}

	private resolvePathFromBasesElement(leaf: WorkspaceLeaf, targetEl: Element): string | null {
		const linkEl = targetEl.closest<HTMLElement>(INTERNAL_LINK_SELECTOR);
		const linkPath = this.resolvePathFromInternalLink(leaf, linkEl);
		if (linkPath) {
			return linkPath;
		}

		return normalizePathValue(targetEl.closest<HTMLElement>(SOURCE_PATH_SELECTOR)?.dataset.sourcePath);
	}

	private resolvePathFromElementAncestry(rootEl: HTMLElement, startEl: Element): string | null {
		let currentEl: Element | null = startEl;
		while (currentEl && currentEl !== rootEl.parentElement) {
			if (currentEl instanceof HTMLElement) {
				const path = normalizePathValue(
					currentEl.dataset.path
					?? currentEl.dataset.filePath
					?? currentEl.dataset.sourcePath
					?? currentEl.dataset.href
					?? currentEl.getAttribute('data-path')
					?? currentEl.getAttribute('data-file-path')
					?? currentEl.getAttribute('data-source-path')
					?? currentEl.getAttribute('data-href')
					?? undefined,
				);
				if (path) {
					return path;
				}
			}

			if (currentEl === rootEl) {
				break;
			}

			currentEl = currentEl.parentElement;
		}

		return null;
	}

	private resolvePathFromInternalLink(leaf: WorkspaceLeaf, linkEl: HTMLElement | null): string | null {
		const linkpath = normalizePathValue(linkEl?.dataset.href);
		if (!linkpath) {
			return null;
		}

		const sourcePath = this.getCurrentBaseFilePath(leaf) ?? '';
		const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
		if (resolvedFile) {
			return resolvedFile.path;
		}

		return this.plugin.app.vault.getAbstractFileByPath(linkpath)?.path ?? linkpath;
	}

	private getCurrentBaseFilePath(leaf: WorkspaceLeaf): string | null {
		const viewState = leaf.getViewState();
		if (viewState.type !== 'bases' || !isObjectRecord(viewState.state)) {
			return null;
		}

		const filePath = viewState.state.file;
		return typeof filePath === 'string' && filePath.length > 0 ? filePath : null;
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

	private async saveEditorTarget(info: MarkdownFileInfo, targetFile: TFile, editor: Editor): Promise<void> {
		if (hasSaveMethod(info)) {
			await info.save();
			return;
		}

		await this.plugin.app.vault.modify(targetFile, editor.getValue());
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

	private async undoMove(entry: MoveUndoEntry): Promise<void> {
		const targetFile = this.plugin.app.vault.getAbstractFileByPath(entry.targetPath);
		if (!this.isMarkdownFile(targetFile)) {
			throw new Error('Target markdown file no longer exists.');
		}

		const openTargetView = this.findOpenMarkdownView(entry.targetPath);
		const currentContent = openTargetView?.editor.getValue() ?? await this.plugin.app.vault.read(targetFile);
		const removalPlan = this.removeInsertedText(currentContent, entry);
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

function buildInsertionText(content: string, insertOffset: number, block: string): string {
	return `${getBlockPrefix(content, insertOffset)}${block}${getBlockSuffix(content, insertOffset)}`;
}

function eventMatchesModifier(event: MouseEvent, modifierKey: FileContentMoveModifierKey): boolean {
	const resolvedModifier = resolvePlatformModifier(modifierKey);
	return event.altKey === (resolvedModifier === 'alt')
		&& event.ctrlKey === (resolvedModifier === 'ctrl')
		&& event.metaKey === (resolvedModifier === 'meta')
		&& event.shiftKey === (resolvedModifier === 'shift');
}

function findSingleOccurrence(content: string, value: string): number | null {
	const firstIndex = content.indexOf(value);
	if (firstIndex < 0) {
		return null;
	}

	return content.indexOf(value, firstIndex + value.length) < 0 ? firstIndex : null;
}

function getBlockPrefix(content: string, insertOffset: number): string {
	if (insertOffset <= 0) {
		return '';
	}

	const before = content.slice(0, insertOffset);
	if (/\n[ \t]*\n[ \t]*$/.test(before)) {
		return '';
	}

	return before.endsWith('\n') ? '\n' : '\n\n';
}

function getBlockSuffix(content: string, insertOffset: number): string {
	if (insertOffset >= content.length) {
		return '';
	}

	const after = content.slice(insertOffset);
	if (after.startsWith('\n\n')) {
		return '';
	}

	return after.startsWith('\n') ? '\n' : '\n\n';
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

function isMacLike(): boolean {
	return Platform.isMacOS;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function normalizePathValue(value: string | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalizedValue = value.trim();
	return normalizedValue.length > 0 ? normalizedValue : null;
}

function resolvePlatformModifier(modifierKey: FileContentMoveModifierKey): Exclude<FileContentMoveModifierKey, 'mod'> {
	if (modifierKey !== 'mod') {
		return modifierKey;
	}

	return isMacLike() ? 'meta' : 'ctrl';
}
