import type {BasesTopTabsFileState, BasesTopTabsPlacement, BasesTopTabsSidebarWidths} from '../../settings';
import {normalizeSidebarWidth} from './bases-top-tabs-layout';
import {BasesTopTabsPluginContext, isObjectRecord} from './types';

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

	getSidebarWidth(filePath: string, placement: BasesTopTabsPlacement): number | null {
		const side = resolveSidebarKey(placement);
		return side ? this.getFileState(filePath).sidebarWidths[side] : null;
	}

	async setSidebarWidth(filePath: string, placement: BasesTopTabsPlacement, width: number): Promise<void> {
		const side = resolveSidebarKey(placement);
		const normalizedWidth = normalizeSidebarWidth(width, this.getSidebarMinWidth());
		if (!side || normalizedWidth === null) {
			return;
		}

		const fileState = normalizeFileState(this.getFileState(filePath), this.getSidebarMinWidth());
		if (fileState.sidebarWidths[side] === normalizedWidth) {
			return;
		}

		await this.updateFileState(filePath, {
			lastViewName: fileState.lastViewName,
			pinnedViewNames: fileState.pinnedViewNames,
			sidebarWidths: {
				...fileState.sidebarWidths,
				[side]: normalizedWidth,
			},
		});
	}

	async moveFileState(oldPath: string, newPath: string): Promise<void> {
		if (oldPath === newPath) {
			return;
		}

		const oldState = this.plugin.settings.basesTopTabs.filesState[oldPath];
		if (!oldState) {
			return;
		}

		const normalizedOldState = normalizeFileState(oldState, this.getSidebarMinWidth());
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
		const fileState = normalizeFileState(this.getFileState(filePath), this.getSidebarMinWidth());
		const nextPinnedViewNames = fileState.pinnedViewNames.filter((entry) => entry !== viewName);
		const nextLastViewName = fileState.lastViewName === viewName ? null : fileState.lastViewName;
		await this.updateFileState(filePath, {
			lastViewName: nextLastViewName,
			pinnedViewNames: nextPinnedViewNames,
			sidebarWidths: fileState.sidebarWidths,
		});
	}

	async renameViewReference(filePath: string, oldName: string, nextName: string): Promise<void> {
		const fileState = normalizeFileState(this.getFileState(filePath), this.getSidebarMinWidth());
		const renamedPinnedViewNames = fileState.pinnedViewNames.map((entry) => entry === oldName ? nextName : entry);
		const dedupedPinnedViewNames = [...new Set(renamedPinnedViewNames)];
		const nextLastViewName = fileState.lastViewName === oldName ? nextName : fileState.lastViewName;
		await this.updateFileState(filePath, {
			lastViewName: nextLastViewName,
			pinnedViewNames: dedupedPinnedViewNames,
			sidebarWidths: fileState.sidebarWidths,
		});
	}

	async setLastViewName(filePath: string, viewName: string | null): Promise<void> {
		const fileState = normalizeFileState(this.getFileState(filePath), this.getSidebarMinWidth());
		if (fileState.lastViewName === viewName) {
			return;
		}

		await this.updateFileState(filePath, {
			lastViewName: viewName,
			pinnedViewNames: fileState.pinnedViewNames,
			sidebarWidths: fileState.sidebarWidths,
		});
	}

	async setPinned(filePath: string, viewName: string, pinned: boolean): Promise<void> {
		const fileState = normalizeFileState(this.getFileState(filePath), this.getSidebarMinWidth());
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
			sidebarWidths: fileState.sidebarWidths,
		});
	}

	private getFileState(filePath: string): BasesTopTabsFileState {
		return normalizeFileState(this.plugin.settings.basesTopTabs.filesState[filePath], this.getSidebarMinWidth());
	}

	private async updateFileState(filePath: string, fileState: BasesTopTabsFileState): Promise<void> {
		const normalizedFileState = normalizeFileState(fileState, this.getSidebarMinWidth());
		const currentState = this.plugin.settings.basesTopTabs.filesState[filePath];
		const normalizedCurrentState = currentState
			? normalizeFileState(currentState, this.getSidebarMinWidth())
			: null;

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

	private getSidebarMinWidth(): number {
		return this.plugin.settings.basesTopTabs.sidebarMinWidth;
	}
}

function areFileStatesEqual(left: BasesTopTabsFileState, right: BasesTopTabsFileState): boolean {
	if (left.lastViewName !== right.lastViewName) {
		return false;
	}

	if (left.pinnedViewNames.length !== right.pinnedViewNames.length) {
		return false;
	}

	return left.pinnedViewNames.every((entry, index) => entry === right.pinnedViewNames[index])
		&& left.sidebarWidths.left === right.sidebarWidths.left
		&& left.sidebarWidths.right === right.sidebarWidths.right;
}

function isFileStateEmpty(fileState: BasesTopTabsFileState): boolean {
	return fileState.lastViewName === null
		&& fileState.pinnedViewNames.length === 0
		&& fileState.sidebarWidths.left === null
		&& fileState.sidebarWidths.right === null;
}

function normalizeFileState(
	fileState: BasesTopTabsFileState | null | undefined,
	minWidth: number,
): BasesTopTabsFileState {
	const lastViewName = typeof fileState?.lastViewName === 'string' && fileState.lastViewName.trim().length > 0
		? fileState.lastViewName.trim()
		: null;
	const pinnedViewNames = Array.isArray(fileState?.pinnedViewNames)
		? [...new Set(fileState.pinnedViewNames
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0))]
		: [];
	const sidebarWidths = normalizeSidebarWidths(fileState?.sidebarWidths, minWidth);

	return {
		lastViewName,
		pinnedViewNames,
		sidebarWidths,
	};
}

function normalizeSidebarWidths(value: unknown, minWidth: number): BasesTopTabsSidebarWidths {
	if (!isObjectRecord(value)) {
		return {left: null, right: null};
	}

	return {
		left: normalizeSidebarWidth(value.left, minWidth),
		right: normalizeSidebarWidth(value.right, minWidth),
	};
}

function resolveSidebarKey(placement: BasesTopTabsPlacement): 'left' | 'right' | null {
	if (placement === 'sidebar-left') {
		return 'left';
	}

	if (placement === 'sidebar-right') {
		return 'right';
	}

	return null;
}
