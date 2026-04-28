import {spawn} from 'node:child_process';
import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import esbuild from 'esbuild';

const testFilePattern = /\.test\.ts$/;

async function findTestFiles(directory) {
	const entries = await readdir(directory, {withFileTypes: true});
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...await findTestFiles(entryPath));
			continue;
		}

		if (entry.isFile() && testFilePattern.test(entry.name)) {
			files.push(entryPath);
		}
	}

	return files.sort((left, right) => left.localeCompare(right));
}

function runNodeTest(files) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ['--test', ...files], {
			stdio: 'inherit',
		});

		child.on('error', reject);
		child.on('exit', (code) => {
			resolve(code ?? 1);
		});
	});
}

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'src');
const testFiles = await findTestFiles(sourceRoot);

if (testFiles.length === 0) {
	console.log('No test files found.');
	process.exit(0);
}

const outputDirectory = await mkdtemp(path.join(tmpdir(), 'obpm-tests-'));

try {
	await esbuild.build({
		bundle: true,
		entryNames: '[dir]/[name]',
		entryPoints: testFiles,
		external: ['obsidian'],
		format: 'esm',
		logLevel: 'silent',
		outbase: sourceRoot,
		outdir: outputDirectory,
		platform: 'node',
		sourcemap: 'inline',
		target: 'node18',
	});

	const builtTestFiles = testFiles.map((file) => {
		const relativePath = path.relative(sourceRoot, file);
		return path.join(outputDirectory, relativePath).replace(/\.ts$/, '.js');
	});
	const exitCode = await runNodeTest(builtTestFiles);
	process.exitCode = exitCode;
} finally {
	await rm(outputDirectory, {force: true, recursive: true});
}
