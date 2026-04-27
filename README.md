# OBPM

OBPM is an Obsidian community plugin that bundles several workflow improvements for native Bases views and markdown note maintenance.

## Features

- Bases file reveal: Hold `Alt` and click a row or file link in a native Bases table view to reveal that file in the file explorer.
- Bases top tabs: Show always-visible tabs for the views defined in a `.base` file, with support for reordering, pinning, renaming, duplication, overflow handling, and restoring the last active view.
- Bases group fold: Add collapse and expand controls to grouped native Bases table views and optionally remember the collapsed state per file and view.
- Related frontmatter links: Keep backlinks in sync by inserting managed markdown links into the notes referenced by a frontmatter property, with optional project-link relation recognition.
- File name sync: Rename markdown files to match a frontmatter property, with configurable invalid-character replacement and basename length limits.
- Related document workflow: Run a command to move documents associated with project files into a configured project subfolder.
- Same-folder note: Add a file-menu action that creates a new markdown note next to the selected file.

## Requirements

- Obsidian with community plugins enabled.
- Bases-related features require native Bases support and `.base` files in the vault.
- Release artifacts must be available at the plugin root: `main.js`, `manifest.json`, and `styles.css`.

## Development

This project uses TypeScript, npm, and esbuild.

1. Install the pinned Node.js toolchain if you use `mise`:

```bash
mise install
```

2. Install dependencies:

```bash
npm install
```

3. Start watch mode during development:

```bash
npm run dev
```

4. Create a production build:

```bash
npm run build
```

5. Run lint checks:

```bash
npm run lint
```

## Manual testing

1. Build the plugin.
2. Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<Vault>/.obsidian/plugins/obsidian-obpm/
```

3. Reload Obsidian.
4. Enable the plugin in **Settings → Community plugins**.

## Settings overview

- **Bases file reveal** enables `Alt`+click reveal behavior from Bases rows into the file explorer.
- **Bases group fold** controls grouped Bases table folding behavior and state persistence.
- **Bases top tabs** controls tab placement, layout, icon display, overflow behavior, and remembered view state.
- **Relations** configures the source relation property, optional display property, project Markdown link recognition, and verbose logging.
- **File names from property** configures the property used for renaming plus file-name sanitization rules.
- **Related document workflow** configures the command that moves project-related documents into a project subfolder.
- **Create note in same folder** enables the context-menu command for creating adjacent notes.

## Release workflow

1. Update the plugin version with `npm version patch`, `npm version minor`, or `npm version major`.
2. Verify release metadata:

```bash
npm run release:check
```

3. Build the release bundle:

```bash
npm run build
```

4. Publish a GitHub release whose tag exactly matches `manifest.json` without a leading `v`.
5. Upload `manifest.json`, `main.js`, and `styles.css` as release assets.
