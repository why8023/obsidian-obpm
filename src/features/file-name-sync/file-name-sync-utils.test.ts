/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {getExpectedFileNameSyncPath} from './file-name-sync-utils';

describe('getExpectedFileNameSyncPath', () => {
	it('returns the future path when file-name sync is expected to rename the file', () => {
		const path = getExpectedFileNameSyncPath({
			file: {
				basename: 'Capture',
				extension: 'md',
				parentPath: 'Inbox',
				path: 'Inbox/Capture.md',
			},
			frontmatter: {
				obpm_title: 'Capture regression',
			},
			invalidCharacterReplacement: '_',
			maxLength: 50,
			pathExists: () => false,
			propertyName: 'obpm_title',
		});

		assert.equal(path, 'Inbox/Capture regression.md');
	});

	it('returns null when another file already uses the expected future path', () => {
		const path = getExpectedFileNameSyncPath({
			file: {
				basename: 'Capture',
				extension: 'md',
				parentPath: 'Inbox',
				path: 'Inbox/Capture.md',
			},
			frontmatter: {
				obpm_title: 'Capture regression',
			},
			invalidCharacterReplacement: '_',
			maxLength: 50,
			pathExists: (candidatePath) => candidatePath === 'Inbox/Capture regression.md',
			propertyName: 'obpm_title',
		});

		assert.equal(path, null);
	});
});
