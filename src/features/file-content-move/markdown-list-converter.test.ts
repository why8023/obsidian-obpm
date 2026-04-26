/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildMovedContentList} from './markdown-list-converter';

describe('buildMovedContentList', () => {
	it('removes spacer blank lines between paragraphs', () => {
		const result = buildMovedContentList({
			sourceBasename: 'Source note',
			sourceContent: 'First paragraph\n\nSecond paragraph\n\nThird paragraph',
			stripSingleH1: true,
		});

		assert.equal(result, [
			'- Source note',
			'    First paragraph',
			'    Second paragraph',
			'    Third paragraph',
		].join('\n'));
	});

	it('removes spacer blank lines around headings and list items', () => {
		const result = buildMovedContentList({
			sourceBasename: 'Source note',
			sourceContent: '# Source note\n\n## Topic\n\nContent\n\n- First\n\n- Second',
			stripSingleH1: true,
		});

		assert.equal(result, [
			'- Source note',
			'    - Topic',
			'        Content',
			'        - First',
			'        - Second',
		].join('\n'));
	});

	it('keeps list nesting after removing blank lines between list blocks', () => {
		const result = buildMovedContentList({
			sourceBasename: 'Source note',
			sourceContent: '- Parent\n  - Child\n\n- Next',
			stripSingleH1: true,
		});

		assert.equal(result, [
			'- Source note',
			'    - Parent',
			'        - Child',
			'    - Next',
		].join('\n'));
	});

	it('preserves blank lines inside fenced code blocks', () => {
		const result = buildMovedContentList({
			sourceBasename: 'Source note',
			sourceContent: '```text\nalpha\n\nbeta\n```',
			stripSingleH1: true,
		});

		assert.equal(result, [
			'- Source note',
			'    ```text',
			'    alpha',
			'',
			'    beta',
			'    ```',
		].join('\n'));
	});
});
