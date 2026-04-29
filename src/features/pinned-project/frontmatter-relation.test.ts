/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	appendUniqueRelationLinkValue,
	buildTargetWikilinkValue,
} from './frontmatter-relation';

describe('appendUniqueRelationLinkValue', () => {
	it('creates an array with the pinned target link for an empty relation value', () => {
		const result = appendUniqueRelationLinkValue(
			undefined,
			'[[Projects/Alpha/Alpha]]',
			'Projects/Alpha/Alpha.md',
		);

		assert.equal(result.changed, true);
		assert.deepEqual(result.value, ['[[Projects/Alpha/Alpha]]']);
	});

	it('appends the pinned target link while preserving existing relation values', () => {
		const result = appendUniqueRelationLinkValue(
			'[[Projects/Beta/Beta]]',
			'[[Projects/Alpha/Alpha]]',
			'Projects/Alpha/Alpha.md',
		);

		assert.equal(result.changed, true);
		assert.deepEqual(result.value, [
			'[[Projects/Beta/Beta]]',
			'[[Projects/Alpha/Alpha]]',
		]);
	});

	it('does not duplicate an existing pinned target relation', () => {
		const currentValue = [
			'[[Projects/Alpha/Alpha|Alpha project]]',
			'[[Projects/Beta/Beta]]',
		];
		const result = appendUniqueRelationLinkValue(
			currentValue,
			'[[Projects/Alpha/Alpha]]',
			'Projects/Alpha/Alpha.md',
		);

		assert.equal(result.changed, false);
		assert.equal(result.value, currentValue);
	});
});

describe('buildTargetWikilinkValue', () => {
	it('builds a vault-path wikilink without the markdown extension', () => {
		assert.equal(
			buildTargetWikilinkValue('Projects/Alpha/Alpha.md'),
			'[[Projects/Alpha/Alpha]]',
		);
	});
});
