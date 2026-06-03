/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {runCreateProjectFolderCommand} from './project-folder-command';

describe('runCreateProjectFolderCommand', () => {
	it('opens the prompt before enqueueing the project creation work', async () => {
		const events: string[] = [];

		await runCreateProjectFolderCommand({
			createProject: async (projectName) => {
				events.push(`create:${projectName}`);
			},
			enqueue: async (task) => {
				events.push('enqueue');
				await task();
			},
			isEnabled: () => true,
			onDisabled: () => {
				events.push('disabled');
			},
			openPrompt: async () => {
				events.push('prompt');
				return 'Alpha';
			},
		});

		assert.deepEqual(events, [
			'prompt',
			'enqueue',
			'create:Alpha',
		]);
	});

	it('does not enqueue work when the prompt is canceled', async () => {
		const events: string[] = [];

		await runCreateProjectFolderCommand({
			createProject: async () => {
				events.push('create');
			},
			enqueue: async (task) => {
				events.push('enqueue');
				await task();
			},
			isEnabled: () => true,
			onDisabled: () => {
				events.push('disabled');
			},
			openPrompt: async () => null,
		});

		assert.deepEqual(events, []);
	});

	it('checks whether the command is still enabled inside the queued creation work', async () => {
		const events: string[] = [];
		let enabled = true;

		await runCreateProjectFolderCommand({
			createProject: async () => {
				events.push('create');
			},
			enqueue: async (task) => {
				events.push('enqueue');
				enabled = false;
				await task();
			},
			isEnabled: () => enabled,
			onDisabled: () => {
				events.push('disabled');
			},
			openPrompt: async () => 'Alpha',
		});

		assert.deepEqual(events, [
			'enqueue',
			'disabled',
		]);
	});
});
