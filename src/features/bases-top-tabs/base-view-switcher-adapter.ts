import {App, TFile, WorkspaceLeaf} from 'obsidian';
import {isObjectRecord} from './types';

export interface ActiveBaseLeafState {
	currentViewName: string | null;
	file: TFile | null;
	filePath: string;
}

export class BaseViewSwitcherAdapter {
	constructor(private readonly app: App) {}

	getLeafState(leaf: WorkspaceLeaf): ActiveBaseLeafState | null {
		const viewState = leaf.getViewState();
		if (viewState.type !== 'bases' || !isObjectRecord(viewState.state)) {
			return null;
		}

		const filePath = typeof viewState.state.file === 'string' ? viewState.state.file : null;
		if (!filePath) {
			return null;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		return {
			currentViewName: typeof viewState.state.viewName === 'string' ? viewState.state.viewName : null,
			file: file instanceof TFile ? file : null,
			filePath,
		};
	}

	async switchToView(leaf: WorkspaceLeaf, viewName: string): Promise<boolean> {
		const viewState = leaf.getViewState();
		if (viewState.type !== 'bases') {
			return false;
		}

		const nextState = {
			...viewState,
			state: isObjectRecord(viewState.state)
				? {...viewState.state, viewName}
				: {viewName},
		};

		try {
			await leaf.setViewState(nextState);
			return true;
		} catch (error) {
			console.error('[OBPM:bases-top-tabs] Failed to switch Base view.', {
				error,
				viewName,
			});
			return false;
		}
	}
}
