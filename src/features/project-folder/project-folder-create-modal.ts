import {App, ButtonComponent, Modal, TextComponent} from 'obsidian';

interface ProjectFolderCreateModalOptions {
	cancelLabel: string;
	description: string;
	inputPlaceholder: string;
	submitLabel: string;
	title: string;
	validate: (value: string) => string | null;
}

export class ProjectFolderCreateModal extends Modal {
	private errorEl: HTMLDivElement | null = null;
	private resolver: ((value: string | null) => void) | null = null;
	private resolved = false;
	private textComponent: TextComponent | null = null;

	constructor(app: App, private readonly options: ProjectFolderCreateModalOptions) {
		super(app);
	}

	openAndGetValue(): Promise<string | null> {
		return new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}

	onClose(): void {
		this.contentEl.empty();
		this.titleEl.empty();
		this.resolve(null);
	}

	onOpen(): void {
		this.titleEl.setText(this.options.title);
		this.contentEl.empty();
		this.contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: this.options.description,
		});

		const inputWrapperEl = this.contentEl.createDiv({cls: 'obpm-project-folder-create-modal-input'});
		this.textComponent = new TextComponent(inputWrapperEl)
			.setPlaceholder(this.options.inputPlaceholder)
			.onChange(() => {
				this.renderError(null);
			});

		this.textComponent.inputEl.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') {
				return;
			}

			event.preventDefault();
			this.submit();
		});

		this.errorEl = this.contentEl.createDiv({
			cls: 'obpm-project-folder-create-modal-error setting-item-description',
		});

		const buttonsEl = this.contentEl.createDiv({cls: 'modal-button-container'});
		new ButtonComponent(buttonsEl)
			.setButtonText(this.options.cancelLabel)
			.onClick(() => {
				this.close();
			});

		new ButtonComponent(buttonsEl)
			.setCta()
			.setButtonText(this.options.submitLabel)
			.onClick(() => {
				this.submit();
			});

		window.setTimeout(() => {
			this.textComponent?.inputEl.focus();
		}, 0);
	}

	private renderError(message: string | null): void {
		if (!this.errorEl) {
			return;
		}

		this.errorEl.textContent = message ?? '';
		this.errorEl.classList.toggle('is-visible', Boolean(message));
	}

	private resolve(value: string | null): void {
		if (this.resolved) {
			return;
		}

		this.resolved = true;
		this.resolver?.(value);
	}

	private submit(): void {
		const value = this.textComponent?.getValue().trim() ?? '';
		const errorMessage = this.options.validate(value);
		if (errorMessage) {
			this.renderError(errorMessage);
			this.textComponent?.inputEl.focus();
			return;
		}

		this.resolve(value);
		this.close();
	}
}
