# Obsidian Git Tests

This directory contains the automated test setup for Obsidian Git.

The current strategy is to keep most tests outside a real Obsidian instance.
Tests run in Node with Vitest, use a small local `obsidian` stub, and use real
temporary Git repositories when behavior depends on Git itself.

## Commands

```bash
pnpm run test
pnpm run test:watch
pnpm run test:coverage
pnpm run all
```

`pnpm run all` runs type checking, Svelte checks, formatting, linting, and the
test suite.

## Test Runner

Tests use Vitest in a Node environment.

Configuration lives in `vitest.config.ts`:

-   `tests/**/*.test.ts` files are included.
-   `tests/setup.ts` runs before tests.
-   `obsidian` imports are mapped to `tests/stubs/obsidian.ts`.
-   `src` imports are mapped to the project `src` directory.
-   Coverage uses the V8 provider.

## Obsidian Stub

`tests/stubs/obsidian.ts` provides a small test-only subset of the Obsidian API.
It should stay minimal. Add symbols only when a test needs them.

The stub is meant to make unit tests load plugin modules without launching
Obsidian. It is not a fidelity-accurate Obsidian runtime.

Prefer focused fake objects in individual tests or helpers when a module needs a
specific `app`, `vault`, `workspace`, or plugin shape.

## Global Setup

`tests/setup.ts` provides small runtime globals used by plugin code:

-   `window`
-   `activeWindow`
-   `activeDocument`
-   `Array.prototype.last`
-   `Math.clamp`

These exist because Obsidian and the plugin runtime provide them, but Node does
not.

## Shared Test Helpers

### Fake Plugin

`tests/helpers/createFakePlugin.ts` creates a small fake `ObsidianGit` object.

Use it when code needs plugin methods or Obsidian workspace events but does not
need a real plugin instance.

The fake currently provides typed spies for:

-   `app.workspace.trigger`
-   `setPluginState`
-   `log`
-   `displayError`

### Git Repo Fixture

`tests/helpers/gitRepo.ts` creates temporary Git repositories for tests.

`createRepoWithOrigin()` returns a `TestRepo` with:

-   `dir`
-   `remotePath`
-   `repoPath`
-   `raw(args)`
-   `write(filePath, content)`
-   `writeAndCommit(filePath, content, message)`
-   `appendAndCommit(filePath, content, message)`
-   `cleanup()`

Use `repo.raw([...])` for assertions where exact Git CLI semantics matter.

Use fixture methods for setup to keep tests readable.

Use `withCleanup()` from `tests/helpers/cleanup.ts` for automatic cleanup after
the current test:

```ts
const repo = withCleanup(await createRepoWithOrigin());
```

This registers the repo for automatic cleanup after the current test.

Call `repo.cleanup()` directly only when a test needs to remove the repository
before the test finishes.

### wasm-git Helpers

The `WasmGit` backend is tested against a real filesystem and a real
local Git HTTP server:

-   `tests/helpers/fsVaultAdapter.ts` implements the vault adapter surface used
    by the vault-to-MEMFS mirror on top of a temporary directory, so wasm-git
    tests exercise real file I/O.
-   `tests/helpers/gitHttpServer.ts` starts a local `git http-backend` server
    (optionally with Basic auth) so clone, fetch, pull, and push run over real
    HTTP through the plugin's `requestUrl` bridge.
-   `tests/helpers/createWasmGitPlugin.ts` builds a fake plugin wired with an
    `FsVaultAdapter`, an in-memory `localStorage`, and a `modalQueue` for
    scripting interactive prompts (credentials, selections).

`tests/helpers/gitCli.ts` runs the native `git` binary for fixture setup and
oracle assertions. The plugin itself does not use that binary.

The `obsidian` stub's `requestUrl` performs real HTTP requests via Node's
`fetch` so the wasm-git network stack is tested end to end. `vitest.config.ts`
loads `.wasm` imports as binaries and inlines the `wasm-git` package so the
loader applies.

## Design Principles

-   Prefer pure unit tests for pure logic.
-   Prefer real temporary Git repositories for Git workflow behavior.
-   Use the native `git` CLI only as a test fixture and oracle, not as the
    plugin backend.
-   Avoid launching Obsidian for the default test suite.
-   Keep the Obsidian stub minimal and test-only.
-   Keep helpers small and behavior-focused.
-   Do not overfit tests to incidental implementation details when Git can be used
    as an oracle.

## Future Test Plans

### Possible E2E Track

A future optional E2E setup could use `wdio-obsidian-service`, similar to the
Templater plugin.

Potential E2E scenarios:

-   plugin loads in Obsidian
-   commands are registered
-   source control view opens
-   changed/staged files appear in the UI
-   stage, unstage, commit, and discard flows work from the UI
-   settings persist after reload

This should be a separate command such as `pnpm run test:e2e`, not part of the
default `pnpm run test`.
