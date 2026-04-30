/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildProjectTargetMovePlan} from './file-move-utils';

describe('buildProjectTargetMovePlan', () => {
	it('moves a file already inside the project folder into a requested target subfolder', () => {
		const plan = buildProjectTargetMovePlan({
			file: {
				basename: 'Capture',
				extension: 'md',
				name: 'Capture.md',
				path: 'Projects/Alpha/raw/Capture.md',
			},
			pathExists: () => false,
			projectFolderPath: 'Projects/Alpha',
			targetSubfolderPath: 'archive',
		});

		assert.deepEqual(plan, {
			kind: 'move',
			targetFolderPath: 'Projects/Alpha/archive',
			targetPath: 'Projects/Alpha/archive/Capture.md',
		});
	});

	it('keeps a file in place when it is already inside the requested target subfolder', () => {
		const plan = buildProjectTargetMovePlan({
			file: {
				basename: 'Capture',
				extension: 'md',
				name: 'Capture.md',
				path: 'Projects/Alpha/archive/Capture.md',
			},
			pathExists: () => false,
			projectFolderPath: 'Projects/Alpha',
			targetSubfolderPath: 'archive',
		});

		assert.deepEqual(plan, {
			kind: 'already-in-target',
			targetFolderPath: 'Projects/Alpha/archive',
			targetPath: 'Projects/Alpha/archive/Capture.md',
		});
	});

	it('keeps existing project-folder behavior when no target subfolder is configured', () => {
		const plan = buildProjectTargetMovePlan({
			file: {
				basename: 'Capture',
				extension: 'md',
				name: 'Capture.md',
				path: 'Projects/Alpha/notes/Capture.md',
			},
			pathExists: () => false,
			projectFolderPath: 'Projects/Alpha',
			targetSubfolderPath: '',
		});

		assert.deepEqual(plan, {
			kind: 'already-in-target',
			targetFolderPath: 'Projects/Alpha',
			targetPath: 'Projects/Alpha/notes/Capture.md',
		});
	});
});
