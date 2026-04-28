/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
	buildMarkdownListItemForWikilink,
	getHeadingSectionContent,
	insertListItemIntoHeadingSection,
	wikilinkSectionContainsPath,
} from './markdown-section';

describe('buildMarkdownListItemForWikilink', () => {
	it('uses the display property as a wikilink alias', () => {
		assert.equal(
			buildMarkdownListItemForWikilink('Inbox/New task.md', 'Readable title'),
			'- [[Inbox/New task|Readable title]]',
		);
	});

	it('omits the alias when the display text is the file basename', () => {
		assert.equal(
			buildMarkdownListItemForWikilink('Inbox/New task.md', 'New task'),
			'- [[Inbox/New task]]',
		);
	});
});

describe('insertListItemIntoHeadingSection', () => {
	it('appends the link under an existing configured level-2 heading', () => {
		const content = [
			'# Project',
			'',
			'## related',
			'- [[Existing]]',
			'',
			'## Notes',
			'Body',
			'',
		].join('\n');

		const result = insertListItemIntoHeadingSection(content, 'related', '- [[Inbox/New task]]');

		assert.equal(result, [
			'# Project',
			'',
			'## related',
			'- [[Existing]]',
			'- [[Inbox/New task]]',
			'',
			'## Notes',
			'Body',
			'',
		].join('\n'));
	});

	it('creates the heading after frontmatter and before the first existing H2 inside an H1', () => {
		const content = [
			'---',
			'obpm_type: project',
			'---',
			'',
			'# Project',
			'Intro',
			'',
			'## Notes',
			'Body',
			'',
		].join('\n');

		const result = insertListItemIntoHeadingSection(content, 'related', '- [[Inbox/New task]]');

		assert.equal(result, [
			'---',
			'obpm_type: project',
			'---',
			'',
			'# Project',
			'Intro',
			'',
			'## related',
			'- [[Inbox/New task]]',
			'',
			'## Notes',
			'Body',
			'',
		].join('\n'));
	});
});

describe('wikilinkSectionContainsPath', () => {
	it('detects an existing link to the target path', () => {
		const sectionContent = getHeadingSectionContent(
			'## related\n- [[Inbox/New task|Readable title]]\n',
			'related',
		);

		assert.equal(sectionContent === null, false);
		assert.equal(wikilinkSectionContainsPath(sectionContent ?? '', 'Inbox/New task.md'), true);
	});
});
