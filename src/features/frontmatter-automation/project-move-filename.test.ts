/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildProjectMoveFileName} from './project-move-filename';

const moveTime = new Date(2026, 5, 4, 17, 6, 7);

describe('buildProjectMoveFileName', () => {
	it('adds the move time as a filename prefix', () => {
		assert.equal(
			buildProjectMoveFileName({
				basename: 'Capture',
				extension: 'md',
				fileNameTime: {
					enabled: true,
					format: 'YYYY-MM-DD HH-mm',
					position: 'prefix',
				},
				now: moveTime,
			}).name,
			'2026-06-04 17-06 Capture.md',
		);
	});

	it('adds the move time as a filename suffix', () => {
		assert.equal(
			buildProjectMoveFileName({
				basename: 'Capture',
				extension: 'md',
				fileNameTime: {
					enabled: true,
					format: 'YYYY-MM-DD',
					position: 'suffix',
				},
				now: moveTime,
			}).name,
			'Capture 2026-06-04.md',
		);
	});

	it('replaces an existing matching time instead of adding another one', () => {
		assert.equal(
			buildProjectMoveFileName({
				basename: '2026-05-30 Capture',
				extension: 'md',
				fileNameTime: {
					enabled: true,
					format: 'YYYY-MM-DD',
					position: 'suffix',
				},
				now: moveTime,
			}).name,
			'2026-06-04 Capture.md',
		);
	});

	it('sanitizes invalid filename characters in the generated move time', () => {
		assert.equal(
			buildProjectMoveFileName({
				basename: 'Capture',
				extension: 'md',
				fileNameTime: {
					enabled: true,
					format: 'YYYY/MM/DDTHH:mm:ss',
					position: 'prefix',
				},
				now: moveTime,
			}).name,
			'2026-06-04T17-06-07 Capture.md',
		);
	});

	it('keeps the source filename when move-time renaming is disabled', () => {
		assert.deepEqual(
			buildProjectMoveFileName({
				basename: 'Capture',
				extension: 'md',
				fileNameTime: {
					enabled: false,
					format: 'YYYY-MM-DD',
					position: 'prefix',
				},
				now: moveTime,
			}),
			{
				basename: 'Capture',
				name: 'Capture.md',
			},
		);
	});
});
