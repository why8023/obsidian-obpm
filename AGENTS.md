# OBPM agent instructions

## Project snapshot

- This repository is an Obsidian community plugin named `obsidian-obpm`.
- Runtime entry point: `src/main.ts`, bundled by esbuild into root-level `main.js`.
- Source code lives under `src/`; feature code is grouped under `src/features/<feature-name>/`.
- Release artifacts expected by Obsidian: `main.js`, `manifest.json`, and `styles.css`.
- The plugin is developed directly inside an Obsidian vault plugin folder. A production or watch build writes `main.js` in this directory, so Obsidian can load it in place.

## Current feature areas

Keep feature-specific changes close to the owning module:

- `bases-file-reveal`: Alt-click reveal behavior for native Bases rows and file links.
- `bases-top-tabs`: visible top tabs for views declared in `.base` files.
- `bases-group-fold`: collapse and expand controls for grouped native Bases table views.
- `related-links`: managed related frontmatter backlinks.
- `file-name-sync`: rename markdown files from a configured frontmatter property.
- `frontmatter-automation`: actions driven by project/frontmatter metadata.
- `project-routing`: route files into project folders.
- `project-folder`: project folder commands, sync, and rename behavior.
- `pinned-project`: pin one relation target and link matching new files to it.
- `related-document-workflow`: move project-related documents and support undo.
- `same-folder-note`: file-menu action for creating notes beside the selected file.
- `file-content-move`: move selected note content into another file.

## Tooling

- Package manager: npm. Do not switch this project to pnpm, yarn, or bun.
- Node.js: use the project toolchain when available (`mise.toml` is present); otherwise use current LTS compatible with Node 18+.
- Bundler: esbuild through `esbuild.config.mjs`.
- TypeScript is compiled with strict settings from `tsconfig.json`.
- Linting uses ESLint 9 with `eslint-plugin-obsidianmd`.

Common commands:

```bash
npm install
npm run dev
npm run build
npm run test
npm run lint
npm run release:check
```

Use `npm run build` before considering a TypeScript or release-artifact change complete. Run `npm run test` for logic changes and `npm run lint` when editing TypeScript broadly or touching style-sensitive code.

## Repository boundaries

- Treat `src/`, `styles.css`, `manifest.json`, `versions.json`, `package.json`, `package-lock.json`, scripts, tests, and docs as source-controlled project files.
- Treat `main.js` as generated release output. It is ignored by Git and should not be hand-edited.
- Treat `data.json` as local Obsidian plugin state. Do not edit it unless the user explicitly asks for a local-state migration or investigation.
- Do not edit `node_modules/`.
- Do not edit `refer/` unless the user explicitly asks. It is reference material and is ignored by linting.
- The `.codex/` directory is local agent configuration; do not change it unless the user explicitly asks.

## Architecture rules

- Keep `src/main.ts` focused on lifecycle, feature construction, command registration, settings loading, and persistence orchestration.
- Implement feature behavior in the relevant `src/features/<feature-name>/` folder. Add new folders for new features instead of growing unrelated modules.
- Features that need Obsidian lifecycle cleanup should be `Component`-style classes and be registered with `plugin.addChild(...)`.
- Keep DOM querying and native Bases DOM assumptions inside dedicated adapters/controllers where possible.
- Prefer small modules with a single responsibility. Split files once a file is becoming difficult to scan or mixes unrelated concerns.
- Reuse existing shared utilities before adding new ones:
  - `FileMoveCoordinator` for coordinated vault file moves.
  - `SaveDataQueue` for serialized plugin data writes.
  - settings normalization helpers in `src/settings.ts`.
  - feature-specific localization modules for user-facing strings.
- Avoid broad refactors while fixing or extending one feature.

## Obsidian API conventions

- Use Obsidian APIs (`this.app.vault`, `this.app.fileManager`, `metadataCache`, `workspace`, `Component`, `TFile`, `TFolder`) instead of direct filesystem access for vault content.
- Register cleanup through Obsidian helpers:
  - `this.registerEvent(...)`
  - `this.registerDomEvent(...)`
  - `this.registerInterval(...)`
  - `plugin.addChild(...)`
- Do not leave global event listeners, observers, intervals, or DOM mutations without an unload path.
- Keep the plugin mobile-compatible unless a feature is explicitly desktop-only. `manifest.json` currently has `"isDesktopOnly": false`.
- Avoid Node/Electron APIs in runtime plugin code. Build scripts may use Node APIs.
- Keep startup light. Defer vault scans, DOM observers, and expensive work until the feature is enabled and the relevant view/event exists.

## Settings and persistence

- Load persisted data with `loadData()` and normalize it before use.
- Save through existing plugin save helpers rather than calling `saveData()` from scattered feature code.
- When adding settings:
  - update the settings type and defaults in `src/settings.ts`;
  - add normalization for old or invalid persisted values;
  - add UI in the relevant settings module or `src/settings-ui/`;
  - add localization strings where the feature already uses localization;
  - refresh only affected features through `RefreshableFeatureId` where possible.
- Preserve backward compatibility with existing `data.json` shapes. Unknown or malformed saved values should fall back to defaults, not crash plugin load.

## Commands and user-facing text

- Register user-facing commands through `this.addCommand(...)` or the owning feature's lifecycle.
- Command IDs are stable public identifiers. Do not rename existing IDs unless the user explicitly accepts the compatibility break.
- Use short sentence-case command names, setting labels, notices, and button text.
- Keep copy concrete and action-oriented. Avoid implementation jargon in UI strings.
- For Obsidian UI paths in docs or copy, use `Settings -> Community plugins`.

## Bases and DOM behavior

Native Bases UI is not a stable public API, so DOM behavior needs extra care:

- Scope selectors to the active view/container whenever possible.
- Isolate class names, attribute assumptions, and mutation-observer logic inside DOM adapter files.
- Make refresh/re-render paths idempotent. Running a refresh twice should not duplicate controls, listeners, or state.
- Debounce or batch expensive work caused by DOM mutations.
- Prefer feature-specific CSS class prefixes such as `obpm-...` to avoid collisions with Obsidian or other plugins.
- Keep keyboard/mouse modifiers explicit and documented in user-facing feature descriptions when behavior depends on them.

## Privacy and security

- Default to local/offline behavior.
- Do not add telemetry, analytics, remote logging, remote code loading, or hidden network requests.
- If a network call is essential, require explicit user-facing opt-in and document what data leaves the vault.
- Never execute fetched code or auto-update plugin code outside normal Obsidian release artifacts.
- Do not read or write outside the vault in runtime plugin code.
- Minimize vault access. Do not scan the entire vault when the same result can be derived from metadata, events, or a targeted path.

## Dependencies

- Keep runtime dependencies small, browser-compatible, and bundleable.
- Before adding a dependency, check whether the Obsidian API, TypeScript standard library, or existing project code already covers the need.
- Do not add packages that require unbundled runtime files, native modules, or server-side APIs.
- `obsidian`, Electron, CodeMirror, Lezer, and Node built-ins are externalized in `esbuild.config.mjs`; most other runtime dependencies should bundle into `main.js`.

## Style and TypeScript

- Follow `.editorconfig`: UTF-8, LF, final newline, tabs for indentation.
- Use TypeScript strictness rather than suppressions. Avoid `any`; prefer `unknown` plus narrowing.
- Prefer `async`/`await` over promise chains.
- Handle errors gracefully in user-triggered flows. Use `Notice` only when the user needs immediate feedback.
- Keep tests deterministic and independent of a real Obsidian app unless a manual check is explicitly required.
- Do not add comments that merely restate code. Add comments only to explain non-obvious Obsidian DOM assumptions, compatibility constraints, or tricky migrations.

## Tests

- Unit tests are co-located under `src/` as `*.test.ts`.
- `npm run test` bundles tests with esbuild and runs Node's built-in test runner.
- Prefer testing pure logic, adapters, planners, normalizers, file-move decisions, and state transitions.
- For Obsidian-dependent behavior, inject small interfaces or fake adapters rather than requiring a real Obsidian runtime.
- When fixing a bug, add or update a focused regression test when practical.

## CSS

- Runtime styles live in root-level `styles.css`.
- Keep selectors feature-scoped with `obpm-...` classes.
- Avoid styling broad Obsidian selectors directly unless the behavior cannot work otherwise.
- Do not make layout assumptions that only hold for one theme. Test against light/dark theme expectations where possible.
- If a feature injects DOM controls, ensure CSS does not break when controls are rendered more than once during refresh.

## Release and versioning

- Version is shared across `package.json`, `manifest.json`, and `versions.json`.
- Use `npm version patch`, `npm version minor`, or `npm version major` to bump versions. The package `version` script updates `manifest.json` and stages `manifest.json` plus `versions.json`.
- Run `npm run release:check` before a release. It verifies:
  - release tag is SemVer without a leading `v`;
  - `package.json` and `manifest.json` versions match;
  - `versions.json` maps the release version to `manifest.minAppVersion`.
- GitHub release tags must exactly match the manifest version, for example `0.0.35`, not `v0.0.35`.
- Attach `manifest.json`, `main.js`, and `styles.css` as individual release assets.
- Do not change `manifest.json` `id` after release.

## Manual verification

After changes that affect runtime behavior:

1. Run the relevant automated checks.
2. Build with `npm run build`.
3. Reload Obsidian.
4. Enable or refresh OBPM under `Settings -> Community plugins`.
5. Manually exercise the changed feature in a representative vault note or `.base` file.

For Bases features, verify at least one native Bases table view. For file-moving or link-writing features, test on disposable notes first and confirm paths/frontmatter/links are correct.

## Agent workflow

- Read the owning feature module before editing. Let existing feature patterns guide the change.
- Check `git status --short` before and after work. Do not revert unrelated user changes.
- Keep edits narrow. Avoid formatting churn in files unrelated to the task.
- Prefer `rg` for searching.
- Use `apply_patch` for manual edits.
- Do not hand-edit generated `main.js`; run the build if a generated artifact is needed locally.
- Report which checks were run and whether any were skipped.

## Common change checklist

When adding or changing a feature:

1. Put runtime logic under the owning `src/features/<feature-name>/` folder.
2. Add or update settings defaults, normalization, UI, and localization.
3. Register lifecycle cleanup through `Component` or `register*` helpers.
4. Add or update focused tests for pure logic.
5. Run `npm run test`, `npm run lint`, and `npm run build` as appropriate.

When changing release metadata:

1. Keep `package.json`, `manifest.json`, and `versions.json` in sync.
2. Run `npm run release:check`.
3. Build release artifacts with `npm run build`.
