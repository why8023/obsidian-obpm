import {BasesTopTabsFileState} from '../../settings';
import {BasesTopTabsPluginContext} from './types';

export class BasesTopTabsStateStore {
	constructor(private readonly plugin: BasesTopTabsPluginContext) {}

	async clearFileState(filePath: string): Promise<void> {
		if (!(filePath in this.plugin.settings.basesTopTabs.filesState)) {
			return;
		}

		delete this.plugin.settings.basesTopTabs.filesState[filePath];
		await this.plugin.saveSettings({refreshFeatures: false});
	}

	getLastViewName(filePath: string, validViewNames?: Iterable<string>): string | null {
		const fileState = this.getFileState(filePath);
		if (!fileState.lastViewName) {
			return null;
		}

		if (!validViewNames) {
			return fileState.lastViewName;
		}

		const validNames = new Set(validViewNames);
		return validNames.has(fileState.lastViewName) ? fileState.lastViewName : null;
	}

	getPinnedViewNames(filePath: string, validViewNames?: Iterable<string>): string[] {
		const fileState = this.getFileState(filePath);
		if (!validViewNames) {
			return [...fileState.pinnedViewNames];
		}

		const validNames = new Set(validViewNames);
		return fileState.pinnedViewNames.filter((viewName) => validNames.has(viewName));
	}

	hasPinnedView(filePath: string, viewName: string): boolean {
		return this.getFileState(filePath).pinnedViewNames.includes(viewName);
	}

	async moveFileState(oldPath: string, newPath: string): Promise<void> {
		if (oldPath === newPath) {
			return;
		}

		const oldState = this.plugin.settings.basesTopTabs.filesState[oldPath];
		if (!oldState) {
			return;
		}

		const normalizedOldState = normalizeFileState(oldState);
		if (isFileStateEmpty(normalizedOldState)) {
			delete this.plugin.settings.basesTopTabs.filesState[oldPath];
			await this.plugin.saveSettings({refreshFeatures: false});
			return;
		}

		this.plugin.settings.basesTopTabs.filesState[newPath] = normalizedOldState;
		delete this.plugin.settings.basesTopTabs.filesState[oldPath];
		await this.plugin.saveSettings({refreshFeatures: false});
	}

	async removeViewReference(filePath: string, viewName: string): Promise<void> {
		const fileState = normalizeFileState(this.getFileState(filePath));
		const nextPinnedViewNames = fileState.pinnedViewNames.filter((entry) => entry !== viewName);
		const nextLastViewName = fileState.lastViewName === viewName ? null : fileState.lastViewName;
		await this.updateFileState(filePath, {
			lastViewName: nextLastViewName,
			pinnedViewNames: nextPinnedViewNames,
		});
	}

	async renameViewReference(filePath: string, oldName: string, nextName: string): Promise<void> {
		const fileState = normalizeFileState(this.getFileState(filePath));
		const renamedPinnedViewNames = fileState.pinnedViewNames.map((entry) => entry === oldName ? nextName : entry);
		const dedupedPinnedViewNames = [...new Set(renamedPinnedViewNames)];
		const nextLastViewName = fileState.lastViewName === oldName ? nextName : fileState.lastViewName;
		await this.updateFileState(filePath, {
			lastViewName: nextLastViewName,
			pinnedViewNames: dedupedPinnedViewNames,
		});
	}

	async setLastViewName(filePath: string, viewName: string | null): Promise<void> {
		const fileState = normalizeFileState(this.getFileState(filePath));
		if (fileState.lastViewName === viewName) {
			return;
		}

		await this.updateFileState(filePath, {
			lastViewName: viewName,
			pinnedViewNames: fileState.pinnedViewNames,
		});
	}

	async setPinned(filePath: string, viewName: string, pinned: boolean): Promise<void> {
		const fileState = normalizeFileState(this.getFileState(filePath));
		const alreadyPinned = fileState.pinnedViewNames.includes(viewName);
		if (alreadyPinned === pinned) {
			return;
		}

		const nextPinnedViewNames = pinned
			? [...fileState.pinnedViewNames, viewName]
			: fileState.pinnedViewNames.filter((entry) => entry !== viewName);

		await this.updateFileState(filePath, {
			lastViewName: fileState.lastViewName,
			pinnedViewNames: nextPinnedViewNames,
		});
	}

	private getFileState(filePath: string): BasesTopTabsFileState {
		return normalizeFileState(this.plugin.settings.basesTopTabs.filesState[filePath]);
	}

	private async updateFileState(filePath: string, fileState: BasesTopTabsFileState): Promise<void> {
		const normalizedFileState = normalizeFileState(fileState);
		const currentState = this.plugin.settings.basesTopTabs.filesState[filePath];
		const normalizedCurrentState = currentState ? normalizeFileState(currentState) : null;

		if (normalizedCurrentState && areFileStatesEqual(normalizedCurrentState, normalizedFileState)) {
			return;
		}

		if (isFileStateEmpty(normalizedFileState)) {
			if (!currentState) {
				return;
			}

			delete this.plugin.settings.basesTopTabs.filesState[filePath];
		} else {
			this.plugin.settings.basesTopTabs.filesState[filePath] = normalizedFileState;
		}

		await this.plugin.saveSettings({refreshFeatures: false});
	}
}

function areFileStatesEqual(left: BasesTopTabsFileState, right: BasesTopTabsFileState): boolean {
	if (left.lastViewName !== right.lastViewName) {
		return false;
	}

	if (left.pinnedViewNames.length !== right.pinnedViewNames.length) {
		return false;
	}

	return left.pinnedViewNames.every((entry, index) => entry === right.pinnedViewNames[index]);
}

function isFileStateEmpty(fileState: BasesTopTabsFileState): boolean {
	return fileState.lastViewName === null && fileState.pinnedViewNames.length === 0;
}

function normalizeFileState(fileState: BasesTopTabsFileState | null | undefined): BasesTopTabsFileState {
	const lastViewName = typeof fileState?.lastViewName === 'string' && fileState.lastViewName.trim().length > 0
		? fileState.lastViewName.trim()
		: null;
	const pinnedViewNames = Array.isArray(fileState?.pinnedViewNames)
		? [...new Set(fileState.pinnedViewNames
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0))]
		: [];

	return {
		lastViewName,
		pinnedViewNames,
	};
}
