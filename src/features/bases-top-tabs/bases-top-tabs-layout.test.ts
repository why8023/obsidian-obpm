/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	BASES_TABS_SIDEBAR_MAX_WIDTH,
	BASES_TABS_SIDEBAR_DEFAULT_MIN_WIDTH,
	BASES_TABS_SIDEBAR_MIN_WIDTH,
	canReorderViews,
	moveViewKey,
	normalizeSidebarMinWidth,
	normalizeSidebarWidth,
	orderViews,
	resizeSidebarWidth,
	resolveDisplayedViews,
} from './bases-top-tabs-layout';
import {
	isSidebarPlacement,
	normalizeBasesTopTabsPlacement,
} from './bases-top-tabs-settings';
import type {BasesTopTabsView} from './types';

describe('Bases top tabs layout', () => {
	it('normalizes legacy and sidebar placements', () => {
		assert.equal(normalizeBasesTopTabsPlacement('above-toolbar', 'sidebar-left'), 'above-toolbar');
		assert.equal(normalizeBasesTopTabsPlacement('sidebar-right', 'above-toolbar'), 'sidebar-right');
		assert.equal(normalizeBasesTopTabsPlacement('invalid', 'sidebar-left'), 'sidebar-left');
		assert.equal(isSidebarPlacement('sidebar-left'), true);
		assert.equal(isSidebarPlacement('inside-toolbar'), false);
	});

	it('shows every ordered view in sidebar mode regardless of the top overflow limit', () => {
		const orderedViews = orderViews(createViews(['First', 'Pinned', 'Third']), ['Pinned']);

		const result = resolveDisplayedViews(orderedViews, 1, 'Third', true);

		assert.deepEqual(result.visibleViews.map((view) => view.name), ['Pinned', 'First', 'Third']);
		assert.deepEqual(result.hiddenViews, []);
	});

	it('keeps top overflow and pinned-group reorder rules', () => {
		const orderedViews = orderViews(createViews(['First', 'Pinned', 'Third']), ['Pinned']);
		const topResult = resolveDisplayedViews(orderedViews, 2, 'First', false);

		assert.deepEqual(topResult.visibleViews.map((view) => view.name), ['Pinned', 'First']);
		assert.deepEqual(topResult.hiddenViews.map((view) => view.name), ['Third']);
		assert.equal(canReorderViews(orderedViews[0]!, orderedViews[1]!), false);
		assert.equal(canReorderViews(orderedViews[1]!, orderedViews[2]!), true);
	});

	it('moves a tab before/after in the current order', () => {
		assert.deepEqual(moveViewKey(['first', 'second', 'third'], 'third', 'first', 'before'), [
			'third',
			'first',
			'second',
		]);
		assert.deepEqual(moveViewKey(['first', 'second', 'third'], 'first', 'third', 'after'), [
			'second',
			'third',
			'first',
		]);
	});

	it('clamps dragged sidebar widths for both sides', () => {
		assert.equal(resizeSidebarWidth(200, 40, false), 240);
		assert.equal(resizeSidebarWidth(200, 40, true), 160);
		assert.equal(resizeSidebarWidth(200, -200, false), BASES_TABS_SIDEBAR_DEFAULT_MIN_WIDTH);
		assert.equal(resizeSidebarWidth(200, -200, true), BASES_TABS_SIDEBAR_MAX_WIDTH);
		assert.equal(resizeSidebarWidth(200, -200, false, 90), 90);
		assert.equal(normalizeSidebarMinWidth(90), 90);
		assert.equal(normalizeSidebarMinWidth(20), BASES_TABS_SIDEBAR_MIN_WIDTH);
		assert.equal(normalizeSidebarMinWidth('invalid'), BASES_TABS_SIDEBAR_DEFAULT_MIN_WIDTH);
		assert.equal(normalizeSidebarWidth(239.998), 240);
		assert.equal(normalizeSidebarWidth(80, 140), 140);
		assert.equal(normalizeSidebarWidth(500), BASES_TABS_SIDEBAR_MAX_WIDTH);
		assert.equal(normalizeSidebarWidth('invalid'), null);
	});
});

function createViews(names: string[]): BasesTopTabsView[] {
	return names.map((name, index) => ({
		icon: 'layout-template',
		index,
		key: `table:${index}:${name}`,
		name,
		type: 'table',
	}));
}
