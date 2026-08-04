/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	DEFAULT_BASES_TOP_TABS_PROJECT_FILE_CLICK_MODIFIER,
	DEFAULT_BASES_TOP_TABS_PROJECT_FILE_REVEAL_MODIFIER,
	DEFAULT_BASES_TOP_TABS_PROJECT_FOLDER_CLICK_MODIFIER,
	matchesProjectFileClickModifier,
	normalizeBasesTopTabsProjectFileClickModifier,
	normalizeBasesTopTabsProjectFileClickModifiers,
	resolveProjectFileClickAction,
} from './bases-top-tabs-settings';

describe('Bases top tabs settings', () => {
	it('normalizes the configurable project file click modifier', () => {
		assert.equal(DEFAULT_BASES_TOP_TABS_PROJECT_FILE_CLICK_MODIFIER, 'primary');
		assert.equal(normalizeBasesTopTabsProjectFileClickModifier('alt'), 'alt');
		assert.equal(normalizeBasesTopTabsProjectFileClickModifier('invalid'), 'primary');
		assert.deepEqual(
			normalizeBasesTopTabsProjectFileClickModifiers({
				folder: 'primary',
				open: 'primary',
				reveal: 'invalid',
			}),
			{
				folder: 'alt',
				open: 'primary',
				reveal: 'shift',
			},
		);
		assert.equal(DEFAULT_BASES_TOP_TABS_PROJECT_FOLDER_CLICK_MODIFIER, 'alt');
		assert.equal(DEFAULT_BASES_TOP_TABS_PROJECT_FILE_REVEAL_MODIFIER, 'shift');
	});

	it('matches only the selected modifier with a primary click', () => {
		const baseEvent = {
			altKey: false,
			button: 0,
			ctrlKey: false,
			defaultPrevented: false,
			metaKey: false,
			shiftKey: false,
		};

		assert.equal(matchesProjectFileClickModifier({...baseEvent, ctrlKey: true}, 'primary'), true);
		assert.equal(matchesProjectFileClickModifier({...baseEvent, metaKey: true}, 'primary'), true);
		assert.equal(matchesProjectFileClickModifier({...baseEvent, altKey: true}, 'primary'), false);
		assert.equal(matchesProjectFileClickModifier({...baseEvent, shiftKey: true}, 'shift'), true);
		assert.equal(matchesProjectFileClickModifier({...baseEvent, altKey: true}, 'alt'), true);
		assert.equal(matchesProjectFileClickModifier({...baseEvent, button: 2, altKey: true}, 'alt'), false);
		const modifiers = {folder: 'alt' as const, open: 'primary' as const, reveal: 'shift' as const};
		assert.equal(resolveProjectFileClickAction({...baseEvent, ctrlKey: true}, modifiers), 'open-file');
		assert.equal(resolveProjectFileClickAction({...baseEvent, altKey: true}, modifiers), 'open-folder');
		assert.equal(resolveProjectFileClickAction({...baseEvent, shiftKey: true}, modifiers), 'reveal-file');
		assert.equal(resolveProjectFileClickAction({...baseEvent, altKey: true, shiftKey: true}, modifiers), null);
	});
});
