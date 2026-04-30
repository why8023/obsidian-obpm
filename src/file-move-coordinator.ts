export interface FileMoveCoordinatorOptions<TFile extends {path: string}> {
	getFileByPath: (path: string) => TFile | null;
	renameFile: (file: TFile, targetPath: string) => Promise<void>;
}

export interface FileMoveRequest<TFile extends {path: string}> {
	resolveTargetPath: (file: TFile) => Promise<string | null> | string | null;
	skipIfPathChanged?: boolean;
}

export type FileMoveResult =
	| {
		kind: 'moved';
		sourcePath: string;
		targetPath: string;
	}
	| {
		kind: 'skipped';
		reason: 'already-at-target' | 'file-missing' | 'path-changed' | 'target-path-empty';
		sourcePath: string;
		targetPath?: string;
	};

export class FileMoveCoordinator<TFile extends {path: string}> {
	private readonly latestPathByRequestedPath = new Map<string, string>();
	private moveQueue: Promise<void> = Promise.resolve();

	constructor(private readonly options: FileMoveCoordinatorOptions<TFile>) {}

	moveFile(file: TFile, request: FileMoveRequest<TFile>): Promise<FileMoveResult> {
		const requestedPath = file.path;
		const nextMove = this.moveQueue
			.catch(() => undefined)
			.then(() => this.executeMove(file, requestedPath, request));
		this.moveQueue = nextMove.then(() => undefined, () => undefined);
		return nextMove;
	}

	private async executeMove(
		file: TFile,
		requestedPath: string,
		request: FileMoveRequest<TFile>,
	): Promise<FileMoveResult> {
		const liveFile = this.resolveLiveFile(file, requestedPath);
		if (!liveFile) {
			return {
				kind: 'skipped',
				reason: 'file-missing',
				sourcePath: requestedPath,
			};
		}

		if (request.skipIfPathChanged && liveFile.path !== requestedPath) {
			return {
				kind: 'skipped',
				reason: 'path-changed',
				sourcePath: requestedPath,
			};
		}

		const targetPath = await request.resolveTargetPath(liveFile);
		if (!targetPath) {
			return {
				kind: 'skipped',
				reason: 'target-path-empty',
				sourcePath: liveFile.path,
			};
		}

		if (targetPath === liveFile.path) {
			return {
				kind: 'skipped',
				reason: 'already-at-target',
				sourcePath: liveFile.path,
				targetPath,
			};
		}

		const sourcePath = liveFile.path;
		await this.options.renameFile(liveFile, targetPath);
		this.rememberMove(requestedPath, sourcePath, targetPath);
		return {
			kind: 'moved',
			sourcePath,
			targetPath,
		};
	}

	private resolveLiveFile(file: TFile, requestedPath: string): TFile | null {
		const candidatePaths = [
			this.latestPathByRequestedPath.get(requestedPath) ?? '',
			file.path,
			requestedPath,
		].filter((path, index, paths) => path.length > 0 && paths.indexOf(path) === index);

		for (const candidatePath of candidatePaths) {
			const candidateFile = this.options.getFileByPath(candidatePath);
			if (candidateFile) {
				return candidateFile;
			}
		}

		return null;
	}

	private rememberMove(requestedPath: string, sourcePath: string, targetPath: string): void {
		this.latestPathByRequestedPath.set(requestedPath, targetPath);
		this.latestPathByRequestedPath.set(sourcePath, targetPath);
	}
}
