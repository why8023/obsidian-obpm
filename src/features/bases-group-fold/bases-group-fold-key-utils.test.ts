/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {getGroupFoldAllAction, getGroupKey, matchesGroupKey} from './bases-group-fold-key-utils';

describe('Bases group fold keys', () => {
	it('keeps legacy property-prefixed group state compatible', () => {
		assert.equal(getGroupKey('  项目2  '), '项目2');
		assert.equal(matchesGroupKey('obpm_related 项目2', '项目2'), true);
		assert.equal(matchesGroupKey('项目2', '项目2'), true);
		assert.equal(matchesGroupKey('项目20', '项目2'), false);
		assert.equal(matchesGroupKey('项目2', '项目20'), false);
	});

	it('chooses a deterministic action for mixed group state', () => {
		assert.equal(getGroupFoldAllAction(new Set(), ['a', 'b']), 'collapse');
		assert.equal(getGroupFoldAllAction(new Set(['a']), ['a', 'b']), 'collapse');
		assert.equal(getGroupFoldAllAction(new Set(['a', 'b']), ['a', 'b']), 'expand');
		assert.equal(getGroupFoldAllAction(new Set(['a']), []), 'collapse');
	});
});
