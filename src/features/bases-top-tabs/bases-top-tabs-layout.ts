import type {BasesTopTabsView} from './types';

export type DropPosition = 'after' | 'before';
export const BASES_TABS_SIDEBAR_MIN_WIDTH = 80;
export const BASES_TABS_SIDEBAR_DEFAULT_MIN_WIDTH = 80;
export const BASES_TABS_SIDEBAR_MAX_WIDTH = 360;
export const BASES_TABS_DRAG_SCROLL_EDGE_SIZE = 48;
export const BASES_TABS_DRAG_SCROLL_MAX_STEP = 18;

export type DragScrollAxis = 'horizontal' | 'vertical';

export interface OrderedTabView extends BasesTopTabsView {
	pinned: boolean;
}

export function moveViewKey(
	keys: string[],
	dragSourceKey: string,
	targetKey: string,
	position: DropPosition,
): string[] | null {
	const sourceIndex = keys.indexOf(dragSourceKey);
	const targetIndex = keys.indexOf(targetKey);
	if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
		return null;
	}

	const nextKeys = [...keys];
	const [movedKey] = nextKeys.splice(sourceIndex, 1);
	if (!movedKey) {
		return null;
	}

	let insertionIndex = targetIndex + (position === 'after' ? 1 : 0);
	if (sourceIndex < targetIndex) {
		insertionIndex -= 1;
	}

	nextKeys.splice(insertionIndex, 0, movedKey);
	return nextKeys.every((key, index) => key === keys[index]) ? null : nextKeys;
}

export function orderViews(views: BasesTopTabsView[], pinnedViewNames: string[]): OrderedTabView[] {
	const pinnedNameSet = new Set(pinnedViewNames);
	return [...views]
		.map((view) => ({
			...view,
			pinned: pinnedNameSet.has(view.name),
		}))
		.sort((left, right) => {
			if (left.pinned !== right.pinned) {
				return left.pinned ? -1 : 1;
			}

			return left.index - right.index;
		});
}

export function canReorderViews(sourceView: OrderedTabView, targetView: OrderedTabView): boolean {
	return sourceView.pinned === targetView.pinned;
}

export function resolveDragScrollDelta(
	axis: DragScrollAxis,
	pointerPosition: number,
	viewportStart: number,
	viewportEnd: number,
	scrollOffset: number,
	viewportSize: number,
	scrollSize: number,
): number {
	if (
		(axis !== 'horizontal' && axis !== 'vertical')
		||
		viewportEnd <= viewportStart
		|| viewportSize <= 0
		|| scrollSize <= viewportSize + 1
	) {
		return 0;
	}

	const distanceFromStart = pointerPosition - viewportStart;
	if (distanceFromStart >= 0 && distanceFromStart < BASES_TABS_DRAG_SCROLL_EDGE_SIZE && scrollOffset > 1) {
		return -resolveDragScrollStep(distanceFromStart);
	}

	const distanceFromEnd = viewportEnd - pointerPosition;
	if (
		distanceFromEnd >= 0
		&& distanceFromEnd < BASES_TABS_DRAG_SCROLL_EDGE_SIZE
		&& scrollOffset + viewportSize < scrollSize - 1
	) {
		return resolveDragScrollStep(distanceFromEnd);
	}

	return 0;
}

function resolveDragScrollStep(distanceToEdge: number): number {
	const intensity = 1 - distanceToEdge / BASES_TABS_DRAG_SCROLL_EDGE_SIZE;
	return Math.max(2, Math.ceil(BASES_TABS_DRAG_SCROLL_MAX_STEP * intensity));
}

export function resizeSidebarWidth(
	initialWidth: number,
	pointerDelta: number,
	isRightSidebar: boolean,
	minWidth = BASES_TABS_SIDEBAR_DEFAULT_MIN_WIDTH,
): number {
	const nextWidth = initialWidth + (isRightSidebar ? -pointerDelta : pointerDelta);
	return Math.min(BASES_TABS_SIDEBAR_MAX_WIDTH, Math.max(normalizeSidebarMinWidth(minWidth), nextWidth));
}

export function normalizeSidebarMinWidth(
	value: unknown,
	fallback = BASES_TABS_SIDEBAR_DEFAULT_MIN_WIDTH,
): number {
	const fallbackWidth = clampSidebarMinWidth(fallback);
	const numericValue = typeof value === 'number'
		? value
		: typeof value === 'string' && value.trim().length > 0
			? Number.parseInt(value, 10)
			: NaN;

	return Number.isFinite(numericValue) ? clampSidebarMinWidth(numericValue) : fallbackWidth;
}

export function normalizeSidebarWidth(
	value: unknown,
	minWidth = BASES_TABS_SIDEBAR_DEFAULT_MIN_WIDTH,
): number | null {
	const numericValue = typeof value === 'number'
		? value
		: typeof value === 'string' && value.trim().length > 0
			? Number.parseInt(value, 10)
			: NaN;

	if (!Number.isFinite(numericValue)) {
		return null;
	}

	const roundedValue = Math.round(numericValue);
	return Math.min(BASES_TABS_SIDEBAR_MAX_WIDTH, Math.max(normalizeSidebarMinWidth(minWidth), roundedValue));
}

function clampSidebarMinWidth(value: number): number {
	return Math.min(BASES_TABS_SIDEBAR_MAX_WIDTH, Math.max(BASES_TABS_SIDEBAR_MIN_WIDTH, Math.round(value)));
}

export function resolveDisplayedViews(
	orderedViews: OrderedTabView[],
	maxVisibleTabs: number,
	activeViewName: string | null,
	isSidebar: boolean,
): {hiddenViews: OrderedTabView[]; visibleViews: OrderedTabView[]} {
	if (isSidebar) {
		return {
			hiddenViews: [],
			visibleViews: orderedViews,
		};
	}

	return splitViewsForOverflow(orderedViews, maxVisibleTabs, activeViewName);
}

export function resolveFallbackViewName(orderedViews: OrderedTabView[], removedViewKey: string): string | null {
	const removedIndex = orderedViews.findIndex((view) => view.key === removedViewKey);
	if (removedIndex === -1) {
		return orderedViews[0]?.name ?? null;
	}

	return orderedViews[removedIndex + 1]?.name
		?? orderedViews[removedIndex - 1]?.name
		?? null;
}

function splitViewsForOverflow(
	orderedViews: OrderedTabView[],
	maxVisibleTabs: number,
	activeViewName: string | null,
): {hiddenViews: OrderedTabView[]; visibleViews: OrderedTabView[]} {
	if (maxVisibleTabs <= 0 || orderedViews.length <= maxVisibleTabs) {
		return {
			hiddenViews: [],
			visibleViews: orderedViews,
		};
	}

	const pinnedCount = orderedViews.filter((view) => view.pinned).length;
	const initialVisibleCount = Math.max(maxVisibleTabs, pinnedCount);
	const visibleSet = new Set(orderedViews.slice(0, initialVisibleCount).map((view) => view.key));
	const activeView = activeViewName
		? orderedViews.find((view) => view.name === activeViewName)
		: null;

	if (activeView && !visibleSet.has(activeView.key)) {
		const visibleViews = orderedViews.filter((view) => visibleSet.has(view.key));
		const candidateToHide = [...visibleViews]
			.reverse()
			.find((view) => !view.pinned);
		if (candidateToHide) {
			visibleSet.delete(candidateToHide.key);
		}

		visibleSet.add(activeView.key);
	}

	const visibleViews = orderedViews.filter((view) => visibleSet.has(view.key));
	const hiddenViews = orderedViews.filter((view) => !visibleSet.has(view.key));
	return {hiddenViews, visibleViews};
}
