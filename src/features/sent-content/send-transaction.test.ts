/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {sendContentToTarget} from './send-transaction';
import {buildOffsetInsertionPlan} from './target-insertion';

describe('sendContentToTarget', () => {
	it('rolls back target insertion when trashing the source fails', async () => {
		let targetContent = '# Target';
		const sourceContent = 'Body';

		await assert.rejects(
			async () => sendContentToTarget({
				buildInsertionPlan: ({targetContentBefore}) => buildOffsetInsertionPlan({
					block: '- Source\n    Body',
					content: targetContentBefore,
					insertOffset: targetContentBefore.length,
				}),
				readSourceContent: async () => sourceContent,
				readTargetContent: async () => targetContent,
				sourcePath: 'source.md',
				targetPath: 'target.md',
				trashSource: async () => {
					throw new Error('trash failed');
				},
				writeTargetContent: async (nextContent) => {
					targetContent = nextContent;
					return targetContent;
				},
				rollbackTargetContent: async ({targetContentAfter, targetContentBefore}) => {
					if (targetContent === targetContentAfter) {
						targetContent = targetContentBefore;
					}
				},
			}),
			/trash failed/,
		);

		assert.equal(targetContent, '# Target');
	});
});
