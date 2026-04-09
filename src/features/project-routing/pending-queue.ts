interface PendingQueueEntry {
	attemptCount: number;
	createdAt: number;
	nextAttemptAt: number;
	path: string;
}

const RETRY_DELAYS_MS = [150, 400, 800, 1500, 3000, 5000, 10000];

export class PendingProjectRoutingQueue {
	private readonly entries = new Map<string, PendingQueueEntry>();

	add(path: string, now = Date.now()): void {
		if (!path) {
			return;
		}

		const existingEntry = this.entries.get(path);
		if (existingEntry) {
			existingEntry.nextAttemptAt = now;
			return;
		}

		this.entries.set(path, {
			attemptCount: 0,
			createdAt: now,
			nextAttemptAt: now,
			path,
		});
	}

	clear(): void {
		this.entries.clear();
	}

	defer(path: string, now = Date.now()): number | null {
		const entry = this.entries.get(path);
		if (!entry) {
			return null;
		}

		entry.attemptCount += 1;
		const delayMs = getRetryDelayMs(entry.attemptCount);
		entry.nextAttemptAt = now + delayMs;
		return delayMs;
	}

	getDuePaths(now = Date.now()): string[] {
		return [...this.entries.values()]
			.filter((entry) => entry.nextAttemptAt <= now)
			.sort((left, right) => left.nextAttemptAt - right.nextAttemptAt)
			.map((entry) => entry.path);
	}

	getNextDelay(now = Date.now()): number | null {
		let nextAttemptAt: number | null = null;
		for (const entry of this.entries.values()) {
			if (nextAttemptAt === null || entry.nextAttemptAt < nextAttemptAt) {
				nextAttemptAt = entry.nextAttemptAt;
			}
		}

		if (nextAttemptAt === null) {
			return null;
		}

		return Math.max(nextAttemptAt - now, 0);
	}

	has(path: string): boolean {
		return this.entries.has(path);
	}

	isExpired(path: string, maxAgeMs: number, now = Date.now()): boolean {
		const entry = this.entries.get(path);
		if (!entry) {
			return false;
		}

		return now - entry.createdAt > maxAgeMs;
	}

	markReadyForImmediateRetry(path: string, now = Date.now()): void {
		const entry = this.entries.get(path);
		if (!entry) {
			return;
		}

		entry.nextAttemptAt = now;
	}

	remove(path: string): void {
		this.entries.delete(path);
	}

	rename(oldPath: string, newPath: string): void {
		if (!oldPath || !newPath || oldPath === newPath) {
			return;
		}

		const existingEntry = this.entries.get(oldPath);
		if (!existingEntry) {
			return;
		}

		this.entries.delete(oldPath);

		const nextEntry = this.entries.get(newPath);
		if (nextEntry) {
			nextEntry.attemptCount = Math.max(nextEntry.attemptCount, existingEntry.attemptCount);
			nextEntry.createdAt = Math.min(nextEntry.createdAt, existingEntry.createdAt);
			nextEntry.nextAttemptAt = Math.min(nextEntry.nextAttemptAt, existingEntry.nextAttemptAt);
			return;
		}

		this.entries.set(newPath, {
			...existingEntry,
			path: newPath,
		});
	}

	size(): number {
		return this.entries.size;
	}
}

function getRetryDelayMs(attemptCount: number): number {
	const delayMs = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)];
	return delayMs ?? RETRY_DELAYS_MS[0] ?? 1000;
}
