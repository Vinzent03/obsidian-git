## Project overview

This repository contains the `obsidian-git` Obsidian community plugin. It
bundles TypeScript and Svelte source into the root-level `main.js` loaded by
Obsidian, with `manifest.json` and `styles.css` as the other release
artifacts. The plugin manages Git repositories inside an Obsidian vault,
including source control, history, diff views, automatic routines, and editor
line authoring.

The main runtime boundary is:

-   `src/main.ts` owns plugin lifecycle, settings, commands/views registration,
    refresh/reload orchestration, user-facing notices, and cleanup.
-   `src/gitManager/gitManager.ts` defines the Git capability interface.
-   `src/gitManager/wasmGit/` is the sole Git implementation, built on
    `wasm-git` (libgit2 compiled to WebAssembly) for both desktop and mobile.
    It contains the Emscripten module wrapper (`lg2.ts`), the vault-to-MEMFS
    mirror (`vaultMirror.ts`), the `requestUrl` HTTP transport bridge
    (`httpBridge.ts`), CLI output parsers (`parsers.ts`), and the `WasmGit`
    manager (`wasmGit.ts`).
-   `src/commands.ts` registers stable user-facing command IDs.
-   `src/ui/` contains source-control, history, diff, modal, and status-bar UI.
-   `src/editor/` contains CodeMirror integrations for diff signs, hunk actions,
    and line authoring.
-   `src/setting/` contains persisted settings and local-storage migrations.
-   `tests/` contains Vitest tests and Obsidian stubs/helpers.

Before changing behavior, identify whether it belongs in the shared
`GitManager` contract, both Git backends, the plugin orchestration layer, or a
specific UI/editor feature. Changes that work only with native Git are not
automatically valid on mobile.

## Environment and commands

Use Node.js `>=24` and pnpm `>=11`, as declared in `package.json`. Use pnpm,
not npm or yarn; commit changes to `pnpm-lock.yaml` when dependency versions
change. Install dependencies with:

```sh
pnpm install
```

Useful commands:

```sh
pnpm run dev          # watch and rebuild main.js with inline source maps
pnpm run build        # production bundle; writes the ignored root main.js
pnpm run tsc          # strict TypeScript check
pnpm run svelte       # Svelte type/check validation
pnpm run format       # Prettier check (does not rewrite files)
pnpm run lint         # ESLint for src, tests, and vitest.config.ts
pnpm run test         # Vitest test suite
pnpm run test:watch   # interactive Vitest watch mode
pnpm run test:coverage
pnpm run all          # tsc, Svelte, format, lint, and tests
```

The CI workflow runs the checks separately and also verifies the production
build. For a normal source change, run at least the focused tests plus
`pnpm run tsc`, `pnpm run svelte`, `pnpm run lint`, and `pnpm run format`; run
`pnpm run all` before handoff when practical. Run `pnpm run build` for changes
to bundling, dependencies, manifest/release behavior, or runtime imports.

## Source and implementation conventions

-   Use the existing double-quote and Prettier formatting style. Do not make
    unrelated formatting changes.
-   Keep command IDs stable after release. Add or change commands in
    `src/commands.ts`, and preserve their checks for active files and Git
    readiness where applicable.
-   Keep `src/main.ts` focused on lifecycle and coordination. Put Git behavior in
    the manager abstraction/backend, reusable logic in focused modules, and UI
    behavior in the relevant view/modal/component.
-   When adding a Git operation, update the abstract `GitManager` contract and
    the `WasmGit` implementation. Preserve the shared operation-state handling
    in `GitManager.withGitOperation` and make failure paths restore state.
-   Prefer `async`/`await`; surface failures through the plugin's existing
    `displayError`/`displayMessage` mechanisms. Do not silently swallow Git
    errors, authentication failures, conflicts, cancellation, or offline-mode
    transitions.
-   Use Obsidian's `registerEvent`, `registerDomEvent`, `registerInterval`, and
    view registration helpers for resources owned by the plugin. If a feature
    also creates a timer, queue task, editor extension, or status-bar element,
    clean it up in its unload path. Check both ordinary unload and settings
    reload (`unloadPlugin` followed by `init`).
-   Route serialized or competing Git actions through `PromiseQueue`; do not
    introduce concurrent mutations to the working tree, index, or repository
    state without examining the existing queueing behavior.
-   Keep filesystem paths vault/repository-relative at API boundaries where the
    existing code does so. Git repository relative paths should be contained
    within the git manager and vault relative paths should be used as in/output
    to the git manager. Avoid absolute paths, and do not reach outside the vault or
    repository for any reason.
-   Both desktop and mobile use `WasmGit`. The vault is mirrored into an
    in-memory filesystem and network traffic goes through Obsidian's
    `requestUrl`. Desktop-only leftovers (commit-message shell scripts, OS
    hostname) must stay behind `Platform.isDesktopApp`. Do not reintroduce a
    native Git binary dependency.
-   Svelte components are compiled by `esbuild-svelte` with injected CSS. Keep
    component state and event handlers local where possible, and coordinate with
    their owning TypeScript view through the established props/events rather than
    reaching into unrelated plugin state.

## Testing

Tests run in the Node environment with Vitest. `vitest.config.ts` aliases
`obsidian` to `tests/stubs/obsidian.ts` and `src` to the source directory, and
loads `tests/setup.ts` for every test file. Refer to tests/README.md for details.
