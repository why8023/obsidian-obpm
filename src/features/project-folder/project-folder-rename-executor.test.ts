/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {executeProjectFolderRenamePlan} from './project-folder-rename-executor';

describe('executeProjectFolderRenamePlan', () => {
	it('renames through the provided file-manager callback', async () => {
		const sourceFile = {path: 'Projects/Beta/Alpha.md'};
		const renameCalls: Array<{file: typeof sourceFile; targetPath: string}> = [];

		const result = await executeProjectFolderRenamePlan({
			kind: 'rename',
			sourcePath: 'Projects/Beta/Alpha.md',
			targetPath: 'Projects/Beta/Beta.md',
		}, {
			getFileByPath: (path) => path === sourceFile.path ? sourceFile : null,
			onConflict: () => {
				throw new Error('Conflict handler should not run.');
			},
			pathExists: (path) => path === sourceFile.path,
			renameFile: async (file, targetPath) => {
				renameCalls.push({file, targetPath});
			},
		});

		assert.equal(result, 'renamed');
		assert.deepEqual(renameCalls, [{
			file: sourceFile,
			targetPath: 'Projects/Beta/Beta.md',
		}]);
	});

	it('reports conflicts without renaming', async () => {
		const sourceFile = {path: 'Projects/Beta/Alpha.md'};
		const conflicts: string[] = [];
		let renameCalled = false;

		const result = await executeProjectFolderRenamePlan({
			kind: 'rename',
			sourcePath: 'Projects/Beta/Alpha.md',
			targetPath: 'Projects/Beta/Beta.md',
		}, {
			getFileByPath: (path) => path === sourceFile.path ? sourceFile : null,
			onConflict: (targetPath) => {
				conflicts.push(targetPath);
			},
			pathExists: (path) => path === sourceFile.path || path === 'Projects/Beta/Beta.md',
			renameFile: async () => {
				renameCalled = true;
			},
		});

		assert.equal(result, 'conflict');
		assert.deepEqual(conflicts, ['Projects/Beta/Beta.md']);
		assert.equal(renameCalled, false);
	});
});
