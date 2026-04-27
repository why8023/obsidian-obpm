import {RELATED_LINKS_STATE_VERSION, RelatedLinksState, SourceContribution} from './types';

export function buildRelatedLinksState(
	contributions: Iterable<SourceContribution>,
	projectMarkdownLinkContributions: Iterable<SourceContribution> = [],
): RelatedLinksState {
	const sourceTargetsByPath: Record<string, string[]> = {};
	const managedTargets = new Set<string>();

	for (const contribution of contributions) {
		const normalizedTargets = [...new Set(contribution.targetPaths)]
			.filter((targetPath) => targetPath.trim().length > 0)
			.sort((left, right) => left.localeCompare(right));

		if (normalizedTargets.length === 0) {
			continue;
		}

		sourceTargetsByPath[contribution.sourcePath] = normalizedTargets;
		for (const targetPath of normalizedTargets) {
			managedTargets.add(targetPath);
		}
	}

	return {
		version: RELATED_LINKS_STATE_VERSION,
		sourceTargetsByPath,
		managedTargets: [...managedTargets].sort((left, right) => left.localeCompare(right)),
		projectMarkdownLinksBySourcePath: buildSourceTargetsByPath(projectMarkdownLinkContributions),
	};
}

export function normalizeRelatedLinksState(value: unknown): RelatedLinksState {
	if (!isObjectRecord(value) || value.version !== RELATED_LINKS_STATE_VERSION) {
		return createEmptyRelatedLinksState();
	}

	const sourceTargetsByPath: Record<string, string[]> = {};
	if (isObjectRecord(value.sourceTargetsByPath)) {
		for (const [sourcePath, targets] of Object.entries(value.sourceTargetsByPath)) {
			const normalizedSourcePath = normalizeText(sourcePath);
			const normalizedTargets = normalizeStringArray(targets);
			if (!normalizedSourcePath || normalizedTargets.length === 0) {
				continue;
			}

			sourceTargetsByPath[normalizedSourcePath] = normalizedTargets;
		}
	}

	return {
		version: RELATED_LINKS_STATE_VERSION,
		sourceTargetsByPath,
		managedTargets: normalizeStringArray(value.managedTargets),
		projectMarkdownLinksBySourcePath: normalizeSourceTargetsByPath(value.projectMarkdownLinksBySourcePath),
	};
}

export function createEmptyRelatedLinksState(): RelatedLinksState {
	return {
		version: RELATED_LINKS_STATE_VERSION,
		sourceTargetsByPath: {},
		managedTargets: [],
		projectMarkdownLinksBySourcePath: {},
	};
}

function buildSourceTargetsByPath(contributions: Iterable<SourceContribution>): Record<string, string[]> {
	const sourceTargetsByPath: Record<string, string[]> = {};

	for (const contribution of contributions) {
		const normalizedTargets = normalizeStringArray(contribution.targetPaths);
		if (!normalizeText(contribution.sourcePath) || normalizedTargets.length === 0) {
			continue;
		}

		sourceTargetsByPath[contribution.sourcePath] = normalizedTargets;
	}

	return sourceTargetsByPath;
}

function normalizeSourceTargetsByPath(value: unknown): Record<string, string[]> {
	const sourceTargetsByPath: Record<string, string[]> = {};
	if (!isObjectRecord(value)) {
		return sourceTargetsByPath;
	}

	for (const [sourcePath, targets] of Object.entries(value)) {
		const normalizedSourcePath = normalizeText(sourcePath);
		const normalizedTargets = normalizeStringArray(targets);
		if (!normalizedSourcePath || normalizedTargets.length === 0) {
			continue;
		}

		sourceTargetsByPath[normalizedSourcePath] = normalizedTargets;
	}

	return sourceTargetsByPath;
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return [...new Set(value
		.filter((entry): entry is string => typeof entry === 'string')
		.map((entry) => normalizeText(entry))
		.filter((entry) => entry.length > 0))]
		.sort((left, right) => left.localeCompare(right));
}

function normalizeText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
