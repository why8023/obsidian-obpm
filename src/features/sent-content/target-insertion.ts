export interface OffsetInsertionPlan {
	insertedText: string;
	nextContent: string;
	offset: number;
}

export interface RemovalPlan {
	end: number;
	nextContent: string;
	start: number;
}

interface BuildOffsetInsertionPlanOptions {
	block: string;
	content: string;
	insertOffset: number;
}

interface RemoveInsertedTextEntry {
	insertOffset: number;
	insertedText: string;
	targetContentAfter: string;
	targetContentBefore: string;
}

export function buildOffsetInsertionPlan(options: BuildOffsetInsertionPlanOptions): OffsetInsertionPlan {
	const offset = clamp(options.insertOffset, 0, options.content.length);
	const before = options.content.slice(0, offset);
	const after = options.content.slice(offset);
	const insertedText = `${getBlockPrefix(before)}${options.block}${getBlockSuffix(after)}`;
	return {
		insertedText,
		nextContent: `${before}${insertedText}${after}`,
		offset,
	};
}

export function removeInsertedText(
	currentContent: string,
	entry: RemoveInsertedTextEntry,
): RemovalPlan | null {
	const exactStart = entry.insertOffset;
	const exactEnd = exactStart + entry.insertedText.length;
	if (currentContent.slice(exactStart, exactEnd) === entry.insertedText) {
		return {
			end: exactEnd,
			nextContent: currentContent.slice(0, exactStart) + currentContent.slice(exactEnd),
			start: exactStart,
		};
	}

	if (currentContent === entry.targetContentAfter) {
		return {
			end: exactEnd,
			nextContent: entry.targetContentBefore,
			start: exactStart,
		};
	}

	const singleOccurrenceStart = findSingleOccurrence(currentContent, entry.insertedText);
	if (singleOccurrenceStart !== null) {
		const singleOccurrenceEnd = singleOccurrenceStart + entry.insertedText.length;
		return {
			end: singleOccurrenceEnd,
			nextContent: currentContent.slice(0, singleOccurrenceStart) + currentContent.slice(singleOccurrenceEnd),
			start: singleOccurrenceStart,
		};
	}

	return null;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function findSingleOccurrence(content: string, value: string): number | null {
	const firstIndex = content.indexOf(value);
	if (firstIndex < 0) {
		return null;
	}

	return content.indexOf(value, firstIndex + value.length) < 0 ? firstIndex : null;
}

function getBlockPrefix(contentBefore: string): string {
	if (contentBefore.length === 0) {
		return '';
	}

	if (/\n[ \t]*\n[ \t]*$/.test(contentBefore)) {
		return '';
	}

	return contentBefore.endsWith('\n') ? '\n' : '\n\n';
}

function getBlockSuffix(contentAfter: string): string {
	if (contentAfter.length === 0) {
		return '';
	}

	if (contentAfter.startsWith('\n\n')) {
		return '';
	}

	return contentAfter.startsWith('\n') ? '\n' : '\n\n';
}
