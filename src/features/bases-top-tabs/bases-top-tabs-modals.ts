import {App, ButtonComponent, Modal, TextComponent} from 'obsidian';

interface TextPromptOptions {
	cancelLabel: string;
	description?: string;
	initialValue: string;
	inputPlaceholder?: string;
	submitLabel: string;
	title: string;
	validate?: (value: string) => string | null;
}

interface ConfirmOptions {
	cancelLabel: string;
	confirmLabel: string;
	description: string;
	title: string;
}

export class BasesTopTabsConfirmModal extends Modal {
	private resolver: ((value: boolean) => void) | null = null;
	private resolved = false;

	constructor(app: App, private readonly options: ConfirmOptions) {
		super(app);
	}

	openAndGetResult(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolver = resolve;
			this.open();
		});
	}

	onClose(): void {
		this.contentEl.empty();
		this.titleEl.empty();
		this.resolve(false);
	}

	onOpen(): void {
		this.titleEl.setText(this.options.title);
		this.contentEl.empty();
		this.contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: this.options.description,
		});

		const buttonsEl = this.contentEl.createDiv({cls: 'modal-button-container'});
		new ButtonComponent(buttonsEl)
			.setButtonText(this.options.cancelLabel)
			.onClick(() => {
				this.close();
			});

		new ButtonComponent(buttonsEl)
			.setWarning()
			.setButtonText(this.options.confirmLabel)
			.onClick(() => {
				this.resolve(true);
				this.close();
			});
	}

	private resolve(value: boolean) {
		if (this.resolved) {
			return;
		}

		this.resolved = true;
		this.resolver?.(value);
	}
}

export class BasesTopTabsTextPromptModal extends Modal {
	private errorEl: HTMLDivElement | null = null;
	private resolver: ((value: string | null) => void) | null = null;
	private resolved = false;
	private textComponent: TextComponent | null = null;

	constructor(app: App, private readonly options: TextPromptOptions) {
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

		if (this.options.description) {
			this.contentEl.createEl('p', {
				cls: 'setting-item-description',
				text: this.options.description,
			});
		}

		const inputWrapperEl = this.contentEl.createDiv({cls: 'obpm-bases-tabs-modal-input'});
		this.textComponent = new TextComponent(inputWrapperEl)
			.setValue(this.options.initialValue)
			.setPlaceholder(this.options.inputPlaceholder ?? '')
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
			cls: 'obpm-bases-tabs-modal-error setting-item-description',
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
			this.textComponent?.inputEl.select();
		}, 0);
	}

	private renderError(message: string | null) {
		if (!this.errorEl) {
			return;
		}

		this.errorEl.textContent = message ?? '';
		this.errorEl.classList.toggle('is-visible', Boolean(message));
	}

	private resolve(value: string | null) {
		if (this.resolved) {
			return;
		}

		this.resolved = true;
		this.resolver?.(value);
	}

	private submit() {
		const value = this.textComponent?.getValue().trim() ?? '';
		const errorMessage = this.options.validate?.(value) ?? null;
		if (errorMessage) {
			this.renderError(errorMessage);
			this.textComponent?.inputEl.focus();
			return;
		}

		this.resolve(value);
		this.close();
	}
}
