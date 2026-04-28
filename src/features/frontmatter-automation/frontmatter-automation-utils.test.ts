/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	UNAVAILABLE_FRONTMATTER_SNAPSHOT,
	createFrontmatterSnapshotFromMetadataCache,
} from './frontmatter-automation-utils';

describe('createFrontmatterSnapshotFromMetadataCache', () => {
	it('distinguishes unavailable metadata from parsed empty frontmatter', () => {
		assert.equal(
			createFrontmatterSnapshotFromMetadataCache(null),
			UNAVAILABLE_FRONTMATTER_SNAPSHOT,
		);
		assert.equal(createFrontmatterSnapshotFromMetadataCache({}), null);
	});

	it('creates a snapshot when metadata cache contains frontmatter', () => {
		const snapshot = createFrontmatterSnapshotFromMetadataCache({
			frontmatter: {
				obpm_status: 'done',
			},
		});

		assert.deepEqual(snapshot, {
			obpm_status: 'done',
		});
	});
});
