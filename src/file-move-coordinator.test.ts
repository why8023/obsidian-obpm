/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {FileMoveCoordinator} from './file-move-coordinator';

interface FakeFile {
	name: string;
	path: string;
}

describe('FileMoveCoordinator', () => {
	it('serializes moves and can skip stale automatic requests after another move changed the path', async () => {
		const file: FakeFile = {
			name: 'Capture.md',
			path: 'Inbox/Capture.md',
		};
		const files = new Map([[file.path, file]]);
		const movedPaths: string[] = [];
		const coordinator = new FileMoveCoordinator<FakeFile>({
			getFileByPath: (path) => files.get(path) ?? null,
			renameFile: async (targetFile, targetPath) => {
				files.delete(targetFile.path);
				targetFile.path = targetPath;
				files.set(targetFile.path, targetFile);
				movedPaths.push(targetPath);
			},
		});

		const archiveMove = coordinator.moveFile(file, {
			resolveTargetPath: () => 'Projects/Alpha/archive/Capture.md',
		});
		const rawRoutingMove = coordinator.moveFile(file, {
			resolveTargetPath: () => 'Projects/Alpha/raw/Capture.md',
			skipIfPathChanged: true,
		});

		const results = await Promise.all([archiveMove, rawRoutingMove]);

		assert.deepEqual(movedPaths, ['Projects/Alpha/archive/Capture.md']);
		assert.equal(results[0].kind, 'moved');
		assert.deepEqual(results[1], {
			kind: 'skipped',
			reason: 'path-changed',
			sourcePath: 'Inbox/Capture.md',
		});
	});

	it('re-resolves the live file before running a later explicit move', async () => {
		const file: FakeFile = {
			name: 'Capture.md',
			path: 'Inbox/Capture.md',
		};
		const files = new Map([[file.path, file]]);
		const movedPaths: string[] = [];
		const coordinator = new FileMoveCoordinator<FakeFile>({
			getFileByPath: (path) => files.get(path) ?? null,
			renameFile: async (targetFile, targetPath) => {
				files.delete(targetFile.path);
				targetFile.path = targetPath;
				files.set(targetFile.path, targetFile);
				movedPaths.push(targetPath);
			},
		});

		await coordinator.moveFile(file, {
			resolveTargetPath: () => 'Projects/Alpha/raw/Capture.md',
		});
		const result = await coordinator.moveFile(file, {
			resolveTargetPath: (liveFile) => liveFile.path.replace('/raw/', '/archive/'),
		});

		assert.deepEqual(movedPaths, [
			'Projects/Alpha/raw/Capture.md',
			'Projects/Alpha/archive/Capture.md',
		]);
		assert.deepEqual(result, {
			kind: 'moved',
			sourcePath: 'Projects/Alpha/raw/Capture.md',
			targetPath: 'Projects/Alpha/archive/Capture.md',
		});
	});
});
