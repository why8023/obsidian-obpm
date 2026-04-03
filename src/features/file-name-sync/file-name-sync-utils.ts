import {FrontMatterCache} from 'obsidian';

export const DEFAULT_FILE_NAME_MAX_LENGTH = 50;
export const MIN_FILE_NAME_MAX_LENGTH = 10;
export const MAX_FILE_NAME_MAX_LENGTH = 240;

const TRAILING_FILE_NAME_CHARACTER_PATTERN = /[. ]+$/g;
const RESERVED_FILE_NAME_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const INVALID_FILE_NAME_CHARACTERS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

export interface FileNameSanitizationOptions {
	invalidCharacterReplacement: string;
	maxLength: number;
}

export function getFileNamePropertyValue(frontmatter: FrontMatterCache | undefined, property: string): string | null {
	if (!property || !frontmatter || !(property in frontmatter)) {
		return null;
	}

	const values = flattenFrontmatterValues(frontmatter[property as keyof FrontMatterCache]);
	for (const value of values) {
		const normalizedValue = value.trim();
		if (normalizedValue) {
			return normalizedValue;
		}
	}

	return null;
}

export function sanitizeFileBasename(value: string, options: FileNameSanitizationOptions): string | null {
	const invalidCharacterReplacement = normalizeInvalidCharacterReplacement(options.invalidCharacterReplacement, '');
	const maxLength = normalizeFileNameMaxLength(options.maxLength);

	let normalizedValue = replaceInvalidFileNameCharacters(value, invalidCharacterReplacement).trim();
	normalizedValue = trimTrailingUnsafeCharacters(normalizedValue);

	if (!normalizedValue) {
		return null;
	}

	normalizedValue = truncateToLength(normalizedValue, maxLength);
	normalizedValue = trimTrailingUnsafeCharacters(normalizedValue);
	normalizedValue = ensureNotReservedFileName(normalizedValue, invalidCharacterReplacement, maxLength);
	normalizedValue = truncateToLength(normalizedValue, maxLength);
	normalizedValue = trimTrailingUnsafeCharacters(normalizedValue);

	if (!normalizedValue || normalizedValue === '.' || normalizedValue === '..' || RESERVED_FILE_NAME_PATTERN.test(normalizedValue)) {
		return null;
	}

	return normalizedValue;
}

export function normalizeInvalidCharacterReplacement(value: unknown, fallback = '_'): string {
	if (typeof value !== 'string') {
		return fallback;
	}

	return removeInvalidFileNameCharacters(value);
}

export function normalizeFileNameMaxLength(value: unknown, fallback = DEFAULT_FILE_NAME_MAX_LENGTH): number {
	const numericValue = typeof value === 'string' ? Number(value) : value;
	if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
		return fallback;
	}

	const roundedValue = Math.round(numericValue);
	if (roundedValue < MIN_FILE_NAME_MAX_LENGTH) {
		return MIN_FILE_NAME_MAX_LENGTH;
	}

	if (roundedValue > MAX_FILE_NAME_MAX_LENGTH) {
		return MAX_FILE_NAME_MAX_LENGTH;
	}

	return roundedValue;
}

function flattenFrontmatterValues(value: unknown): string[] {
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return [String(value)];
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) => flattenFrontmatterValues(item));
	}

	return [];
}

function trimTrailingUnsafeCharacters(value: string): string {
	return value.replace(TRAILING_FILE_NAME_CHARACTER_PATTERN, '');
}

function replaceInvalidFileNameCharacters(value: string, replacement: string): string {
	return [...value]
		.map((character) => isInvalidFileNameCharacter(character) ? replacement : character)
		.join('');
}

function removeInvalidFileNameCharacters(value: string): string {
	return [...value]
		.filter((character) => !isInvalidFileNameCharacter(character))
		.join('');
}

function isInvalidFileNameCharacter(character: string): boolean {
	return INVALID_FILE_NAME_CHARACTERS.has(character) || isFileNameControlCharacter(character);
}

function isFileNameControlCharacter(character: string): boolean {
	const codePoint = character.codePointAt(0);
	return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7F);
}

function ensureNotReservedFileName(value: string, invalidCharacterReplacement: string, maxLength: number): string {
	if (!RESERVED_FILE_NAME_PATTERN.test(value)) {
		return value;
	}

	const safeSuffix = trimTrailingUnsafeCharacters(invalidCharacterReplacement) || '_';
	const availableLength = Math.max(maxLength - [...safeSuffix].length, 0);
	const baseValue = availableLength > 0 ? truncateToLength(value, availableLength) : '';
	return `${trimTrailingUnsafeCharacters(baseValue)}${safeSuffix}`;
}

function truncateToLength(value: string, maxLength: number): string {
	const characters = [...value];
	if (characters.length <= maxLength) {
		return value;
	}

	return characters.slice(0, maxLength).join('');
}
