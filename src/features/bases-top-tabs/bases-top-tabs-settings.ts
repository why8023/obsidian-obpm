export type BasesTopTabsPlacement = 'above-toolbar' | 'inside-toolbar' | 'sidebar-left' | 'sidebar-right';
export type BasesTopTabsProjectFileClickModifier = 'primary' | 'alt' | 'shift';

export const DEFAULT_BASES_TOP_TABS_PROJECT_FILE_CLICK_MODIFIER: BasesTopTabsProjectFileClickModifier = 'primary';

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

export function normalizeBasesTopTabsProjectFileClickModifier(
	value: unknown,
	fallback = DEFAULT_BASES_TOP_TABS_PROJECT_FILE_CLICK_MODIFIER,
): BasesTopTabsProjectFileClickModifier {
	return value === 'primary' || value === 'alt' || value === 'shift' ? value : fallback;
}

export function matchesProjectFileClickModifier(
	event: Pick<MouseEvent, 'altKey' | 'button' | 'ctrlKey' | 'defaultPrevented' | 'metaKey' | 'shiftKey'>,
	modifier: BasesTopTabsProjectFileClickModifier,
): boolean {
	if (event.button !== 0 || event.defaultPrevented) {
		return false;
	}

	const hasOnlyAlt = event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
	const hasOnlyPrimary = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
	const hasOnlyShift = event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;

	switch (modifier) {
		case 'alt':
			return hasOnlyAlt;
		case 'shift':
			return hasOnlyShift;
		case 'primary':
			return hasOnlyPrimary;
	}
}
