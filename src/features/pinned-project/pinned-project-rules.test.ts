/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {CachedMetadata} from 'obsidian';
import {getPinnedProjectRuleDecision} from './pinned-project-rules';

describe('getPinnedProjectRuleDecision', () => {
	it('processes every new markdown file by default, even before metadata is available', () => {
		assert.equal(
			getPinnedProjectRuleDecision(null, {
				excludeRules: [],
				includeRules: [],
			}),
			'process',
		);
	});

	it('requires a matching include rule when include rules are configured', () => {
		assert.equal(
			getPinnedProjectRuleDecision(
				{frontmatter: {kind: 'task'}} as CachedMetadata,
				{
					excludeRules: [],
					includeRules: [{key: 'kind', matchMode: 'key-value-equals', source: 'frontmatter', value: 'task'}],
				},
			),
			'process',
		);
		assert.equal(
			getPinnedProjectRuleDecision(
				{frontmatter: {kind: 'reference'}} as CachedMetadata,
				{
					excludeRules: [],
					includeRules: [{key: 'kind', matchMode: 'key-value-equals', source: 'frontmatter', value: 'task'}],
				},
			),
			'skip',
		);
	});

	it('can include files by path before metadata is available', () => {
		assert.equal(
			getPinnedProjectRuleDecision(null, {
				excludeRules: [],
				filePath: '0_inbox/Capture.md',
				includeRules: [{source: 'path', matchMode: 'path-starts-with', value: '0_inbox/'}],
			}),
			'process',
		);
		assert.equal(
			getPinnedProjectRuleDecision(null, {
				excludeRules: [],
				filePath: '1_project/Alpha/Capture.md',
				includeRules: [{source: 'path', matchMode: 'path-starts-with', value: '0_inbox/'}],
			}),
			'skip',
		);
	});

	it('lets exclude rules override include rules', () => {
		assert.equal(
			getPinnedProjectRuleDecision(
				{frontmatter: {kind: 'task', skip_pin: true}} as CachedMetadata,
				{
					excludeRules: [{key: 'skip_pin', matchMode: 'key-exists', source: 'frontmatter'}],
					includeRules: [{key: 'kind', matchMode: 'key-value-equals', source: 'frontmatter', value: 'task'}],
				},
			),
			'skip',
		);
	});

	it('can exclude files by path before frontmatter rules are evaluated', () => {
		assert.equal(
			getPinnedProjectRuleDecision(null, {
				excludeRules: [{source: 'path', matchMode: 'path-glob', value: '**/archive/**'}],
				filePath: '1_project/Alpha/archive/Capture.md',
				includeRules: [{source: 'path', matchMode: 'path-contains', value: 'Alpha'}],
			}),
			'skip',
		);
	});

	it('waits for metadata when a possible frontmatter exclude rule cannot be evaluated', () => {
		assert.equal(
			getPinnedProjectRuleDecision(null, {
				excludeRules: [{source: 'frontmatter', key: 'skip_pin', matchMode: 'key-exists'}],
				filePath: '0_inbox/Capture.md',
				includeRules: [{source: 'path', matchMode: 'path-starts-with', value: '0_inbox/'}],
			}),
			'defer',
		);
	});

	it('waits for metadata when rules are configured', () => {
		assert.equal(
			getPinnedProjectRuleDecision(null, {
				excludeRules: [{key: 'skip_pin', matchMode: 'key-exists', source: 'frontmatter'}],
				includeRules: [],
			}),
			'defer',
		);
	});
});
