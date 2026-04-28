export interface RelatedDocumentWorkflowMoveRecord {
	projectPath: string;
	sourcePath: string;
	targetPath: string;
}

export interface RelatedDocumentWorkflowUndoBatch {
	createdAt: number;
	records: RelatedDocumentWorkflowMoveRecord[];
}

export function normalizeRelatedDocumentWorkflowUndoBatch(value: unknown): RelatedDocumentWorkflowUndoBatch | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
		? value.createdAt
		: Date.now();
	const records = Array.isArray(value.records)
		? value.records
			.map(normalizeMoveRecord)
			.filter((record): record is RelatedDocumentWorkflowMoveRecord => record !== null)
		: [];

	if (records.length === 0) {
		return null;
	}

	return {createdAt, records};
}

function normalizeMoveRecord(value: unknown): RelatedDocumentWorkflowMoveRecord | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const projectPath = normalizePathValue(value.projectPath);
	const sourcePath = normalizePathValue(value.sourcePath);
	const targetPath = normalizePathValue(value.targetPath);
	if (!projectPath || !sourcePath || !targetPath || sourcePath === targetPath) {
		return null;
	}

	return {projectPath, sourcePath, targetPath};
}

function normalizePathValue(value: unknown): string {
	return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
