import {WorkspaceLeaf} from 'obsidian';
import type {BasesTopTabsPlacement} from '../../settings';
import {isSidebarPlacement} from './bases-top-tabs-settings';

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
		this.clearSideHost(barEl);

		if (isSidebarPlacement(context.actualPlacement)) {
			context.hostEl.classList.add('obpm-bases-tabs-side-host');
			context.hostEl.classList.toggle('mod-sidebar-right', context.actualPlacement === 'sidebar-right');
			context.hostEl.classList.toggle('mod-sidebar-left', context.actualPlacement === 'sidebar-left');
			context.hostEl.dataset.obpmBasesTabsSidePlacement = context.actualPlacement;
			if (barEl.parentElement !== context.hostEl || barEl !== context.hostEl.firstElementChild) {
				context.hostEl.prepend(barEl);
			}
			return;
		}

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

	unmountBar(barEl: HTMLElement) {
		this.clearSideHost(barEl);
		barEl.remove();
	}

	resolveMountContext(
		leaf: WorkspaceLeaf,
		requestedPlacement: BasesTopTabsPlacement,
	): BasesTabsMountContext | null {
		const rootEl = leaf.view.containerEl;
		if (!(rootEl instanceof HTMLElement)) {
			return null;
		}

		const headerEl = rootEl.querySelector<HTMLElement>(BASES_HEADER_SELECTOR);
		const toolbarEl = rootEl.querySelector<HTMLElement>(BASES_TOOLBAR_SELECTOR);
		const viewContentEl = rootEl.querySelector<HTMLElement>(VIEW_CONTENT_SELECTOR);

		if (isSidebarPlacement(requestedPlacement)) {
			if (!viewContentEl) {
				this.debugLog('Falling back to no tabs because the Bases view content host is not available.');
				return null;
			}

			return {
				actualPlacement: requestedPlacement,
				hostEl: viewContentEl,
				referenceEl: viewContentEl.firstChild,
			};
		}

		if (requestedPlacement === 'inside-toolbar' && toolbarEl) {
			return {
				actualPlacement: 'inside-toolbar',
				hostEl: toolbarEl,
				referenceEl: toolbarEl.firstChild,
			};
		}

		if (requestedPlacement === 'inside-toolbar' && !toolbarEl) {
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
			hostEl: viewContentEl ?? rootEl,
			referenceEl: (viewContentEl ?? rootEl).firstChild,
		};
	}

	private clearSideHost(barEl: HTMLElement) {
		const hostEl = barEl.parentElement?.closest<HTMLElement>('[data-obpm-bases-tabs-side-placement]');
		if (!hostEl) {
			return;
		}

		hostEl.classList.remove('obpm-bases-tabs-side-host', 'mod-sidebar-left', 'mod-sidebar-right');
		hostEl.style.removeProperty('--obpm-bases-tabs-sidebar-width');
		hostEl.style.removeProperty('--obpm-bases-tabs-sidebar-min-width');
		delete hostEl.dataset.obpmBasesTabsSidePlacement;
	}
}
