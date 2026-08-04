export type BasesTopTabsPlacement = 'above-toolbar' | 'inside-toolbar' | 'sidebar-left' | 'sidebar-right';
export type BasesTopTabsProjectFileClickModifier = 'primary' | 'alt' | 'shift';
export type BasesTopTabsProjectFileClickAction = 'open-file' | 'open-folder' | 'reveal-file';

export interface BasesTopTabsProjectFileClickModifiers {
	folder: BasesTopTabsProjectFileClickModifier;
	open: BasesTopTabsProjectFileClickModifier;
	reveal: BasesTopTabsProjectFileClickModifier;
}

export const DEFAULT_BASES_TOP_TABS_PROJECT_FILE_CLICK_MODIFIER: BasesTopTabsProjectFileClickModifier = 'primary';
export const DEFAULT_BASES_TOP_TABS_PROJECT_FOLDER_CLICK_MODIFIER: BasesTopTabsProjectFileClickModifier = 'alt';
export const DEFAULT_BASES_TOP_TABS_PROJECT_FILE_REVEAL_MODIFIER: BasesTopTabsProjectFileClickModifier = 'shift';

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

export function normalizeBasesTopTabsProjectFileClickModifiers(values: {
	folder: unknown;
	open: unknown;
	reveal: unknown;
}, fallbacks: BasesTopTabsProjectFileClickModifiers = {
	open: DEFAULT_BASES_TOP_TABS_PROJECT_FILE_CLICK_MODIFIER,
	folder: DEFAULT_BASES_TOP_TABS_PROJECT_FOLDER_CLICK_MODIFIER,
	reveal: DEFAULT_BASES_TOP_TABS_PROJECT_FILE_REVEAL_MODIFIER,
}): BasesTopTabsProjectFileClickModifiers {
	const used = new Set<BasesTopTabsProjectFileClickModifier>();
	return {
		open: pickUnusedProjectFileClickModifier(values.open, fallbacks.open, used),
		folder: pickUnusedProjectFileClickModifier(values.folder, fallbacks.folder, used),
		reveal: pickUnusedProjectFileClickModifier(values.reveal, fallbacks.reveal, used),
	};
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

export function resolveProjectFileClickAction(
	event: Pick<MouseEvent, 'altKey' | 'button' | 'ctrlKey' | 'defaultPrevented' | 'metaKey' | 'shiftKey'>,
	modifiers: BasesTopTabsProjectFileClickModifiers,
): BasesTopTabsProjectFileClickAction | null {
	if (matchesProjectFileClickModifier(event, modifiers.open)) {
		return 'open-file';
	}

	if (matchesProjectFileClickModifier(event, modifiers.folder)) {
		return 'open-folder';
	}

	if (matchesProjectFileClickModifier(event, modifiers.reveal)) {
		return 'reveal-file';
	}

	return null;
}

function pickUnusedProjectFileClickModifier(
	value: unknown,
	fallback: BasesTopTabsProjectFileClickModifier,
	used: Set<BasesTopTabsProjectFileClickModifier>,
): BasesTopTabsProjectFileClickModifier {
	const normalizedValue = normalizeBasesTopTabsProjectFileClickModifier(value, fallback);
	if (!used.has(normalizedValue)) {
		used.add(normalizedValue);
		return normalizedValue;
	}

	for (const candidate of ['primary', 'alt', 'shift'] as const) {
		if (!used.has(candidate)) {
			used.add(candidate);
			return candidate;
		}
	}

	return normalizedValue;
}
