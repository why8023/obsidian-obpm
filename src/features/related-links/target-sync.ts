import {TFile} from 'obsidian';
import {buildManagedMarkdownLink, buildRelativeMarkdownDestination, extractManagedInlineLinks, ManagedInlineLink} from './managed-link-protocol';
import {DesiredTargetLink} from './types';

interface TargetSyncOptions {
	debugLog?: (message: string, details?: unknown) => void;
	desiredLinks: Map<string, DesiredTargetLink>;
	resolveManagedSourcePath: (link: ManagedInlineLink, targetFile: TFile) => string | null;
	resolveSourceFile: (sourcePath: string) => TFile | null;
	shouldDeferDestinationRewrite?: (targetFilePath: string, actualDestination: string, canonicalDestination: string) => boolean;
	targetFile: TFile;
}

interface TargetSyncResult {
	content: string;
	presentManagedSourcePaths: Set<string>;
}

export function syncManagedLinksInContent(content: string, options: TargetSyncOptions): TargetSyncResult {
	const presentManagedSourcePaths = new Set<string>();
	const managedLinks = extractManagedInlineLinks(content);
	let nextContent = '';
	let lastIndex = 0;
	let hasRemovedLinks = false;
	let hasUpdatedLinks = false;

	for (const managedLink of managedLinks) {
		nextContent += content.slice(lastIndex, managedLink.start);
		lastIndex = managedLink.end;

		const sourcePath = options.resolveManagedSourcePath(managedLink, options.targetFile);
		if (!sourcePath) {
			hasRemovedLinks = true;
			options.debugLog?.('Removed managed link because its source path could not be resolved.', {
				link: managedLink.fullMatch,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		const desiredLink = options.desiredLinks.get(sourcePath);
		if (!desiredLink) {
			hasRemovedLinks = true;
			options.debugLog?.('Removed managed link because the relation no longer exists.', {
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		if (presentManagedSourcePaths.has(sourcePath)) {
			hasRemovedLinks = true;
			options.debugLog?.('Removed duplicate managed link while keeping the first occurrence.', {
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		const sourceFile = options.resolveSourceFile(sourcePath);
		if (!sourceFile) {
			hasRemovedLinks = true;
			options.debugLog?.('Removed managed link because the source file no longer exists.', {
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		presentManagedSourcePaths.add(sourcePath);
		const canonicalDestination = buildRelativeMarkdownDestination(sourceFile, options.targetFile);
		if (options.shouldDeferDestinationRewrite?.(
			options.targetFile.path,
			managedLink.destination,
			canonicalDestination,
		)) {
			nextContent += managedLink.fullMatch;
			options.debugLog?.('Deferred destination rewrite for a managed link.', {
				actualDestination: managedLink.destination,
				canonicalDestination,
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		const normalizedLink = buildManagedMarkdownLink(desiredLink.displayText, canonicalDestination);
		if (normalizedLink !== managedLink.fullMatch) {
			nextContent += normalizedLink;
			hasUpdatedLinks = true;
			options.debugLog?.('Updated managed link to canonical form.', {
				nextMatch: normalizedLink,
				previousMatch: managedLink.fullMatch,
				sourcePath,
				targetPath: options.targetFile.path,
			});
			continue;
		}

		nextContent += managedLink.fullMatch;
	}

	nextContent += managedLinks.length > 0 ? content.slice(lastIndex) : content;

	const missingLinks = [...options.desiredLinks.values()]
		.filter((link) => !presentManagedSourcePaths.has(link.sourcePath))
		.sort((left, right) => {
			const displayComparison = left.displayText.localeCompare(right.displayText);
			if (displayComparison !== 0) {
				return displayComparison;
			}

			return left.sourcePath.localeCompare(right.sourcePath);
		});

	let finalContent = hasRemovedLinks
		? normalizeContentAfterRemoval(nextContent)
		: hasUpdatedLinks
			? nextContent
			: content;

	for (const missingLink of missingLinks) {
		const sourceFile = options.resolveSourceFile(missingLink.sourcePath);
		if (!sourceFile) {
			continue;
		}

		const destination = buildRelativeMarkdownDestination(sourceFile, options.targetFile);
		const linkLine = buildManagedMarkdownLink(missingLink.displayText, destination);
		finalContent = appendLinkLine(finalContent, linkLine);
		options.debugLog?.('Appended missing managed link.', {
			destination,
			displayText: missingLink.displayText,
			sourcePath: missingLink.sourcePath,
			targetPath: options.targetFile.path,
		});
	}

	return {
		content: finalContent,
		presentManagedSourcePaths,
	};
}

function appendLinkLine(content: string, linkLine: string): string {
	const trimmedContent = content.trimEnd();
	if (!trimmedContent) {
		return `${linkLine}\n`;
	}

	return `${trimmedContent}\n\n${linkLine}\n`;
}

function normalizeContentAfterRemoval(content: string): string {
	const normalized = content
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trimEnd();

	return normalized ? `${normalized}\n` : '';
}
