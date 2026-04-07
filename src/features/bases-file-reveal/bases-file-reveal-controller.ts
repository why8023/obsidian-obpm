import {TAbstractFile, ViewState, WorkspaceLeaf} from 'obsidian';
import OBPMPlugin from '../../main';

const BASES_ROW_SELECTOR = '.bases-tr';
const INTERNAL_LINK_SELECTOR = '.internal-link[data-href]';
const SOURCE_PATH_SELECTOR = '[data-source-path]';

interface FileExplorerViewLike {
	revealInFolder(file: TAbstractFile): void;
}

export class BasesFileRevealController {
	private disposed = false;
	private readonly rootEl: HTMLElement | null;
	private readonly clickHandler = (event: MouseEvent) => {
		void this.handleClick(event);
	};

	constructor(
		private readonly plugin: OBPMPlugin,
		private readonly leaf: WorkspaceLeaf,
	) {
		this.rootEl = this.leaf.view.containerEl instanceof HTMLElement ? this.leaf.view.containerEl : null;
		this.rootEl?.addEventListener('click', this.clickHandler, true);
	}

	destroy(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.rootEl?.removeEventListener('click', this.clickHandler, true);
	}

	private async handleClick(event: MouseEvent): Promise<void> {
		if (!shouldHandleAltClick(event)) {
			return;
		}

		const file = this.resolveTargetFile(event);
		if (!file) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		await this.revealInFileExplorer(file);
	}

	private resolveTargetFile(event: MouseEvent): TAbstractFile | null {
		const targetEl = event.target instanceof Element ? event.target : null;
		if (!targetEl) {
			return null;
		}

		const rowEl = targetEl.closest<HTMLElement>(BASES_ROW_SELECTOR);
		if (!rowEl) {
			return null;
		}

		const filePath = this.resolveFilePath(targetEl, rowEl);
		if (!filePath) {
			return null;
		}

		return this.plugin.app.vault.getAbstractFileByPath(filePath);
	}

	private resolveFilePath(targetEl: Element, rowEl: HTMLElement): string | null {
		const targetPath = this.resolvePathFromElement(targetEl);
		if (targetPath) {
			return targetPath;
		}

		const rowLinkEl = rowEl.querySelector<HTMLElement>(INTERNAL_LINK_SELECTOR);
		const rowLinkPath = this.resolvePathFromInternalLink(rowLinkEl);
		if (rowLinkPath) {
			return rowLinkPath;
		}

		return normalizePathValue(rowEl.querySelector<HTMLElement>(SOURCE_PATH_SELECTOR)?.dataset.sourcePath);
	}

	private resolvePathFromElement(targetEl: Element): string | null {
		const linkEl = targetEl.closest<HTMLElement>(INTERNAL_LINK_SELECTOR);
		const linkPath = this.resolvePathFromInternalLink(linkEl);
		if (linkPath) {
			return linkPath;
		}

		return normalizePathValue(targetEl.closest<HTMLElement>(SOURCE_PATH_SELECTOR)?.dataset.sourcePath);
	}

	private resolvePathFromInternalLink(linkEl: HTMLElement | null): string | null {
		const linkpath = normalizePathValue(linkEl?.dataset.href);
		if (!linkpath) {
			return null;
		}

		const sourcePath = this.getCurrentBaseFilePath() ?? '';
		const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
		if (resolvedFile) {
			return resolvedFile.path;
		}

		return this.plugin.app.vault.getAbstractFileByPath(linkpath)?.path ?? linkpath;
	}

	private getCurrentBaseFilePath(): string | null {
		const viewState = this.leaf.getViewState();
		if (viewState.type !== 'bases' || !isObjectRecord(viewState.state)) {
			return null;
		}

		const filePath = viewState.state.file;
		return typeof filePath === 'string' && filePath.length > 0 ? filePath : null;
	}

	private async revealInFileExplorer(file: TAbstractFile): Promise<void> {
		const fileExplorerLeaf = await this.ensureFileExplorerLeaf();
		if (!fileExplorerLeaf) {
			return;
		}

		const fileExplorerView = fileExplorerLeaf.view as Partial<FileExplorerViewLike>;
		if (typeof fileExplorerView.revealInFolder !== 'function') {
			return;
		}

		try {
			await this.plugin.app.workspace.revealLeaf(fileExplorerLeaf);
			fileExplorerView.revealInFolder(file);
		} catch (error) {
			console.error('[OBPM:bases-file-reveal] Failed to reveal the file in the file explorer.', {
				error,
				filePath: file.path,
			});
		}
	}

	private async ensureFileExplorerLeaf(): Promise<WorkspaceLeaf | null> {
		const existingLeaf = this.plugin.app.workspace.getLeavesOfType('file-explorer')[0];
		if (existingLeaf) {
			return existingLeaf;
		}

		const workspace = this.plugin.app.workspace;
		if (typeof workspace.ensureSideLeaf === 'function') {
			try {
				return await workspace.ensureSideLeaf('file-explorer', 'left', {
					active: false,
					reveal: true,
					split: false,
				});
			} catch (error) {
				console.error('[OBPM:bases-file-reveal] Failed to create a file explorer leaf with ensureSideLeaf.', error);
			}
		}

		const leftLeaf = workspace.getLeftLeaf(false);
		if (!leftLeaf) {
			return null;
		}

		try {
			const fileExplorerViewState: ViewState = {
				type: 'file-explorer',
				active: false,
			};
			await leftLeaf.setViewState(fileExplorerViewState);
			return leftLeaf;
		} catch (error) {
			console.error('[OBPM:bases-file-reveal] Failed to create a file explorer leaf.', error);
			return null;
		}
	}
}

function shouldHandleAltClick(event: MouseEvent): boolean {
	return event.button === 0
		&& event.altKey
		&& !event.ctrlKey
		&& !event.metaKey
		&& !event.shiftKey
		&& !event.defaultPrevented;
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
