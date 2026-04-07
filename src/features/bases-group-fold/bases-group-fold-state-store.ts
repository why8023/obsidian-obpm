import {BasesGroupFoldFileState, BasesGroupFoldViewState} from '../../settings';
import {BasesGroupFoldPluginContext} from './types';

export class BasesGroupFoldStateStore {
	constructor(private readonly plugin: BasesGroupFoldPluginContext) {}

	async clearFileState(filePath: string): Promise<void> {
		if (!(filePath in this.plugin.settings.basesGroupFold.filesState)) {
			return;
		}

		delete this.plugin.settings.basesGroupFold.filesState[filePath];
		await this.plugin.saveSettings({refreshFeatures: false});
	}

	getCollapsedGroupKeys(filePath: string, viewStateKey: string): string[] {
		return [...this.getViewState(filePath, viewStateKey).collapsedGroupKeys];
	}

	isGroupCollapsed(filePath: string, viewStateKey: string, groupKey: string): boolean {
		return this.getViewState(filePath, viewStateKey).collapsedGroupKeys.includes(groupKey);
	}

	async moveFileState(oldPath: string, newPath: string): Promise<void> {
		if (oldPath === newPath) {
			return;
		}

		const oldState = this.plugin.settings.basesGroupFold.filesState[oldPath];
		if (!oldState) {
			return;
		}

		const normalizedOldState = normalizeFileState(oldState);
		if (isFileStateEmpty(normalizedOldState)) {
			delete this.plugin.settings.basesGroupFold.filesState[oldPath];
			await this.plugin.saveSettings({refreshFeatures: false});
			return;
		}

		this.plugin.settings.basesGroupFold.filesState[newPath] = normalizedOldState;
		delete this.plugin.settings.basesGroupFold.filesState[oldPath];
		await this.plugin.saveSettings({refreshFeatures: false});
	}

	async pruneViewState(filePath: string, viewStateKey: string, validGroupKeys: Iterable<string>): Promise<void> {
		const currentViewState = this.getViewState(filePath, viewStateKey);
		if (currentViewState.collapsedGroupKeys.length === 0) {
			return;
		}

		const validKeySet = new Set(validGroupKeys);
		const nextCollapsedGroupKeys = currentViewState.collapsedGroupKeys.filter((groupKey) => validKeySet.has(groupKey));
		if (nextCollapsedGroupKeys.length === currentViewState.collapsedGroupKeys.length) {
			return;
		}

		await this.updateViewState(filePath, viewStateKey, {
			collapsedGroupKeys: nextCollapsedGroupKeys,
		});
	}

	async setGroupCollapsed(filePath: string, viewStateKey: string, groupKey: string, collapsed: boolean): Promise<void> {
		const currentViewState = this.getViewState(filePath, viewStateKey);
		const isCollapsed = currentViewState.collapsedGroupKeys.includes(groupKey);
		if (isCollapsed === collapsed) {
			return;
		}

		const nextCollapsedGroupKeys = collapsed
			? [...currentViewState.collapsedGroupKeys, groupKey]
			: currentViewState.collapsedGroupKeys.filter((entry) => entry !== groupKey);

		await this.updateViewState(filePath, viewStateKey, {
			collapsedGroupKeys: nextCollapsedGroupKeys,
		});
	}

	private getFileState(filePath: string): BasesGroupFoldFileState {
		return normalizeFileState(this.plugin.settings.basesGroupFold.filesState[filePath]);
	}

	private getViewState(filePath: string, viewStateKey: string): BasesGroupFoldViewState {
		const fileState = this.getFileState(filePath);
		return normalizeViewState(fileState.viewsState[viewStateKey]);
	}

	private async updateFileState(filePath: string, fileState: BasesGroupFoldFileState): Promise<void> {
		const normalizedFileState = normalizeFileState(fileState);
		const currentState = this.plugin.settings.basesGroupFold.filesState[filePath];
		const normalizedCurrentState = currentState ? normalizeFileState(currentState) : null;

		if (normalizedCurrentState && areFileStatesEqual(normalizedCurrentState, normalizedFileState)) {
			return;
		}

		if (isFileStateEmpty(normalizedFileState)) {
			if (!currentState) {
				return;
			}

			delete this.plugin.settings.basesGroupFold.filesState[filePath];
		} else {
			this.plugin.settings.basesGroupFold.filesState[filePath] = normalizedFileState;
		}

		await this.plugin.saveSettings({refreshFeatures: false});
	}

	private async updateViewState(filePath: string, viewStateKey: string, viewState: BasesGroupFoldViewState): Promise<void> {
		const fileState = this.getFileState(filePath);
		const normalizedViewState = normalizeViewState(viewState);
		const nextViewsState = {...fileState.viewsState};

		if (isViewStateEmpty(normalizedViewState)) {
			delete nextViewsState[viewStateKey];
		} else {
			nextViewsState[viewStateKey] = normalizedViewState;
		}

		await this.updateFileState(filePath, {viewsState: nextViewsState});
	}
}

function areFileStatesEqual(left: BasesGroupFoldFileState, right: BasesGroupFoldFileState): boolean {
	const leftEntries = Object.entries(left.viewsState);
	const rightEntries = Object.entries(right.viewsState);
	if (leftEntries.length !== rightEntries.length) {
		return false;
	}

	return leftEntries.every(([viewStateKey, viewState]) => {
		const rightViewState = right.viewsState[viewStateKey];
		return rightViewState ? areViewStatesEqual(viewState, rightViewState) : false;
	});
}

function areViewStatesEqual(left: BasesGroupFoldViewState, right: BasesGroupFoldViewState): boolean {
	if (left.collapsedGroupKeys.length !== right.collapsedGroupKeys.length) {
		return false;
	}

	return left.collapsedGroupKeys.every((entry, index) => entry === right.collapsedGroupKeys[index]);
}

function isFileStateEmpty(fileState: BasesGroupFoldFileState): boolean {
	return Object.keys(fileState.viewsState).length === 0;
}

function isViewStateEmpty(viewState: BasesGroupFoldViewState): boolean {
	return viewState.collapsedGroupKeys.length === 0;
}

function normalizeFileState(fileState: BasesGroupFoldFileState | null | undefined): BasesGroupFoldFileState {
	const viewsState = fileState?.viewsState && typeof fileState.viewsState === 'object'
		? Object.fromEntries(Object.entries(fileState.viewsState)
			.map(([viewStateKey, viewState]) => {
				const normalizedViewStateKey = typeof viewStateKey === 'string' ? viewStateKey.trim() : '';
				const normalizedViewState = normalizeViewState(viewState);
				if (!normalizedViewStateKey || isViewStateEmpty(normalizedViewState)) {
					return null;
				}

				return [normalizedViewStateKey, normalizedViewState] as const;
			})
			.filter((entry): entry is readonly [string, BasesGroupFoldViewState] => entry !== null))
		: {};

	return {viewsState};
}

function normalizeViewState(viewState: BasesGroupFoldViewState | null | undefined): BasesGroupFoldViewState {
	const collapsedGroupKeys = Array.isArray(viewState?.collapsedGroupKeys)
		? [...new Set(viewState.collapsedGroupKeys
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0))]
		: [];

	return {collapsedGroupKeys};
}
