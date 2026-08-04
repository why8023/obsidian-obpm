import {WorkspaceLeaf} from 'obsidian';
import {getGroupKey, matchesGroupKey} from './bases-group-fold-key-utils';
import {BasesTableGroup, BasesTableView} from './types';

const BASES_EMBED_SELECTOR = '.bases-embed';
const BASES_GROUP_HEADING_SELECTOR = '.bases-group-heading';
const BASES_GROUP_VALUE_SELECTOR = '.bases-group-value';
const BASES_LIST_GROUP_LIST_SELECTOR = '.bases-list-group-list';
const BASES_LIST_GROUP_SELECTOR = '.bases-list-group';
const BASES_TABLE_BODY_SELECTOR = '.bases-tbody';
const BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR = '.bases-table-group-summary-row';
const BASES_TABLE_SELECTOR = '.bases-table';
const BASES_VIEW_SELECTOR = '.bases-view';

export class BasesGroupFoldTableAdapter {
	private readonly managedTables = new Map<WorkspaceLeaf, BasesTableView>();

	constructor(private readonly debugLog: (message: string, details?: unknown) => void) {}

	applyCollapsedState(leaf: WorkspaceLeaf, collapsedGroupKeys: ReadonlySet<string>): boolean {
		const table = this.resolveTableView(leaf);
		if (!table?.data) {
			return false;
		}

		const previousTable = this.managedTables.get(leaf);
		if (previousTable && previousTable !== table) {
			this.restoreTable(previousTable);
		}
		this.managedTables.set(leaf, table);
		table.__obpmBasesGroupFoldGroupKeyAliases = this.getGroupKeyAliases(leaf, table);
		const previousCollapsedGroupKeys = table.__obpmBasesGroupFoldCollapsedGroupKeys;
		const sourceDataChanged = this.hasSourceDataChanged(table);
		const previousSourceGroups = table.__obpmBasesGroupFoldOriginalGroupedData;
		const sourceGroups = this.getSourceGroups(table, collapsedGroupKeys);
		const sourceShapeChanged = previousSourceGroups !== table.__obpmBasesGroupFoldOriginalGroupedData
			&& previousCollapsedGroupKeys !== undefined
			&& !sameGroupShape(
				table.data.groupedData ?? [],
				previousSourceGroups,
				previousCollapsedGroupKeys,
				table,
			);
		const canUpdateInPlace = previousTable === table
			&& previousCollapsedGroupKeys !== undefined
			&& !sourceDataChanged
			&& !sourceShapeChanged
			&& typeof table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay === 'function';
		if (canUpdateInPlace) {
			// Keep the native group DOM and only refresh virtual rows during a toggle.
			this.clearExpandedDomLayout(leaf, table, previousCollapsedGroupKeys, collapsedGroupKeys);
			table.__obpmBasesGroupFoldCollapsedGroupKeys = new Set(collapsedGroupKeys);
			table.data.groupedDataCache = this.buildCollapsedGroups(table, collapsedGroupKeys);
			table.updateVirtualDisplay?.();
			this.syncDomState(leaf, table, collapsedGroupKeys);
			return true;
		}

		this.restoreWrappedUpdateVirtualDisplay(table);
		this.clearCollapsedDomLayout(leaf);
		table.data.groupedDataCache = cloneGroups(sourceGroups);
		table.display?.();
		this.wrapUpdateVirtualDisplay(table, collapsedGroupKeys);
		table.data.groupedDataCache = this.buildCollapsedGroups(table, collapsedGroupKeys);
		table.display?.();
		table.updateVirtualDisplay?.();
		this.syncDomState(leaf, table, collapsedGroupKeys);
		return true;
	}

	cleanup(leaf: WorkspaceLeaf): void {
		const tables = new Set<BasesTableView>();
		const managedTable = this.managedTables.get(leaf);
		if (managedTable) {
			tables.add(managedTable);
		}

		const currentTable = this.resolveTableView(leaf);
		if (currentTable) {
			tables.add(currentTable);
		}

		for (const table of tables) {
			this.restoreTable(table);
		}
		this.managedTables.delete(leaf);
	}

	private restoreTable(table: BasesTableView): void {
		this.restoreWrappedUpdateVirtualDisplay(table);
		if (table.data) {
			const originalGroups = table.__obpmBasesGroupFoldOriginalGroupedData;
			table.data.groupedDataCache = originalGroups ? cloneGroups(originalGroups) : null;
			table.display?.();
			table.data.groupedDataCache = null;
			table.updateVirtualDisplay?.();
		}

		delete table.__obpmBasesGroupFoldGroupCountMap;
		delete table.__obpmBasesGroupFoldOriginalSourceData;
		delete table.__obpmBasesGroupFoldOriginalSourceDataLength;
		delete table.__obpmBasesGroupFoldOriginalGroupedData;
		delete table.__obpmBasesGroupFoldGroupKeyAliases;
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
		table.__obpmBasesGroupFoldCollapsedGroupKeys = new Set(collapsedGroupKeys);
		const originalUpdate = table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay
			?? table.updateVirtualDisplay?.bind(table)
			?? null;
		if (!originalUpdate) {
			return;
		}

		table.__obpmBasesGroupFoldOriginalUpdateVirtualDisplay = originalUpdate;
		table.updateVirtualDisplay = (() => {
			if (table.data) {
				table.data.groupedDataCache = this.buildCollapsedGroups(
					table,
					table.__obpmBasesGroupFoldCollapsedGroupKeys ?? new Set(),
				);
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
		delete table.__obpmBasesGroupFoldCollapsedGroupKeys;
	}

	private buildCollapsedGroups(table: BasesTableView, collapsedGroupKeys: ReadonlySet<string>): BasesTableGroup[] {
		return this.getSourceGroups(table, collapsedGroupKeys).map((group) => {
			const clonedGroup: BasesTableGroup = {
				...group,
				entries: group.entries.slice(),
			};
			const groupValueKey = getGroupKey(group.key?.toString?.() ?? '');
			if (isCollapsedGroupForTable(collapsedGroupKeys, table, groupValueKey)) {
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
		const sourceDataChanged = cachedGroups !== undefined
			&& (table.__obpmBasesGroupFoldOriginalSourceData !== table.data.data
				|| table.__obpmBasesGroupFoldOriginalSourceDataLength !== table.data.data?.length);
		const nextSourceGroups = cachedGroups
			? mergeSourceGroups(sourceGroups, cachedGroups, collapsedGroupKeys, sourceDataChanged, table)
			: sourceGroups;
		const shouldRefreshSource = !cachedGroups
			|| sourceDataChanged
			|| !sameGroupShape(sourceGroups, cachedGroups, collapsedGroupKeys, table);
		if (shouldRefreshSource) {
			table.__obpmBasesGroupFoldOriginalGroupedData = nextSourceGroups.map((group) => ({
				...group,
				entries: group.entries.slice(),
			}));
			table.__obpmBasesGroupFoldOriginalSourceData = table.data.data;
			table.__obpmBasesGroupFoldOriginalSourceDataLength = table.data.data?.length;
		}

		const stableSourceGroups = table.__obpmBasesGroupFoldOriginalGroupedData ?? nextSourceGroups;
		table.__obpmBasesGroupFoldGroupCountMap = Object.fromEntries(
		stableSourceGroups.flatMap((group) => {
			const groupKey = getGroupKey(group.key?.toString?.() ?? '');
			const displayKey = table.__obpmBasesGroupFoldGroupKeyAliases?.get(groupKey);
			return displayKey && displayKey !== groupKey
				? [[groupKey, group.entries.length], [displayKey, group.entries.length]]
				: [[groupKey, group.entries.length]];
		}),
		);
		return stableSourceGroups.map((group) => ({
			...group,
			entries: group.entries.slice(),
		}));
	}

	private hasSourceDataChanged(table: BasesTableView): boolean {
		return table.__obpmBasesGroupFoldOriginalGroupedData !== undefined
			&& (table.__obpmBasesGroupFoldOriginalSourceData !== table.data?.data
				|| table.__obpmBasesGroupFoldOriginalSourceDataLength !== table.data?.data?.length);
	}

	private syncDomState(leaf: WorkspaceLeaf, table: BasesTableView, collapsedGroupKeys: ReadonlySet<string>): void {
		const rootEl = this.resolveBasesViewRoot(leaf);
		if (!rootEl) {
			return;
		}

		let listGroupCount = 0;
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
			const collapsed = isCollapsedGroup(collapsedGroupKeys, groupValueKey);

			tableEl.dataset.obpmBasesGroupFoldCollapsed = collapsed ? 'true' : 'false';
			tableEl.classList.toggle('is-obpm-collapsed', collapsed);
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

		const listGroupEls = rootEl.querySelectorAll<HTMLElement>(BASES_LIST_GROUP_SELECTOR);
		for (const groupEl of Array.from(listGroupEls)) {
			const headingEl = findDirectChild(groupEl, BASES_GROUP_HEADING_SELECTOR)
				?? toHtmlElement(groupEl.querySelector(`:scope > ${BASES_GROUP_HEADING_SELECTOR}`));
			const bodyEl = findDirectChild(groupEl, BASES_LIST_GROUP_LIST_SELECTOR)
				?? toHtmlElement(groupEl.querySelector(`:scope > ${BASES_LIST_GROUP_LIST_SELECTOR}`));
			if (!headingEl) {
				continue;
			}

			listGroupCount += 1;
			const groupValue = toHtmlElement(headingEl.querySelector(BASES_GROUP_VALUE_SELECTOR))?.textContent?.trim()
				?? headingEl.textContent?.trim()
				?? '';
			const groupValueKey = getGroupKey(groupValue);
			const collapsed = isCollapsedGroup(collapsedGroupKeys, groupValueKey);

			groupEl.dataset.obpmBasesGroupFoldCollapsed = collapsed ? 'true' : 'false';
			groupEl.classList.toggle('is-obpm-collapsed', collapsed);
			if (bodyEl) {
				bodyEl.setCssProps({
					height: collapsed ? '0px' : '',
				});
				bodyEl.setAttribute('aria-hidden', String(collapsed));
			}
		}

		this.debugLog('Synchronized Bases grouped view DOM state.', {
			collapsedGroupCount: collapsedGroupKeys.size,
			listGroupCount,
			tableCount: tableEls.length,
		});
	}

	private clearCollapsedDomLayout(leaf: WorkspaceLeaf): void {
		const rootEl = this.resolveBasesViewRoot(leaf);
		if (!rootEl) {
			return;
		}

		for (const tableEl of Array.from(rootEl.querySelectorAll<HTMLElement>(BASES_TABLE_SELECTOR))) {
			const bodyEl = findDirectChild(tableEl, BASES_TABLE_BODY_SELECTOR)
				?? toHtmlElement(tableEl.querySelector(`:scope > ${BASES_TABLE_BODY_SELECTOR}`));
			const summaryEl = findDirectChild(tableEl, BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR)
				?? toHtmlElement(tableEl.querySelector(`:scope > ${BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR}`));
			if (bodyEl) {
				bodyEl.setCssProps({height: ''});
				bodyEl.removeAttribute('aria-hidden');
			}
			if (summaryEl) {
				summaryEl.hidden = false;
				summaryEl.removeAttribute('aria-hidden');
			}
			tableEl.classList.remove('is-obpm-collapsed');
			delete tableEl.dataset.obpmBasesGroupFoldCollapsed;
		}
	}

	private clearExpandedDomLayout(
		leaf: WorkspaceLeaf,
		table: BasesTableView,
		previousCollapsedGroupKeys: ReadonlySet<string>,
		nextCollapsedGroupKeys: ReadonlySet<string>,
	): void {
		const rootEl = this.resolveBasesViewRoot(leaf);
		if (!rootEl) {
			return;
		}

		for (const tableEl of Array.from(rootEl.querySelectorAll<HTMLElement>(BASES_TABLE_SELECTOR))) {
			const groupValueKey = getDomGroupValueKey(tableEl);
			if (!isGroupExpanding(previousCollapsedGroupKeys, nextCollapsedGroupKeys, table, groupValueKey)) {
				continue;
			}

			const bodyEl = findDirectChild(tableEl, BASES_TABLE_BODY_SELECTOR)
				?? toHtmlElement(tableEl.querySelector(`:scope > ${BASES_TABLE_BODY_SELECTOR}`));
			const summaryEl = findDirectChild(tableEl, BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR)
				?? toHtmlElement(tableEl.querySelector(`:scope > ${BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR}`));
			if (bodyEl) {
				bodyEl.setCssProps({height: ''});
				bodyEl.removeAttribute('aria-hidden');
			}
			if (summaryEl) {
				summaryEl.hidden = false;
				summaryEl.removeAttribute('aria-hidden');
			}
			tableEl.classList.remove('is-obpm-collapsed');
			delete tableEl.dataset.obpmBasesGroupFoldCollapsed;
		}

		for (const groupEl of Array.from(rootEl.querySelectorAll<HTMLElement>(BASES_LIST_GROUP_SELECTOR))) {
			const groupValueKey = getDomGroupValueKey(groupEl);
			if (!isGroupExpanding(previousCollapsedGroupKeys, nextCollapsedGroupKeys, table, groupValueKey)) {
				continue;
			}

			const bodyEl = findDirectChild(groupEl, BASES_LIST_GROUP_LIST_SELECTOR)
				?? toHtmlElement(groupEl.querySelector(`:scope > ${BASES_LIST_GROUP_LIST_SELECTOR}`));
			if (bodyEl) {
				bodyEl.setCssProps({height: ''});
				bodyEl.removeAttribute('aria-hidden');
			}
			groupEl.classList.remove('is-obpm-collapsed');
			delete groupEl.dataset.obpmBasesGroupFoldCollapsed;
		}
	}

	private getGroupEntryCount(table: BasesTableView, groupValueKey: string): number {
		return table.__obpmBasesGroupFoldGroupCountMap?.[groupValueKey] ?? 0;
	}

	private getGroupRowHeight(bodyEl: HTMLElement): number {
		const parsedHeight = Number.parseFloat(getComputedStyle(bodyEl).getPropertyValue('--bases-table-row-height'));
		return Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 30;
	}

	private resolveBasesViewRoot(leaf: WorkspaceLeaf): HTMLElement | null {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return null;
		}

		for (const viewEl of Array.from(rootEl.querySelectorAll(BASES_VIEW_SELECTOR))) {
			if (!(viewEl instanceof HTMLElement) || viewEl.closest(BASES_EMBED_SELECTOR)) {
				continue;
			}

			if (viewEl.querySelector(BASES_TABLE_SELECTOR) || viewEl.querySelector(BASES_LIST_GROUP_SELECTOR)) {
				return viewEl;
			}
		}

		return null;
	}

	private getGroupKeyAliases(leaf: WorkspaceLeaf, table: BasesTableView): Map<string, string> {
		const aliases = new Map<string, string>();
		const rootEl = this.resolveBasesViewRoot(leaf);
		const groups = table.data?.groupedData ?? [];
		const tableEls = rootEl?.querySelectorAll<HTMLElement>(BASES_TABLE_SELECTOR) ?? [];
		for (let index = 0; index < groups.length; index += 1) {
			const group = groups[index];
			const tableEl = tableEls[index];
			if (!group || !tableEl) {
				continue;
			}

			const groupKey = getGroupKey(group.key?.toString?.() ?? '');
			const displayKey = getGroupKey(
				toHtmlElement(tableEl.querySelector(BASES_GROUP_VALUE_SELECTOR))?.textContent
					?? tableEl.querySelector(BASES_GROUP_HEADING_SELECTOR)?.textContent
					?? '',
			);
			if (displayKey !== groupKey) {
				aliases.set(groupKey, displayKey);
			}
		}

		return aliases;
	}
}

function isCollapsedGroup(collapsedGroupKeys: ReadonlySet<string>, groupKey: string): boolean {
	return [...collapsedGroupKeys].some((storedKey) => matchesGroupKey(storedKey, groupKey));
}

function mergeSourceGroups(
	sourceGroups: BasesTableGroup[],
	cachedGroups: BasesTableGroup[],
	collapsedGroupKeys: ReadonlySet<string>,
	sourceDataChanged: boolean,
	table: BasesTableView,
): BasesTableGroup[] {
	return sourceGroups.map((group) => {
		const groupKey = getGroupKey(group.key?.toString?.() ?? '');
		const cachedGroup = cachedGroups.find((candidate) =>
			getGroupKey(candidate.key?.toString?.() ?? '') === groupKey,
		);
		if (!cachedGroup
			|| group.entries.length > 0
			|| (sourceDataChanged && !isCollapsedGroupForTable(collapsedGroupKeys, table, groupKey))) {
			return {...group, entries: group.entries.slice()};
		}

		return {...cachedGroup, entries: cachedGroup.entries.slice()};
	});
}

function sameGroupShape(
	sourceGroups: BasesTableGroup[],
	cachedGroups: BasesTableGroup[] | undefined,
	collapsedGroupKeys: ReadonlySet<string>,
	table: BasesTableView,
): boolean {
	if (!cachedGroups || sourceGroups.length !== cachedGroups.length) {
		return false;
	}

	return sourceGroups.every((group, index) => {
		const cachedGroup = cachedGroups[index];
		if (!cachedGroup) {
			return false;
		}

		const groupKey = getGroupKey(group.key?.toString?.() ?? '');
		if (groupKey !== getGroupKey(cachedGroup.key?.toString?.() ?? '')) {
			return false;
		}

		return isCollapsedGroupForTable(collapsedGroupKeys, table, groupKey)
			|| group.entries.length === cachedGroup.entries.length;
	});
}

function isCollapsedGroupForTable(
	collapsedGroupKeys: ReadonlySet<string>,
	table: BasesTableView,
	groupKey: string,
): boolean {
	const displayKey = table.__obpmBasesGroupFoldGroupKeyAliases?.get(groupKey);
	return isCollapsedGroup(collapsedGroupKeys, groupKey)
		|| (displayKey !== undefined && isCollapsedGroup(collapsedGroupKeys, displayKey));
}

function isGroupExpanding(
	previousCollapsedGroupKeys: ReadonlySet<string>,
	nextCollapsedGroupKeys: ReadonlySet<string>,
	table: BasesTableView,
	groupKey: string,
): boolean {
	return isCollapsedGroupForTable(previousCollapsedGroupKeys, table, groupKey)
		&& !isCollapsedGroupForTable(nextCollapsedGroupKeys, table, groupKey);
}

function getDomGroupValueKey(containerEl: HTMLElement): string {
	return getGroupKey(
		toHtmlElement(containerEl.querySelector(BASES_GROUP_VALUE_SELECTOR))?.textContent
			?? containerEl.querySelector(BASES_GROUP_HEADING_SELECTOR)?.textContent
			?? '',
	);
}

function cloneGroups(groups: BasesTableGroup[]): BasesTableGroup[] {
	return groups.map((group) => ({
		...group,
		entries: group.entries.slice(),
	}));
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
