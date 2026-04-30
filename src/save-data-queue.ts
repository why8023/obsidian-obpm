export class SaveDataQueue<T> {
	private pendingSave: Promise<void> = Promise.resolve();

	constructor(private readonly saveData: (snapshot: T) => Promise<void>) {}

	enqueue(createSnapshot: () => T): Promise<void> {
		const nextSave = this.pendingSave
			.catch(() => undefined)
			.then(() => this.saveData(createSnapshot()));
		this.pendingSave = nextSave;
		return nextSave;
	}
}
