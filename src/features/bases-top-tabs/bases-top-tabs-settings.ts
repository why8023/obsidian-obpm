export type BasesTopTabsPlacement = 'above-toolbar' | 'inside-toolbar' | 'sidebar-left' | 'sidebar-right';

export function isSidebarPlacement(placement: BasesTopTabsPlacement): boolean {
	return placement === 'sidebar-left' || placement === 'sidebar-right';
}

export function normalizeBasesTopTabsPlacement(value: unknown, fallback: BasesTopTabsPlacement): BasesTopTabsPlacement {
	return value === 'above-toolbar'
		|| value === 'inside-toolbar'
		|| value === 'sidebar-left'
		|| value === 'sidebar-right'
		? value
		: fallback;
}
