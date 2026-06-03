/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	buildNewProjectFolderCreationPlan,
	buildProjectFolderChildRenameSyncPlan,
	buildProjectFileOpenTarget,
	buildProjectFileRenameSyncPlan,
	buildProjectFolderRenameSyncPlan,
	findProjectParentFolderFileConflict,
	isDirectSameNameProjectFile,
	joinPath,
	normalizeProjectParentFolderPath,
} from './project-folder-utils';
import {
	DEFAULT_PROJECT_FOLDER_SETTINGS,
	normalizeProjectFolderSettings,
} from './project-folder-settings';

describe('project-folder utilities', () => {
	it('recognizes only markdown files whose basename matches their direct parent folder name', () => {
		assert.equal(isDirectSameNameProjectFile({
			basename: 'Alpha',
			extension: 'md',
			parentName: 'Alpha',
			parentPath: 'Projects/Alpha',
			path: 'Projects/Alpha/Alpha.md',
		}), true);

		assert.equal(isDirectSameNameProjectFile({
			basename: 'Alpha',
			extension: 'md',
			parentName: 'Beta',
			parentPath: 'Projects/Beta',
			path: 'Projects/Beta/Alpha.md',
		}), false);

		assert.equal(isDirectSameNameProjectFile({
			basename: 'Alpha',
			extension: 'canvas',
			parentName: 'Alpha',
			parentPath: 'Projects/Alpha',
			path: 'Projects/Alpha/Alpha.canvas',
		}), false);
	});

	it('builds a quick-open target for a folder with a direct same-name markdown file', () => {
		const target = buildProjectFileOpenTarget({
			folder: {
				name: 'Alpha',
				path: 'Projects/Alpha',
			},
			pathExists: (path) => path === 'Projects/Alpha/Alpha.md',
		});

		assert.equal(target, 'Projects/Alpha/Alpha.md');
	});

	it('does not build a quick-open target when the direct same-name markdown file is missing', () => {
		const target = buildProjectFileOpenTarget({
			folder: {
				name: 'Alpha',
				path: 'Projects/Alpha',
			},
			pathExists: () => false,
		});

		assert.equal(target, null);
	});

	it('plans project file rename after a direct project folder is renamed', () => {
		const plan = buildProjectFolderRenameSyncPlan({
			newFolderPath: 'Projects/Beta',
			oldFolderPath: 'Projects/Alpha',
			pathExists: (path) => path === 'Projects/Beta/Alpha.md',
		});

		assert.deepEqual(plan, {
			kind: 'rename',
			sourcePath: 'Projects/Beta/Alpha.md',
			targetPath: 'Projects/Beta/Beta.md',
		});
	});

	it('reports a project file name conflict after a direct project folder is renamed', () => {
		const plan = buildProjectFolderRenameSyncPlan({
			newFolderPath: 'Projects/Beta',
			oldFolderPath: 'Projects/Alpha',
			pathExists: (path) => path === 'Projects/Beta/Alpha.md' || path === 'Projects/Beta/Beta.md',
		});

		assert.deepEqual(plan, {
			kind: 'conflict',
			sourcePath: 'Projects/Beta/Alpha.md',
			targetPath: 'Projects/Beta/Beta.md',
		});
	});

	it('plans parent folder rename after a direct project file is renamed in place', () => {
		const plan = buildProjectFileRenameSyncPlan({
			newFileBasename: 'Beta',
			newFileExtension: 'md',
			newFileParentPath: 'Projects/Alpha',
			oldFilePath: 'Projects/Alpha/Alpha.md',
			pathExists: (path) => path === 'Projects/Alpha',
		});

		assert.deepEqual(plan, {
			kind: 'rename',
			sourcePath: 'Projects/Alpha',
			targetPath: 'Projects/Beta',
		});
	});

	it('skips folder synchronization when the project file was moved between folders', () => {
		const plan = buildProjectFileRenameSyncPlan({
			newFileBasename: 'Beta',
			newFileExtension: 'md',
			newFileParentPath: 'Projects/Beta',
			oldFilePath: 'Projects/Alpha/Alpha.md',
			pathExists: () => true,
		});

		assert.equal(plan, null);
	});

	it('reports a folder name conflict after a direct project file is renamed', () => {
		const plan = buildProjectFileRenameSyncPlan({
			newFileBasename: 'Beta',
			newFileExtension: 'md',
			newFileParentPath: 'Projects/Alpha',
			oldFilePath: 'Projects/Alpha/Alpha.md',
			pathExists: (path) => path === 'Projects/Alpha' || path === 'Projects/Beta',
		});

		assert.deepEqual(plan, {
			kind: 'conflict',
			sourcePath: 'Projects/Alpha',
			targetPath: 'Projects/Beta',
		});
	});

	it('plans project file rename from a child file rename emitted after its project folder was renamed', () => {
		const plan = buildProjectFolderChildRenameSyncPlan({
			newFilePath: 'Projects/Beta/Alpha.md',
			newFolderPath: 'Projects/Beta',
			oldFilePath: 'Projects/Alpha/Alpha.md',
			oldFolderPath: 'Projects/Alpha',
			pathExists: (path) => path === 'Projects/Beta/Alpha.md',
		});

		assert.deepEqual(plan, {
			kind: 'rename',
			sourcePath: 'Projects/Beta/Alpha.md',
			targetPath: 'Projects/Beta/Beta.md',
		});
	});

	it('normalizes project-folder feature settings independently from project routing', () => {
		assert.deepEqual(DEFAULT_PROJECT_FOLDER_SETTINGS, {
			createProjectCommandEnabled: true,
			createProjectParentFolderPath: '',
			enabled: true,
		});

		assert.deepEqual(normalizeProjectFolderSettings({enabled: false}), {
			createProjectCommandEnabled: true,
			createProjectParentFolderPath: '',
			enabled: false,
		});

		assert.deepEqual(normalizeProjectFolderSettings({enabled: 'no'}), {
			createProjectCommandEnabled: true,
			createProjectParentFolderPath: '',
			enabled: true,
		});
	});

	it('normalizes the parent folder path for the new project command', () => {
		assert.equal(normalizeProjectParentFolderPath(' 1_project\\Work / ./ '), '1_project/Work');
		assert.equal(normalizeProjectParentFolderPath('../outside'), 'outside');
		assert.equal(normalizeProjectParentFolderPath(''), '');
		assert.equal(normalizeProjectParentFolderPath(123), '');
	});

	it('keeps existing path joining behavior for non-parent project-folder helpers', () => {
		assert.equal(joinPath('Projects/..', 'Alpha.md'), 'Projects/../Alpha.md');
	});

	it('finds the first file conflict in a configured parent folder path', () => {
		const conflictPath = findProjectParentFolderFileConflict({
			parentFolderPath: 'Projects/Blocked/Child',
			pathExists: (path) => path === 'Projects' || path === 'Projects/Blocked',
			pathIsFolder: (path) => path === 'Projects',
		});

		assert.equal(conflictPath, 'Projects/Blocked');
	});

	it('does not report missing parent path segments as conflicts', () => {
		const conflictPath = findProjectParentFolderFileConflict({
			parentFolderPath: 'Projects/New/Child',
			pathExists: (path) => path === 'Projects',
			pathIsFolder: (path) => path === 'Projects',
		});

		assert.equal(conflictPath, null);
	});

	it('builds a new project folder and same-name markdown creation plan', () => {
		const plan = buildNewProjectFolderCreationPlan({
			parentFolderPath: '1_project',
			projectName: ' Alpha ',
			pathExists: () => false,
		});

		assert.deepEqual(plan, {
			kind: 'create',
			folderPath: '1_project/Alpha',
			filePath: '1_project/Alpha/Alpha.md',
			projectName: 'Alpha',
		});
	});

	it('treats a single trailing markdown extension as input sugar for a project name', () => {
		const plan = buildNewProjectFolderCreationPlan({
			parentFolderPath: '1_project',
			projectName: 'Alpha.md.md',
			pathExists: () => false,
		});

		assert.deepEqual(plan, {
			kind: 'create',
			folderPath: '1_project/Alpha.md',
			filePath: '1_project/Alpha.md/Alpha.md.md',
			projectName: 'Alpha.md',
		});
	});

	it('reports an existing project folder as a new project creation conflict', () => {
		const plan = buildNewProjectFolderCreationPlan({
			parentFolderPath: '1_project',
			projectName: 'Alpha',
			pathExists: (path) => path === '1_project/Alpha',
		});

		assert.deepEqual(plan, {
			kind: 'conflict',
			conflictPath: '1_project/Alpha',
			folderPath: '1_project/Alpha',
			filePath: '1_project/Alpha/Alpha.md',
			projectName: 'Alpha',
		});
	});

	it('normalizes new project command settings from saved data', () => {
		assert.deepEqual(normalizeProjectFolderSettings({
			createProjectCommandEnabled: false,
			createProjectParentFolderPath: ' 1_project\\Work ',
			enabled: true,
		}), {
			createProjectCommandEnabled: false,
			createProjectParentFolderPath: '1_project/Work',
			enabled: true,
		});

		assert.deepEqual(normalizeProjectFolderSettings({
			createProjectCommandEnabled: 'no',
			createProjectParentFolderPath: 42,
			enabled: true,
		}), {
			createProjectCommandEnabled: true,
			createProjectParentFolderPath: '',
			enabled: true,
		});
	});
});
