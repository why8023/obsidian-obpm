import {App, SuggestModal} from 'obsidian';
import {ProjectRoutingLocalization} from './localization';
import {ProjectCandidate} from './types';

interface ProjectRoutingSuggestModalOptions {
	candidates: readonly ProjectCandidate[];
	localization: ProjectRoutingLocalization;
}

export class ProjectRoutingSuggestModal extends SuggestModal<ProjectCandidate> {
	private chosenSuggestion: ProjectCandidate | null = null;
	private resolver: ((value: ProjectCandidate | null) => void) | null = null;
	private resolved = false;

	constructor(app: App, private readonly options: ProjectRoutingSuggestModalOptions) {
		super(app);

		this.emptyStateText = options.localization.modalEmptyStateText;
		this.limit = Math.max(options.candidates.length, 10);
		this.setPlaceholder(options.localization.modalPlaceholder);
		this.setInstructions([
			{command: 'Enter', purpose: options.localization.modalSelectInstructionPurpose},
			{command: 'Esc', purpose: options.localization.modalDismissInstructionPurpose},
		]);
	}

	openAndGetResult(): Promise<ProjectCandidate | null> {
		return new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}

	getSuggestions(query: string): ProjectCandidate[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return [...this.options.candidates];
		}

		return this.options.candidates.filter((candidate) => {
			const searchText = `${candidate.name} ${candidate.file.path}`.toLowerCase();
			return searchText.includes(normalizedQuery);
		});
	}

	onChooseSuggestion(item: ProjectCandidate): void {
		this.chosenSuggestion = item;
		this.resolve(item);
	}

	onClose(): void {
		super.onClose();
		window.setTimeout(() => {
			this.resolve(this.chosenSuggestion);
		}, 0);
	}

	onOpen(): void {
		void super.onOpen();
		this.titleEl.setText(this.options.localization.modalTitle);
	}

	renderSuggestion(candidate: ProjectCandidate, el: HTMLElement): void {
		el.createDiv({text: candidate.name});
		el.createDiv({
			cls: 'setting-item-description',
			text: candidate.folderPath || this.options.localization.rootFolderLabel,
		});
	}

	private resolve(value: ProjectCandidate | null) {
		if (this.resolved) {
			return;
		}

		this.resolved = true;
		this.resolver?.(value);
	}
}
