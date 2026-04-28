import {TFile} from 'obsidian';
import OBPMPlugin from '../../main';
import {getPinnedProjectLocalization} from './pinned-project-localization';

export class PinnedProjectStatusBar {
	private readonly localization = getPinnedProjectLocalization();
	private itemEl: HTMLElement | null = null;

	constructor(private readonly plugin: OBPMPlugin) {}

	destroy(): void {
		if (!this.itemEl) {
			return;
		}

		this.itemEl.remove();
		this.itemEl = null;
	}

	refresh(): void {
		const projectPath = this.plugin.settings.pinnedProject.projectPath;
		if (!this.plugin.settings.pinnedProject.enabled || !projectPath) {
			this.destroy();
			return;
		}

		const itemEl = this.ensureItem();
		const projectFile = this.plugin.app.vault.getAbstractFileByPath(projectPath);
		if (projectFile instanceof TFile) {
			this.applyItemState(
				itemEl,
				this.localization.statusText(projectFile.basename),
				this.localization.statusTooltip(projectFile.path),
			);
			return;
		}

		this.applyItemState(
			itemEl,
			this.localization.statusMissingText,
			this.localization.statusMissingTooltip(projectPath),
		);
	}

	private applyItemState(itemEl: HTMLElement, text: string, tooltip: string): void {
		itemEl.setText(text);
		itemEl.setAttribute('aria-label', tooltip);
		itemEl.setAttribute('title', tooltip);
	}

	private ensureItem(): HTMLElement {
		if (!this.itemEl) {
			this.itemEl = this.plugin.addStatusBarItem();
			this.itemEl.addClass('obpm-pinned-project-status');
		}

		return this.itemEl;
	}
}
