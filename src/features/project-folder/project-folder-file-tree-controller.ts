import {App, TFile, TFolder, WorkspaceLeaf} from 'obsidian';
import {buildProjectFileOpenTarget} from './project-folder-utils';

const FILE_EXPLORER_FOLDER_TITLE_SELECTOR = '.nav-folder-title[data-path]';
const FILE_EXPLORER_FOLDER_TITLE_CONTENT_SELECTOR = '.nav-folder-title-content';
const OPEN_INDICATOR_SELECTOR = '.obpm-project-folder-open-indicator';

interface ProjectFolderFileTreeControllerOptions {
	getOpenIndicatorLabel: (fileName: string) => string;
	openProjectFile: (file: TFile) => Promise<void>;
}

export class ProjectFolderFileTreeController {
	private disposed = false;
	private readonly observer: MutationObserver | null = null;
	private refreshTimer: number | null = null;
	private readonly rootEl: HTMLElement | null;
	private readonly clickHandler = (event: MouseEvent) => {
		void this.handleClick(event);
	};

	constructor(
		private readonly app: App,
		private readonly leaf: WorkspaceLeaf,
		private readonly options: ProjectFolderFileTreeControllerOptions,
	) {
		this.rootEl = this.leaf.view.containerEl instanceof HTMLElement ? this.leaf.view.containerEl : null;
		this.rootEl?.addEventListener('click', this.clickHandler, true);
		if (this.rootEl) {
			this.observer = new MutationObserver(() => {
				this.requestRefresh();
			});
			this.observer.observe(this.rootEl, {
				attributes: true,
				attributeFilter: ['data-path'],
				childList: true,
				subtree: true,
			});
		}

		this.requestRefresh(0);
	}

	destroy(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		this.observer?.disconnect();
		this.rootEl?.removeEventListener('click', this.clickHandler, true);
		this.cleanup();
	}

	requestRefresh(delayMs = 100): void {
		if (this.disposed || !this.rootEl) {
			return;
		}

		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
		}

		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refresh();
		}, delayMs);
	}

	private cleanup(): void {
		if (!this.rootEl) {
			return;
		}

		for (const indicatorEl of Array.from(this.rootEl.querySelectorAll(OPEN_INDICATOR_SELECTOR))) {
			indicatorEl.remove();
		}
	}

	private ensureOpenIndicator(folderTitleEl: HTMLElement, projectFile: TFile): void {
		let indicatorEl = folderTitleEl.querySelector<HTMLButtonElement>(OPEN_INDICATOR_SELECTOR);
		if (!indicatorEl) {
			indicatorEl = document.createElement('button');
			indicatorEl.type = 'button';
			indicatorEl.className = 'clickable-icon obpm-project-folder-open-indicator';
			indicatorEl.dataset.obpmProjectFolderOpenIndicator = 'true';
			const contentEl = folderTitleEl.querySelector(FILE_EXPLORER_FOLDER_TITLE_CONTENT_SELECTOR);
			if (contentEl?.parentElement === folderTitleEl) {
				folderTitleEl.insertBefore(indicatorEl, contentEl.nextSibling);
			} else {
				folderTitleEl.appendChild(indicatorEl);
			}
		}

		const label = this.options.getOpenIndicatorLabel(projectFile.name);
		indicatorEl.dataset.obpmProjectFilePath = projectFile.path;
		indicatorEl.setAttribute('aria-label', label);
		indicatorEl.title = label;
	}

	private async handleClick(event: MouseEvent): Promise<void> {
		const targetEl = event.target instanceof Element ? event.target : null;
		const indicatorEl = targetEl?.closest<HTMLButtonElement>(OPEN_INDICATOR_SELECTOR) ?? null;
		if (!indicatorEl || !this.rootEl?.contains(indicatorEl)) {
			return;
		}

		const filePath = indicatorEl.dataset.obpmProjectFilePath;
		if (!filePath) {
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile) || file.extension !== 'md') {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		await this.options.openProjectFile(file);
	}

	private refresh(): void {
		if (this.disposed || !this.rootEl) {
			return;
		}

		const handledTitleEls = new Set<HTMLElement>();
		for (const folderTitleEl of Array.from(this.rootEl.querySelectorAll(FILE_EXPLORER_FOLDER_TITLE_SELECTOR))) {
			if (!(folderTitleEl instanceof HTMLElement)) {
				continue;
			}

			handledTitleEls.add(folderTitleEl);
			const folderPath = folderTitleEl.dataset.path;
			const folder = folderPath ? this.app.vault.getAbstractFileByPath(folderPath) : null;
			if (!(folder instanceof TFolder)) {
				this.removeOpenIndicator(folderTitleEl);
				continue;
			}

			const targetPath = buildProjectFileOpenTarget({
				folder: {
					name: folder.name,
					path: folder.path,
				},
				pathExists: (path) => {
					const file = this.app.vault.getAbstractFileByPath(path);
					return file instanceof TFile && file.extension === 'md';
				},
			});
			if (!targetPath) {
				this.removeOpenIndicator(folderTitleEl);
				continue;
			}

			const projectFile = this.app.vault.getAbstractFileByPath(targetPath);
			if (!(projectFile instanceof TFile) || projectFile.extension !== 'md') {
				this.removeOpenIndicator(folderTitleEl);
				continue;
			}

			this.ensureOpenIndicator(folderTitleEl, projectFile);
		}

		for (const indicatorEl of Array.from(this.rootEl.querySelectorAll(OPEN_INDICATOR_SELECTOR))) {
			const folderTitleEl = indicatorEl.closest<HTMLElement>(FILE_EXPLORER_FOLDER_TITLE_SELECTOR);
			if (!folderTitleEl || !handledTitleEls.has(folderTitleEl)) {
				indicatorEl.remove();
			}
		}
	}

	private removeOpenIndicator(folderTitleEl: HTMLElement): void {
		folderTitleEl.querySelector(OPEN_INDICATOR_SELECTOR)?.remove();
	}
}
