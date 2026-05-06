/* eslint-disable import/no-nodejs-modules */
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {buildProjectFileContentWithSentContent} from './project-content-insertion';

describe('buildProjectFileContentWithSentContent', () => {
	it('creates a missing configured heading and sends the source content as a list under it', () => {
		const result = buildProjectFileContentWithSentContent({
			placement: {
				headingLevel: 2,
				mode: 'target_heading',
				targetHeading: '已完成事项',
			},
			projectContent: '# CRM系统改造\n\n项目说明',
			sourceBasename: '修复登录问题',
			sourceContent: [
				'---',
				'obpm_status: done',
				'---',
				'# 修复登录问题',
				'',
				'原因是 token 过期后没有刷新。',
				'',
				'- 已调整刷新逻辑',
			].join('\n'),
			stripSingleH1: true,
		});

		assert.equal(result, [
			'# CRM系统改造',
			'',
			'项目说明',
			'',
			'## 已完成事项',
			'',
			'- 修复登录问题',
			'    原因是 token 过期后没有刷新。',
			'    - 已调整刷新逻辑',
		].join('\n'));
	});

	it('inserts under an existing configured heading before the next peer heading', () => {
		const result = buildProjectFileContentWithSentContent({
			placement: {
				headingLevel: 2,
				mode: 'target_heading',
				targetHeading: '已完成事项',
			},
			projectContent: [
				'# CRM系统改造',
				'',
				'## 已完成事项',
				'',
				'旧内容',
				'',
				'## 风险',
				'',
				'待确认',
			].join('\n'),
			sourceBasename: '修复登录问题',
			sourceContent: '结论',
			stripSingleH1: true,
		});

		assert.equal(result, [
			'# CRM系统改造',
			'',
			'## 已完成事项',
			'',
			'旧内容',
			'',
			'- 修复登录问题',
			'    结论',
			'',
			'## 风险',
			'',
			'待确认',
		].join('\n'));
	});

	it('keeps source properties on the same line as the list root under a configured heading', () => {
		const result = buildProjectFileContentWithSentContent({
			placement: {
				headingLevel: 2,
				mode: 'target_heading',
				targetHeading: '已完成事项',
			},
			preserveSourceProperties: true,
			projectContent: [
				'# CRM系统改造',
				'',
				'## 已完成事项',
			].join('\n'),
			sourceBasename: '修复登录问题',
			sourceContent: [
				'---',
				'status: done',
				'priority: 2',
				'---',
				'结论',
			].join('\n'),
			sourceProperties: {
				status: 'done',
				priority: 2,
			},
			stripSingleH1: true,
		});

		assert.equal(result, [
			'# CRM系统改造',
			'',
			'## 已完成事项',
			'',
			'- 修复登录问题 <!-- obpm-property:{status:"done",priority:2} -->',
			'    结论',
		].join('\n'));
	});

	it('appends the source file name as a configured heading and nests source headings below it', () => {
		const result = buildProjectFileContentWithSentContent({
			placement: {
				headingLevel: 2,
				mode: 'source_name_heading',
				targetHeading: '',
			},
			projectContent: '# CRM系统改造\n\n项目说明',
			sourceBasename: '修复登录问题',
			sourceContent: [
				'# 修复登录问题',
				'',
				'## 原因',
				'',
				'原因是 token 过期后没有刷新。',
			].join('\n'),
			stripSingleH1: true,
		});

		assert.equal(result, [
			'# CRM系统改造',
			'',
			'项目说明',
			'',
			'## 修复登录问题',
			'',
			'### 原因',
			'',
			'原因是 token 过期后没有刷新。',
		].join('\n'));
	});

	it('keeps source properties on the same line as the generated source-name heading', () => {
		const result = buildProjectFileContentWithSentContent({
			placement: {
				headingLevel: 2,
				mode: 'source_name_heading',
				targetHeading: '',
			},
			preserveSourceProperties: true,
			projectContent: '# CRM系统改造',
			sourceBasename: '修复登录问题',
			sourceContent: [
				'---',
				'status: done',
				'priority: 2',
				'---',
				'结论',
			].join('\n'),
			sourceProperties: {
				status: 'done',
				priority: 2,
			},
			stripSingleH1: true,
		});

		assert.equal(result, [
			'# CRM系统改造',
			'',
			'## 修复登录问题 <!-- obpm-property:{status:"done",priority:2} -->',
			'',
			'结论',
		].join('\n'));
	});
});
