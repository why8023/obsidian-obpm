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
		const targetPath = this.plugin.settings.pinnedRelationTarget.targetPath;
		if (!this.plugin.settings.pinnedRelationTarget.enabled || !targetPath) {
			this.destroy();
			return;
		}

		const itemEl = this.ensureItem();
		const targetFile = this.plugin.app.vault.getAbstractFileByPath(targetPath);
		if (targetFile instanceof TFile) {
			this.applyItemState(
				itemEl,
				this.localization.statusText(targetFile.basename),
				this.localization.statusTooltip(targetFile.path),
			);
			return;
		}

		this.applyItemState(
			itemEl,
			this.localization.statusMissingText,
			this.localization.statusMissingTooltip(targetPath),
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
