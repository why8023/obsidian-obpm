export interface SourceContribution {
	displayText: string;
	sourcePath: string;
	targetPaths: string[];
}

export interface DesiredTargetLink {
	displayText: string;
	sourcePath: string;
}

export interface DesiredTargetLinkNode extends DesiredTargetLink {
	children: DesiredTargetLinkNode[];
}

export type DesiredLinksByTarget = Map<string, Map<string, DesiredTargetLink>>;
export type DesiredLinkTreesByTarget = Map<string, DesiredTargetLinkNode[]>;

export const RELATED_LINKS_STATE_VERSION = 1;

export interface RelatedLinksState {
	version: typeof RELATED_LINKS_STATE_VERSION;
	sourceTargetsByPath: Record<string, string[]>;
	managedTargets: string[];
	projectMarkdownLinksBySourcePath: Record<string, string[]>;
}
