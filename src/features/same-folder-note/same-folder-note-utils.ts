import {normalizePath, TFile, Vault} from 'obsidian';

const RESERVED_FILE_NAME_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const INVALID_FILE_NAME_CHARACTERS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

export type SameFolderNoteNameIssue =
	| 'contains-invalid-character'
	| 'contains-path-separator'
	| 'empty'
	| 'reserved-name'
	| 'trailing-period';

export function normalizeRequestedMarkdownBasename(value: string): string {
	const trimmedValue = value.trim();
	if (trimmedValue.toLowerCase().endsWith('.md')) {
		return trimmedValue.slice(0, -3).trim();
	}

	return trimmedValue;
}

export function validateRequestedMarkdownBasename(value: string): SameFolderNoteNameIssue | null {
	const normalizedValue = normalizeRequestedMarkdownBasename(value);
	if (!normalizedValue) {
		return 'empty';
	}

	if (normalizedValue.includes('/') || normalizedValue.includes('\\')) {
		return 'contains-path-separator';
	}

	if (normalizedValue.endsWith('.')) {
		return 'trailing-period';
	}

	if ([...normalizedValue].some((character) => isInvalidFileNameCharacter(character))) {
		return 'contains-invalid-character';
	}

	if (normalizedValue === '.' || normalizedValue === '..' || RESERVED_FILE_NAME_PATTERN.test(normalizedValue)) {
		return 'reserved-name';
	}

	return null;
}

export function buildSiblingMarkdownPath(referenceFile: TFile, basename: string): string {
	const normalizedBasename = normalizeRequestedMarkdownBasename(basename);
	const fileName = `${normalizedBasename}.md`;
	const parentPath = referenceFile.parent?.path ?? '';
	return parentPath ? normalizePath(`${parentPath}/${fileName}`) : fileName;
}

export function findAvailableSiblingMarkdownBasename(vault: Vault, referenceFile: TFile, baseName: string): string {
	const normalizedBaseName = normalizeRequestedMarkdownBasename(baseName) || 'Untitled';

	for (let index = 0; index < 10_000; index += 1) {
		const candidateName = index === 0 ? normalizedBaseName : `${normalizedBaseName} ${index}`;
		const candidatePath = buildSiblingMarkdownPath(referenceFile, candidateName);
		if (!vault.getAbstractFileByPath(candidatePath)) {
			return candidateName;
		}
	}

	return `${normalizedBaseName} ${Date.now()}`;
}

function isInvalidFileNameCharacter(character: string): boolean {
	return INVALID_FILE_NAME_CHARACTERS.has(character) || isControlCharacter(character);
}

function isControlCharacter(character: string): boolean {
	const codePoint = character.codePointAt(0);
	return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7F);
}
