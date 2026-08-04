/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {BasesTopTabsStateStore} from './bases-top-tabs-state-store';
import type {BasesTopTabsPluginContext} from './types';

describe('Bases top tabs state store', () => {
	it('persists sidebar widths independently per Base file and side', async () => {
		let saveCount = 0;
		const plugin = {
			settings: {
				basesTopTabs: {
					filesState: {},
				},
			},
			saveSettings: async () => {
				saveCount += 1;
			},
		} as unknown as BasesTopTabsPluginContext;
		const store = new BasesTopTabsStateStore(plugin);

		await store.setSidebarWidth('one.base', 'sidebar-left', 200);
		await store.setSidebarWidth('one.base', 'sidebar-right', 300);
		await store.setSidebarWidth('two.base', 'sidebar-left', 220);

		assert.equal(store.getSidebarWidth('one.base', 'sidebar-left'), 200);
		assert.equal(store.getSidebarWidth('one.base', 'sidebar-right'), 300);
		assert.equal(store.getSidebarWidth('two.base', 'sidebar-left'), 220);
		assert.equal(store.getSidebarWidth('two.base', 'sidebar-right'), null);
		assert.equal(store.getSidebarWidth('one.base', 'inside-toolbar'), null);
		assert.equal(saveCount, 3);
	});

	it('keeps older file state valid without sidebar widths', () => {
		const plugin = {
			settings: {
				basesTopTabs: {
					filesState: {
						'legacy.base': {
							lastViewName: 'Table',
							pinnedViewNames: [],
						},
					},
				},
			},
			saveSettings: async () => undefined,
		} as unknown as BasesTopTabsPluginContext;
		const store = new BasesTopTabsStateStore(plugin);

		assert.equal(store.getSidebarWidth('legacy.base', 'sidebar-left'), null);
	});
});
