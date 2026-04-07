import {setIcon, WorkspaceLeaf} from 'obsidian';
import {getGroupKey} from './bases-group-fold-key-utils';

const BASES_EMBED_SELECTOR = '.bases-embed';
const BASES_GROUP_HEADING_SELECTOR = '.bases-group-heading';
const BASES_GROUP_PROPERTY_SELECTOR = '.bases-group-property';
const BASES_GROUP_VALUE_SELECTOR = '.bases-group-value';
const BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR = '.bases-table-group-summary-row';
const BASES_TABLE_BODY_SELECTOR = '.bases-tbody';
const BASES_TABLE_CONTAINER_SELECTOR = '.bases-table-container';
const BASES_TABLE_SELECTOR = '.bases-table';
const BASES_TABLE_SIGNAL_SELECTOR = '.bases-table-container, .bases-table, .bases-tbody, .bases-tr, .bases-table-footer';
const BASES_VIEW_SELECTOR = '.bases-view';
const GROUP_CONTAINER_SELECTOR = '.group-container';
const GROUP_CONTENT_SELECTOR = '.group-content';
const GROUP_HEADER_SELECTOR = '.group-header';
const GROUP_HEADER_TEXT_SELECTOR = '.group-header-text';
const TOGGLE_BUTTON_SELECTOR = '.obpm-bases-group-fold-toggle';

export interface DetectedBaseGroup {
	bodyEl: HTMLElement;
	containerEl: HTMLElement;
	headerEl: HTMLElement;
	headingEl: HTMLElement | null;
	key: string;
	label: string;
	summaryEl: HTMLElement | null;
}

interface EnsureToggleButtonOptions {
	collapsed: boolean;
	label: string;
	onToggle: () => void;
}

export class BasesGroupFoldDomAdapter {
	private bodyIdSequence = 0;

	constructor(private readonly debugLog: (message: string, details?: unknown) => void) {}

	createObservers(leaf: WorkspaceLeaf, onChange: () => void): MutationObserver[] {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return [];
		}

		const observer = new MutationObserver((records) => {
			if (!records.some((record) => shouldHandleMutationRecord(record))) {
				return;
			}

			onChange();
		});

		observer.observe(rootEl, {
			childList: true,
			subtree: true,
		});
		return [observer];
	}

	detectGroups(leaf: WorkspaceLeaf): DetectedBaseGroup[] {
		const viewEl = this.resolveGroupedTableViewRoot(leaf);
		if (!viewEl) {
			return [];
		}

		const groups = this.detectNativeTableGroups(viewEl);
		if (groups.length > 0) {
			this.debugLog('Detected grouped Bases table groups.', {
				groupCount: groups.length,
				structure: 'native-bases-table',
			});
			return groups;
		}

		const legacyGroups = this.detectLegacyGroups(viewEl);
		this.debugLog('Detected grouped Bases table groups.', {
			groupCount: legacyGroups.length,
			structure: legacyGroups.length > 0 ? 'legacy-group-container' : 'none',
		});
		return legacyGroups;
	}

	private detectLegacyGroups(viewEl: HTMLElement): DetectedBaseGroup[] {
		const groups: DetectedBaseGroup[] = [];
		for (const containerEl of Array.from(viewEl.querySelectorAll(GROUP_CONTAINER_SELECTOR))) {
			if (!(containerEl instanceof HTMLElement)) {
				continue;
			}

			if (containerEl.parentElement?.closest(GROUP_CONTAINER_SELECTOR)) {
				continue;
			}

			const headerEl = findDirectChild(containerEl, GROUP_HEADER_SELECTOR)
				?? toHtmlElement(containerEl.querySelector(GROUP_HEADER_SELECTOR));
			const bodyEl = findDirectChild(containerEl, GROUP_CONTENT_SELECTOR)
				?? toHtmlElement(containerEl.querySelector(GROUP_CONTENT_SELECTOR));
			if (!headerEl || !bodyEl || !bodyEl.querySelector(BASES_TABLE_SIGNAL_SELECTOR)) {
				continue;
			}

			const headingEl = toHtmlElement(headerEl.querySelector(BASES_GROUP_HEADING_SELECTOR));
			if (!headingEl) {
				continue;
			}

			const summaryEl = findDirectChild(containerEl, BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR)
				?? toHtmlElement(containerEl.querySelector(`:scope > ${BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR}`));

			groups.push(this.buildDetectedGroup(containerEl, headerEl, bodyEl, headingEl, summaryEl));
		}

		return groups;
	}

	private detectNativeTableGroups(viewEl: HTMLElement): DetectedBaseGroup[] {
		const tableContainerEl = toHtmlElement(viewEl.querySelector('.bases-table-container'));
		if (!tableContainerEl) {
			return [];
		}

		const groups: DetectedBaseGroup[] = [];
		for (const tableEl of Array.from(tableContainerEl.children)) {
			if (!(tableEl instanceof HTMLElement) || !tableEl.matches(BASES_TABLE_SELECTOR)) {
				continue;
			}

			const headingEl = findDirectChild(tableEl, BASES_GROUP_HEADING_SELECTOR);
			const summaryEl = findDirectChild(tableEl, BASES_TABLE_GROUP_SUMMARY_ROW_SELECTOR);
			const bodyEl = findDirectChild(tableEl, BASES_TABLE_BODY_SELECTOR);
			if (!headingEl || !bodyEl) {
				continue;
			}

			groups.push(this.buildDetectedGroup(tableEl, headingEl, bodyEl, headingEl, summaryEl));
		}

		return groups;
	}

	private buildDetectedGroup(
		containerEl: HTMLElement,
		headerEl: HTMLElement,
		bodyEl: HTMLElement,
		headingEl: HTMLElement,
		summaryEl: HTMLElement | null,
	): DetectedBaseGroup {
		const metadata = extractGroupMetadata(headerEl, headingEl);
		return {
			bodyEl,
			containerEl,
			headerEl,
			headingEl,
			key: metadata.key,
			label: metadata.label,
			summaryEl,
		};
	}

	ensureToggleButton(group: DetectedBaseGroup, options: EnsureToggleButtonOptions): void {
		group.containerEl.dataset.obpmBasesGroupFoldContainer = 'true';
		group.headerEl.dataset.obpmBasesGroupFoldHeader = 'true';
		group.bodyEl.dataset.obpmBasesGroupFoldBody = 'true';
		group.headerEl.classList.add('obpm-bases-group-fold-header');
		group.bodyEl.classList.add('obpm-bases-group-fold-body');
		if (group.summaryEl) {
			group.summaryEl.dataset.obpmBasesGroupFoldSummary = 'true';
			group.summaryEl.classList.add('obpm-bases-group-fold-summary');
		}

		const buttonEl = this.getOrCreateToggleButton(group);
		const nextState = options.collapsed ? 'collapsed' : 'expanded';
		if (buttonEl.dataset.state !== nextState) {
			setIcon(buttonEl, options.collapsed ? 'chevron-right' : 'chevron-down');
			buttonEl.dataset.state = nextState;
		}

		const bodyId = this.ensureBodyId(group.bodyEl);
		buttonEl.setAttribute('aria-controls', bodyId);
		buttonEl.setAttribute('aria-expanded', String(!options.collapsed));
		if (buttonEl.getAttribute('aria-label') !== options.label) {
			buttonEl.setAttribute('aria-label', options.label);
		}
		if (buttonEl.title !== options.label) {
			buttonEl.title = options.label;
		}

		buttonEl.onpointerdown = stopToggleEvent;
		buttonEl.onmousedown = stopToggleEvent;
		buttonEl.onmouseup = stopToggleEvent;
		buttonEl.onclick = (event) => {
			stopToggleEvent(event);
			options.onToggle();
		};
	}

	applyCollapsed(group: DetectedBaseGroup, collapsed: boolean): void {
		group.containerEl.dataset.obpmBasesGroupFoldContainer = 'true';
		group.containerEl.dataset.obpmBasesGroupFoldCollapsed = collapsed ? 'true' : 'false';
		group.headerEl.dataset.obpmBasesGroupFoldHeader = 'true';
		group.bodyEl.dataset.obpmBasesGroupFoldBody = 'true';
		group.headerEl.classList.add('obpm-bases-group-fold-header');
		group.bodyEl.classList.add('obpm-bases-group-fold-body');
		if (group.summaryEl) {
			group.summaryEl.dataset.obpmBasesGroupFoldSummary = 'true';
			group.summaryEl.classList.add('obpm-bases-group-fold-summary');
			group.summaryEl.hidden = collapsed;
			group.summaryEl.setAttribute('aria-hidden', String(collapsed));
		}
		group.containerEl.classList.toggle('is-obpm-collapsed', collapsed);
		group.bodyEl.hidden = false;
		group.bodyEl.setAttribute('aria-hidden', String(collapsed));

		const buttonEl = group.headerEl.querySelector(TOGGLE_BUTTON_SELECTOR);
		if (buttonEl) {
			buttonEl.setAttribute('aria-expanded', String(!collapsed));
		}
	}

	cleanup(leaf: WorkspaceLeaf): void {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return;
		}

		for (const buttonEl of Array.from(rootEl.querySelectorAll(TOGGLE_BUTTON_SELECTOR))) {
			buttonEl.remove();
		}

		for (const containerEl of Array.from(rootEl.querySelectorAll('[data-obpm-bases-group-fold-container]'))) {
			if (!(containerEl instanceof HTMLElement)) {
				continue;
			}

			containerEl.classList.remove('is-obpm-collapsed');
			delete containerEl.dataset.obpmBasesGroupFoldCollapsed;
			delete containerEl.dataset.obpmBasesGroupFoldContainer;
		}

		for (const headerEl of Array.from(rootEl.querySelectorAll('[data-obpm-bases-group-fold-header]'))) {
			if (!(headerEl instanceof HTMLElement)) {
				continue;
			}

			headerEl.classList.remove('obpm-bases-group-fold-header');
			delete headerEl.dataset.obpmBasesGroupFoldHeader;
		}

		for (const bodyEl of Array.from(rootEl.querySelectorAll('[data-obpm-bases-group-fold-body]'))) {
			if (!(bodyEl instanceof HTMLElement)) {
				continue;
			}

			bodyEl.classList.remove('obpm-bases-group-fold-body');
			bodyEl.hidden = false;
			bodyEl.setCssProps({height: ''});
			bodyEl.removeAttribute('aria-hidden');
			delete bodyEl.dataset.obpmBasesGroupFoldBody;
		}

		for (const summaryEl of Array.from(rootEl.querySelectorAll('[data-obpm-bases-group-fold-summary]'))) {
			if (!(summaryEl instanceof HTMLElement)) {
				continue;
			}

			summaryEl.classList.remove('obpm-bases-group-fold-summary');
			summaryEl.hidden = false;
			summaryEl.removeAttribute('aria-hidden');
			delete summaryEl.dataset.obpmBasesGroupFoldSummary;
		}
	}

	private ensureBodyId(bodyEl: HTMLElement): string {
		if (!bodyEl.id) {
			this.bodyIdSequence += 1;
			bodyEl.id = `obpm-bases-group-fold-body-${this.bodyIdSequence}`;
		}

		return bodyEl.id;
	}

	private getOrCreateToggleButton(group: DetectedBaseGroup): HTMLButtonElement {
		const existingButtonEl = group.headerEl.querySelector(TOGGLE_BUTTON_SELECTOR);
		if (existingButtonEl) {
			return existingButtonEl as HTMLButtonElement;
		}

		const buttonEl = document.createElement('button');
		buttonEl.type = 'button';
		buttonEl.className = 'clickable-icon obpm-bases-group-fold-toggle';
		buttonEl.dataset.obpmBasesGroupFoldToggle = 'true';

		const anchorEl = group.headingEl && group.headingEl !== group.headerEl
			? group.headingEl
			: group.headerEl.firstElementChild;
		group.headerEl.insertBefore(buttonEl, anchorEl);
		return buttonEl;
	}

	private resolveGroupedTableViewRoot(leaf: WorkspaceLeaf): HTMLElement | null {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return null;
		}

		for (const viewEl of Array.from(rootEl.querySelectorAll(BASES_VIEW_SELECTOR))) {
			if (!(viewEl instanceof HTMLElement)) {
				continue;
			}

			if (viewEl.closest(BASES_EMBED_SELECTOR)) {
				continue;
			}

			if (!viewEl.querySelector(BASES_TABLE_CONTAINER_SELECTOR)) {
				continue;
			}

			if (viewEl.querySelector(`${BASES_TABLE_SELECTOR} > ${BASES_GROUP_HEADING_SELECTOR}`)) {
				return viewEl;
			}

			if (viewEl.querySelector(GROUP_CONTAINER_SELECTOR)) {
				return viewEl;
			}
		}

		return null;
	}
}

function extractGroupMetadata(headerEl: HTMLElement, headingEl: HTMLElement): {
	label: string;
	key: string;
} {
	const propertyText = toHtmlElement(headingEl.querySelector(BASES_GROUP_PROPERTY_SELECTOR))?.textContent?.trim() ?? '';
	const valueText = toHtmlElement(headingEl.querySelector(BASES_GROUP_VALUE_SELECTOR))?.textContent?.trim() ?? '';
	const label = propertyText || valueText
		? [propertyText, valueText].filter((entry) => entry.length > 0).join(' ')
		: toHtmlElement(headerEl.querySelector(GROUP_HEADER_TEXT_SELECTOR))?.textContent?.trim()
			?? headingEl.textContent?.trim()
			?? '';
	const normalizedValue = valueText.length > 0 ? valueText : label;

	return {
		label,
		key: getGroupKey(normalizedValue),
	};
}

function findDirectChild(containerEl: HTMLElement, selector: string): HTMLElement | null {
	for (const childNode of Array.from(containerEl.children)) {
		if (childNode instanceof HTMLElement && childNode.matches(selector)) {
			return childNode;
		}
	}

	return null;
}

function toHtmlElement(element: Element | null): HTMLElement | null {
	return element instanceof HTMLElement ? element : null;
}

function stopToggleEvent(event: Event): void {
	event.preventDefault();
	event.stopPropagation();
}

function shouldHandleMutationRecord(record: MutationRecord): boolean {
	if (record.addedNodes.length === 0 && record.removedNodes.length === 0) {
		return false;
	}

	return !mutationOnlyTouchesManagedToggle(record);
}

function mutationOnlyTouchesManagedToggle(record: MutationRecord): boolean {
	const changedNodes = collectChangedNodes(record);
	if (changedNodes.length === 0) {
		return false;
	}

	return changedNodes.every((node) => nodeBelongsToManagedToggle(node));
}

function nodeBelongsToManagedToggle(node: Node): boolean {
	const element = node instanceof Element ? node : node.parentElement;
	return element?.closest('[data-obpm-bases-group-fold-toggle="true"]') !== null;
}

function collectChangedNodes(record: MutationRecord): Node[] {
	const changedNodes: Node[] = [];

	record.addedNodes.forEach((node) => {
		changedNodes.push(node);
	});
	record.removedNodes.forEach((node) => {
		changedNodes.push(node);
	});

	return changedNodes;
}
