import OBPMPlugin from '../../main';
import {getProjectRoutingLocalization} from './localization';
import {resolveCurrentProject} from './project-resolver';

export class ProjectRoutingStatusBar {
	private readonly localization = getProjectRoutingLocalization();
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
		if (!this.plugin.settings.projectRouting.enabled || !this.plugin.settings.projectRouting.showStatusBar) {
			this.destroy();
			return;
		}

		const itemEl = this.ensureItem();
		const resolution = resolveCurrentProject(
			this.plugin.app,
			this.plugin.app.workspace.getActiveFile(),
			{
				projectFileRules: this.plugin.settings.projectRouting.projectFileRules,
				projectSubfolderPath: this.plugin.settings.projectRouting.projectSubfolderPath,
				recognizeFilenameMatchesFolderAsProject:
					this.plugin.settings.projectRouting.recognizeFilenameMatchesFolderAsProject,
			},
		);

		switch (resolution.kind) {
			case 'project': {
				const folderPath = resolution.candidate.folderPath || this.localization.rootFolderLabel;
				this.applyItemState(
					itemEl,
					this.localization.statusProjectText(resolution.candidate.name),
					this.localization.statusProjectTooltip(resolution.candidate.name, folderPath),
				);
				break;
			}
			case 'ambiguous':
				this.applyItemState(
					itemEl,
					this.localization.statusAmbiguousText,
					this.localization.statusAmbiguousTooltip(resolution.candidates.map((candidate) => candidate.name)),
				);
				break;
			case 'none':
			default:
				this.applyItemState(
					itemEl,
					this.localization.statusNoneText,
					this.localization.statusNoneTooltip,
				);
				break;
		}
	}

	private applyItemState(itemEl: HTMLElement, text: string, tooltip: string): void {
		itemEl.setText(text);
		itemEl.setAttribute('aria-label', tooltip);
		itemEl.setAttribute('title', tooltip);
	}

	private ensureItem(): HTMLElement {
		if (!this.itemEl) {
			this.itemEl = this.plugin.addStatusBarItem();
			this.itemEl.addClass('obpm-project-routing-status');
		}

		return this.itemEl;
	}
}
