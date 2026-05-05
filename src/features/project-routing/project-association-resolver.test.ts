/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {resolveAssociatedProjectCandidate} from './project-association-resolver';

const candidates = [
	{
		filePath: 'projects/crm/CRM.md',
		folderPath: 'projects/crm',
		name: 'CRM',
	},
	{
		filePath: 'projects/nilm/NILM.md',
		folderPath: 'projects/nilm',
		name: 'NILM',
	},
];

describe('resolveAssociatedProjectCandidate', () => {
	it('resolves a direct related project file before folder containment', () => {
		const result = resolveAssociatedProjectCandidate({
			autoUseSingleOpenProject: false,
			openProjectCandidates: [],
			projectCandidates: candidates,
			relatedTargetPaths: ['projects/nilm/NILM.md'],
			sourcePath: 'projects/crm/task.md',
		});

		assert.deepEqual(result, {
			kind: 'project',
			candidate: candidates[1],
		});
	});

	it('resolves a related file inside a project folder to that project', () => {
		const result = resolveAssociatedProjectCandidate({
			autoUseSingleOpenProject: false,
			openProjectCandidates: [],
			projectCandidates: candidates,
			relatedTargetPaths: ['projects/nilm/notes/raw.md'],
			sourcePath: 'inbox/raw.md',
		});

		assert.deepEqual(result, {
			kind: 'project',
			candidate: candidates[1],
		});
	});

	it('uses the containing related project when related targets are ambiguous', () => {
		const result = resolveAssociatedProjectCandidate({
			autoUseSingleOpenProject: false,
			openProjectCandidates: [],
			projectCandidates: candidates,
			relatedTargetPaths: ['projects/crm/plan.md', 'projects/nilm/plan.md'],
			sourcePath: 'projects/crm/task.md',
		});

		assert.deepEqual(result, {
			kind: 'project',
			candidate: candidates[0],
		});
	});

	it('falls back to the only open project only when the option is enabled', () => {
		const result = resolveAssociatedProjectCandidate({
			autoUseSingleOpenProject: true,
			openProjectCandidates: [candidates[1]!],
			projectCandidates: candidates,
			relatedTargetPaths: [],
			sourcePath: 'inbox/raw.md',
		});

		assert.deepEqual(result, {
			kind: 'project',
			candidate: candidates[1],
		});
	});
});
