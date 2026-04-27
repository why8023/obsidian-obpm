import {TFile} from 'obsidian';

export type FrontmatterMatchMode = 'key-exists' | 'key-value-equals';

export interface FrontmatterMatchRule {
	key: string;
	matchMode: FrontmatterMatchMode;
	value?: string;
}

export interface CurrentFileCommandSettings {
	limitToMatchingFiles: boolean;
	matchRules: FrontmatterMatchRule[];
}

export interface ProjectRoutingSettings {
	currentFileCommand: CurrentFileCommandSettings;
	detectDuplicateProjectFiles: boolean;
	enabled: boolean;
	projectFileRules: FrontmatterMatchRule[];
	projectSubfolderPath: string;
	recognizeFilenameMatchesFolderAsProject: boolean;
	routableFileRules: FrontmatterMatchRule[];
	autoMoveWhenSingleCandidate: boolean;
	showStatusBar: boolean;
	showNoticeAfterMove: boolean;
	debugLog: boolean;
}

export interface ProjectCandidate {
	file: TFile;
	folderPath: string;
	name: string;
}

export type CurrentProjectResolution =
	| {
		kind: 'project';
		candidate: ProjectCandidate;
	}
	| {
		kind: 'ambiguous';
		candidates: ProjectCandidate[];
	}
	| {
		kind: 'none';
	};
