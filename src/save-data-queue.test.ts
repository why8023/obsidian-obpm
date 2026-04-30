/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {SaveDataQueue} from './save-data-queue';

describe('SaveDataQueue', () => {
	it('serializes saves and writes the latest snapshot at execution time', async () => {
		let state = {
			relatedLinksVersion: 1,
			settingsVersion: 1,
		};
		const firstSaveGate: {release: (() => void) | null} = {release: null};
		const savedSnapshots: typeof state[] = [];
		const queue = new SaveDataQueue<typeof state>(async (snapshot) => {
			savedSnapshots.push({...snapshot});
			if (savedSnapshots.length === 1) {
				await new Promise<void>((resolve) => {
					firstSaveGate.release = resolve;
				});
			}
		});

		const firstSave = queue.enqueue(() => state);
		state = {
			relatedLinksVersion: 1,
			settingsVersion: 2,
		};
		const secondSave = queue.enqueue(() => state);

		await waitFor(() => savedSnapshots.length === 1);
		state = {
			relatedLinksVersion: 2,
			settingsVersion: 2,
		};
		if (!firstSaveGate.release) {
			throw new Error('First save did not start.');
		}

		firstSaveGate.release();
		await Promise.all([firstSave, secondSave]);

		assert.deepEqual(savedSnapshots, [
			{
				relatedLinksVersion: 1,
				settingsVersion: 2,
			},
			{
				relatedLinksVersion: 2,
				settingsVersion: 2,
			},
		]);
	});

	it('continues accepting saves after a previous save fails', async () => {
		const savedSnapshots: number[] = [];
		let shouldFail = true;
		const queue = new SaveDataQueue<number>(async (snapshot) => {
			if (shouldFail) {
				shouldFail = false;
				throw new Error('write failed');
			}

			savedSnapshots.push(snapshot);
		});

		await assert.rejects(queue.enqueue(() => 1), /write failed/);
		await queue.enqueue(() => 2);

		assert.deepEqual(savedSnapshots, [2]);
	});
});

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		if (predicate()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	throw new Error('Timed out waiting for predicate.');
}
