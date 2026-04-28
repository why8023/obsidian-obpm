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
					includeRules: [{key: 'kind', matchMode: 'key-value-equals', value: 'task'}],
				},
			),
			'process',
		);
		assert.equal(
			getPinnedProjectRuleDecision(
				{frontmatter: {kind: 'reference'}} as CachedMetadata,
				{
					excludeRules: [],
					includeRules: [{key: 'kind', matchMode: 'key-value-equals', value: 'task'}],
				},
			),
			'skip',
		);
	});

	it('lets exclude rules override include rules', () => {
		assert.equal(
			getPinnedProjectRuleDecision(
				{frontmatter: {kind: 'task', skip_pin: true}} as CachedMetadata,
				{
					excludeRules: [{key: 'skip_pin', matchMode: 'key-exists'}],
					includeRules: [{key: 'kind', matchMode: 'key-value-equals', value: 'task'}],
				},
			),
			'skip',
		);
	});

	it('waits for metadata when rules are configured', () => {
		assert.equal(
			getPinnedProjectRuleDecision(null, {
				excludeRules: [{key: 'skip_pin', matchMode: 'key-exists'}],
				includeRules: [],
			}),
			'defer',
		);
	});
});
