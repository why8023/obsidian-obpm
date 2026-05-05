import {OffsetInsertionPlan} from './target-insertion';

export interface SentContentTransactionRecord {
	insertOffset: number;
	insertedText: string;
	sourceContent: string;
	sourcePath: string;
	targetContentAfter: string;
	targetContentBefore: string;
	targetPath: string;
}

interface BuildInsertionPlanOptions {
	sourceContent: string;
	targetContentBefore: string;
}

interface SendContentToTargetOptions {
	buildInsertionPlan: (options: BuildInsertionPlanOptions) => OffsetInsertionPlan;
	readSourceContent: () => Promise<string>;
	readTargetContent: () => Promise<string>;
	rollbackTargetContent: (record: SentContentTransactionRecord) => Promise<void>;
	sourcePath: string;
	targetPath: string;
	trashSource: () => Promise<void>;
	writeTargetContent: (nextContent: string, plan: OffsetInsertionPlan) => Promise<string>;
}

export async function sendContentToTarget(
	options: SendContentToTargetOptions,
): Promise<SentContentTransactionRecord> {
	const sourceContent = await options.readSourceContent();
	const targetContentBefore = await options.readTargetContent();
	const insertionPlan = options.buildInsertionPlan({
		sourceContent,
		targetContentBefore,
	});
	let transactionRecord: SentContentTransactionRecord | null = null;

	try {
		const targetContentAfter = await options.writeTargetContent(insertionPlan.nextContent, insertionPlan);
		transactionRecord = {
			insertOffset: insertionPlan.offset,
			insertedText: insertionPlan.insertedText,
			sourceContent,
			sourcePath: options.sourcePath,
			targetContentAfter,
			targetContentBefore,
			targetPath: options.targetPath,
		};
		await options.trashSource();
		return transactionRecord;
	} catch (error) {
		if (transactionRecord) {
			await options.rollbackTargetContent(transactionRecord);
		}

		throw error;
	}
}
