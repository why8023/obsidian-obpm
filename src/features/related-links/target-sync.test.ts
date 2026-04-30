/* eslint-disable import/no-nodejs-modules, obsidianmd/no-tfile-tfolder-cast */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {TFile} from 'obsidian';
import {syncManagedLinksInContent} from './target-sync';
import type {DesiredTargetLink} from './types';

function fakeFile(path: string): TFile {
	const name = path.slice(path.lastIndexOf('/') + 1);
	const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
	const basename = extension ? name.slice(0, -(extension.length + 1)) : name;

	return {
		basename,
		extension,
		name,
		path,
	} as TFile;
}

function syncContent(content: string, linkSectionHeadingLevel: number): string {
	const targetFile = fakeFile('Projects/Alpha.md');
	const sourceFile = fakeFile('Inbox/Task.md');
	const desiredLinks = new Map<string, DesiredTargetLink>([
		[
			sourceFile.path,
			{
				displayText: 'Task',
				sourcePath: sourceFile.path,
			},
		],
	]);

	return syncManagedLinksInContent(content, {
		desiredLinks,
		linkSectionHeading: 'Related',
		linkSectionHeadingLevel,
		resolveManagedSourcePath: () => sourceFile.path,
		resolveSourceFile: (sourcePath) => sourcePath === sourceFile.path ? sourceFile : null,
		targetFile,
	}).content;
}

describe('target related-link sync', () => {
	it('creates missing related links under the configured heading level', () => {
		const content = syncContent('# Alpha\n\nOverview\n', 3);

		assert.match(content, /^# Alpha\n\nOverview\n\n### Related\n- \[Task\]\(\.\.\/Inbox\/Task\.md "obpm:related-link:v1"\)\n$/);
	});

	it('uses an existing link section only when the configured heading level matches', () => {
		const content = syncContent('# Alpha\n\n## Related\nKeep this section.\n\n### Related\nExisting notes.\n', 3);

		assert.match(content, /## Related\nKeep this section\.\n\n### Related\nExisting notes\.\n\n- \[Task\]\(\.\.\/Inbox\/Task\.md "obpm:related-link:v1"\)\n$/);
	});
});
