import {WorkspaceLeaf} from 'obsidian';
import {getGroupKey} from './bases-group-fold-key-utils';
import {BasesTableGroup, BasesTableView} from './types';

const BASES_GROUP_HEADING_SELECTOR = '.bases-group-heading';
const BASES_GROUP_VALUE_SELECTOR = '.bases-group-value';
const BASES_TABLE_BODY_SELECTOR = '.bases-tbody';
const BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR = '.bases-table-group-summary-row';
const BASES_TABLE_SELECTOR = '.bases-table';

export class BasesGroupFoldTableAdapter {
	constructor(private readonly debugLog: (message: string, details?: unknown) => void) {}

	applyCollapsedState(leaf: WorkspaceLeaf, collapsedGroupKeys: ReadonlySet<string>): boolean {
		const table = this.resolveTableView(leaf);
		if (!table?.data) {
			return false;
		}

		this.wrapUpdateVirtualDisplay(table, collapsedGroupKeys);
		table.data.groupedDataCache = this.buildCollapsedGroups(table, collapsedGroupKeys);
		table.display?.();
		table.updateVirtualDisplay?.();
		this.syncDomState(leaf, table, collapsedGroupKeys);
		return true;
	}

	cleanup(leaf: WorkspaceLeaf): void {
		const table = this.resolveTableView(leaf);
		if (table?.data) {
			this.restoreWrappedUpdateVirtualDisplay(table);
			delete table.__obpmBasesGroupFoldGroupCountMap;
			delete table.__obpmBasesGroupFoldOriginalGroupedData;
			table.data.groupedDataCache = null;
			table.display?.();
			table.updateVirtualDisplay?.();
		}
	}

	private resolveTableView(leaf: WorkspaceLeaf): BasesTableView | null {
		const maybeTable = (leaf.view as {
			controller?: {
				view?: unknown;
			};
		}).controller?.view;
		if (!maybeTable || typeof maybeTable !== 'object') {
			return null;
		}

		const table = maybeTable as BasesTableView;
		if (!table.data || typeof table.display !== 'function' || typeof table.updateVirtualDisplay !== 'function') {
			return null;
		}

		return table;
	}

	private wrapUpdateVirtualDisplay(table: BasesTableView, collapsedGroupKeys: ReadonlySet<string>): void {
		const originalUpdate = table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay
			?? table.updateVirtualDisplay?.bind(table)
			?? null;
		if (!originalUpdate) {
			return;
		}

		table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay = originalUpdate;
		table.updateVirtualDisplay = (() => {
			if (table.data) {
				table.data.groupedDataCache = this.buildCollapsedGroups(table, collapsedGroupKeys);
			}

			return table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay?.();
		}) as () => void;
	}

	private restoreWrappedUpdateVirtualDisplay(table: BasesTableView): void {
		const originalUpdate = table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay;
		if (!originalUpdate) {
			return;
		}

		table.updateVirtualDisplay = originalUpdate;
		delete table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay;
	}

	private buildCollapsedGroups(table: BasesTableView, collapsedGroupKeys: ReadonlySet<string>): BasesTableGroup[] {
		return this.getSourceGroups(table, collapsedGroupKeys).map((group) => {
			const clonedGroup: BasesTableGroup = {
				...group,
				entries: group.entries.slice(),
			};
			const groupValueKey = getGroupKey(group.key?.toString?.() ?? '');
			if (collapsedGroupKeys.has(groupValueKey)) {
				clonedGroup.entries = [];
			}

			return clonedGroup;
		});
	}

	private getSourceGroups(table: BasesTableView, collapsedGroupKeys: ReadonlySet<string>): BasesTableGroup[] {
		if (!table.data) {
			return [];
		}

		const sourceGroups = (table.data.groupedData ?? []).map((group) => ({
			...group,
			entries: group.entries.slice(),
		}));
		const cachedGroups = table.__obpmBasesGroupFoldOriginalGroupedData;
		if (cachedGroups && this.shouldReuseCachedGroups(sourceGroups, cachedGroups, collapsedGroupKeys)) {
			return cachedGroups.map((group) => ({
				...group,
				entries: group.entries.slice(),
			}));
		}

		table.__obpmBasesGroupFoldOriginalGroupedData = sourceGroups.map((group) => ({
			...group,
			entries: group.entries.slice(),
		}));
		table.__obpmBasesGroupFoldGroupCountMap = Object.fromEntries(
			sourceGroups.map((group) => [getGroupKey(group.key?.toString?.() ?? ''), group.entries.length]),
		);
		return sourceGroups;
	}

	private syncDomState(leaf: WorkspaceLeaf, table: BasesTableView, collapsedGroupKeys: ReadonlySet<string>): void {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return;
		}

		const tableEls = rootEl.querySelectorAll<HTMLElement>(BASES_TABLE_SELECTOR);
		for (const tableEl of Array.from(tableEls)) {
			const headingEl = findDirectChild(tableEl, BASES_GROUP_HEADING_SELECTOR)
				?? toHtmlElement(tableEl.querySelector(`:scope > ${BASES_GROUP_HEADING_SELECTOR}`));
			const bodyEl = findDirectChild(tableEl, BASES_TABLE_BODY_SELECTOR)
				?? toHtmlElement(tableEl.querySelector(`:scope > ${BASES_TABLE_BODY_SELECTOR}`));
			const summaryEl = findDirectChild(tableEl, BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR)
				?? toHtmlElement(tableEl.querySelector(`:scope > ${BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR}`));
			const groupValue = toHtmlElement(headingEl?.querySelector(BASES_GROUP_VALUE_SELECTOR))?.textContent?.trim()
				?? headingEl?.textContent?.trim()
				?? '';
			const groupValueKey = getGroupKey(groupValue);
			const collapsed = collapsedGroupKeys.has(groupValueKey);

			tableEl.dataset.obpmBasesGroupFoldCollapsed = collapsed ? 'true' : 'false';
			if (bodyEl) {
				bodyEl.setCssProps({
					height: collapsed
						? '0px'
						: `${this.getGroupRowHeight(bodyEl) * this.getGroupEntryCount(table, groupValueKey)}px`,
				});
				bodyEl.setAttribute('aria-hidden', String(collapsed));
			}
			if (summaryEl) {
				summaryEl.hidden = collapsed;
				summaryEl.setAttribute('aria-hidden', String(collapsed));
			}
		}

		this.debugLog('Synchronized Bases grouped table DOM state.', {
			collapsedGroupCount: collapsedGroupKeys.size,
			tableCount: tableEls.length,
		});
	}

	private getGroupEntryCount(table: BasesTableView, groupValueKey: string): number {
		return table.__obpmBasesGroupFoldGroupCountMap?.[groupValueKey] ?? 0;
	}

	private getGroupRowHeight(bodyEl: HTMLElement): number {
		const parsedHeight = Number.parseFloat(getComputedStyle(bodyEl).getPropertyValue('--bases-table-row-height'));
		return Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 30;
	}

	private shouldReuseCachedGroups(
		sourceGroups: BasesTableGroup[],
		cachedGroups: BasesTableGroup[],
		collapsedGroupKeys: ReadonlySet<string>,
	): boolean {
		if (collapsedGroupKeys.size > 0) {
			return true;
		}

		if (sourceGroups.length !== cachedGroups.length) {
			return false;
		}

		return sourceGroups.some((group, index) => {
			const cachedGroup = cachedGroups[index];
			if (!cachedGroup) {
				return false;
			}

			return (group.entries.length ?? 0) < (cachedGroup.entries.length ?? 0)
				&& getGroupKey(group.key?.toString?.() ?? '') === getGroupKey(cachedGroup.key?.toString?.() ?? '');
		});
	}
}

function findDirectChild(containerEl: HTMLElement, selector: string): HTMLElement | null {
	for (const childNode of Array.from(containerEl.children)) {
		if (childNode instanceof HTMLElement && childNode.matches(selector)) {
			return childNode;
		}
	}

	return null;
}

function toHtmlElement(element: Element | null | undefined): HTMLElement | null {
	return element instanceof HTMLElement ? element : null;
}
