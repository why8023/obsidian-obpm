import {App, ButtonComponent, Modal} from 'obsidian';

interface ProjectFolderSyncConfirmModalOptions {
	cancelLabel: string;
	description: string;
	submitLabel: string;
	title: string;
}

export class ProjectFolderSyncConfirmModal extends Modal {
	private resolver: ((value: boolean) => void) | null = null;
	private resolved = false;

	constructor(app: App, private readonly options: ProjectFolderSyncConfirmModalOptions) {
		super(app);
	}

	openAndGetConfirmation(): Promise<boolean> {
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
			.setCta()
			.setButtonText(this.options.submitLabel)
			.onClick(() => {
				this.resolve(true);
				this.close();
			});
	}

	private resolve(value: boolean): void {
		if (this.resolved) {
			return;
		}

		this.resolved = true;
		this.resolver?.(value);
	}
}
