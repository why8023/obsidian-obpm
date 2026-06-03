interface RunCreateProjectFolderCommandOptions {
	createProject: (projectName: string) => Promise<void>;
	enqueue: (task: () => Promise<void>) => Promise<void>;
	isEnabled: () => boolean;
	onDisabled: () => void;
	openPrompt: () => Promise<string | null>;
}

export async function runCreateProjectFolderCommand(
	options: RunCreateProjectFolderCommandOptions,
): Promise<void> {
	if (!options.isEnabled()) {
		options.onDisabled();
		return;
	}

	const requestedValue = await options.openPrompt();
	if (requestedValue === null) {
		return;
	}

	await options.enqueue(async () => {
		if (!options.isEnabled()) {
			options.onDisabled();
			return;
		}

		await options.createProject(requestedValue);
	});
}
