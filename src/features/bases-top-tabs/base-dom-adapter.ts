import {WorkspaceLeaf} from 'obsidian';
import {BasesTopTabsOrientation, BasesTopTabsPlacement} from '../../settings';

const BASES_HEADER_SELECTOR = '.bases-header';
const BASES_TOOLBAR_SELECTOR = '.bases-toolbar';
const VIEW_CONTENT_SELECTOR = '.view-content';

export interface BasesTabsMountContext {
	actualPlacement: BasesTopTabsPlacement;
	hostEl: HTMLElement;
	referenceEl: ChildNode | null;
}

export class BaseDomAdapter {
	constructor(private readonly debugLog: (message: string, details?: unknown) => void) {}

	createObservers(leaf: WorkspaceLeaf, onChange: () => void): MutationObserver[] {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return [];
		}

		const targets = new Set<HTMLElement>();
		targets.add(rootEl);

		const viewContentEl = rootEl.querySelector<HTMLElement>(VIEW_CONTENT_SELECTOR);
		if (viewContentEl) {
			targets.add(viewContentEl);
		}

		const headerParentEl = rootEl.querySelector<HTMLElement>(BASES_HEADER_SELECTOR)?.parentElement;
		if (headerParentEl instanceof HTMLElement) {
			targets.add(headerParentEl);
		}

		return [...targets].map((targetEl) => {
			const observer = new MutationObserver(() => onChange());
			observer.observe(targetEl, {childList: true});
			return observer;
		});
	}

	mountBar(barEl: HTMLElement, context: BasesTabsMountContext) {
		if (context.actualPlacement === 'inside-toolbar') {
			if (barEl.parentElement !== context.hostEl || barEl !== context.hostEl.firstElementChild) {
				context.hostEl.prepend(barEl);
			}
			return;
		}

		if (barEl.parentElement !== context.hostEl || barEl.nextSibling !== context.referenceEl) {
			context.hostEl.insertBefore(barEl, context.referenceEl);
		}
	}

	resolveMountContext(
		leaf: WorkspaceLeaf,
		requestedPlacement: BasesTopTabsPlacement,
		orientation: BasesTopTabsOrientation,
	): BasesTabsMountContext | null {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return null;
		}

		const headerEl = rootEl.querySelector<HTMLElement>(BASES_HEADER_SELECTOR);
		const toolbarEl = rootEl.querySelector<HTMLElement>(BASES_TOOLBAR_SELECTOR);
		const viewContentEl = rootEl.querySelector<HTMLElement>(VIEW_CONTENT_SELECTOR) ?? rootEl;

		if (requestedPlacement === 'inside-toolbar' && orientation === 'vertical') {
			this.debugLog('Falling back to above-toolbar placement because vertical tabs need their own row.');
		}

		if (requestedPlacement === 'inside-toolbar' && orientation !== 'vertical' && toolbarEl) {
			return {
				actualPlacement: 'inside-toolbar',
				hostEl: toolbarEl,
				referenceEl: toolbarEl.firstChild,
			};
		}

		if (requestedPlacement === 'inside-toolbar' && orientation !== 'vertical' && !toolbarEl) {
			this.debugLog('Falling back to above-toolbar placement because the Bases toolbar is not available.');
		}

		if (headerEl?.parentElement) {
			return {
				actualPlacement: 'above-toolbar',
				hostEl: headerEl.parentElement,
				referenceEl: headerEl,
			};
		}

		return {
			actualPlacement: 'above-toolbar',
			hostEl: viewContentEl,
			referenceEl: viewContentEl.firstChild,
		};
	}
}
