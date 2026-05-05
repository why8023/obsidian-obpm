/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildOffsetInsertionPlan, removeInsertedText} from './target-insertion';

describe('sent content target insertion', () => {
	it('builds an offset insertion plan with stable spacing and inserted text', () => {
		const plan = buildOffsetInsertionPlan({
			block: '- Source\n    Body',
			content: '# Target\n\nExisting',
			insertOffset: '# Target'.length,
		});

		assert.deepEqual(plan, {
			insertedText: '\n\n- Source\n    Body',
			nextContent: '# Target\n\n- Source\n    Body\n\nExisting',
			offset: '# Target'.length,
		});
	});

	it('removes inserted text by the original offset when undoing', () => {
		const insertedText = '\n\n- Source\n    Body';
		const currentContent = `# Target${insertedText}\n\nExisting`;
		const removalPlan = removeInsertedText(currentContent, {
			insertOffset: '# Target'.length,
			insertedText,
			targetContentAfter: currentContent,
			targetContentBefore: '# Target\n\nExisting',
		});

		assert.deepEqual(removalPlan, {
			end: '# Target'.length + insertedText.length,
			nextContent: '# Target\n\nExisting',
			start: '# Target'.length,
		});
	});
});
