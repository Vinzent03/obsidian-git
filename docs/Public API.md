# Public API

Obsidian Git exposes a read-only file status API for other plugins. It reports
the Git state of files in the vault and never stages, commits, or modifies the
repository.

The API is available on the Obsidian Git plugin instance:

```ts
const gitPlugin = (app as any).plugins.plugins["obsidian-git"];
const api = gitPlugin?.api;

if (api?.version >= 1) {
    const status = await api.getStatus();
    // [{ path: "notes/example.md", status: "modified", ... }]
}
```

The `app.plugins` registry is an Obsidian internal API, so guard access to it
and degrade gracefully when the plugin is missing or too old.

## Versioning

`api.version` is `1` for the API described here. It only changes when an
existing method or type changes incompatibly. New methods and fields may be
added without a version bump, so consumers should check the methods they use.

## Types

```ts
type PublicFileStatusKind =
    | "modified"
    | "untracked"
    | "staged"
    | "deleted"
    | "conflicted"
    | "unchanged";

interface PublicFileStatus {
    /** Vault-relative path with `/` separators. */
    path: string;
    /** Coarse state intended for badges and other read-only UI. */
    status: PublicFileStatusKind;
    /** First character of the `git status --short` code. */
    index: string;
    /** Second character of the `git status --short` code. */
    workingDir: string;
    /** Vault-relative previous path for renamed files. */
    from?: string;
}
```

`status` uses this precedence: `conflicted`, `untracked`, `deleted`, `staged`,
`modified`, `unchanged`. A file with both staged and unstaged changes is
reported as `staged`; `index` and `workingDir` contain the raw codes if more
detail is needed. Renamed files are reported as `staged` with `from` set.

The bundled Git backends report untracked files with `index` and `workingDir`
both set to `U`. On desktop, Git may report an untracked directory as one entry
whose path ends with `/`; `getFileStatus` maps files below that directory to
`untracked` automatically.

## Methods

### `getStatus(options?): Promise<readonly PublicFileStatus[]>`

Returns all changed files inside the vault, sorted by vault path. Files outside
the vault are omitted when the vault is a subdirectory of the repository.

By default this returns the latest computed snapshot. Pass `{ refresh: true }`
to recompute it first.

### `getFileStatus(path, options?): Promise<PublicFileStatus>`

Returns the status of one vault-relative file. Paths are normalized to `/`
separators. A file without pending changes returns:

```ts
{ path: "notes/clean.md", status: "unchanged", index: " ", workingDir: " " }
```

Absolute paths, empty paths, and paths containing `..` are rejected with a
`FileStatusApiError` whose `code` is `invalid-path`.

### `requestStatusTracking(): void` and `releaseStatusTracking(): void`

Status is normally computed only when the Source Control view, History view, or
the changed-files status bar indicator needs it. Call `requestStatusTracking`
while a plugin needs current status, and pair it with `releaseStatusTracking`.
Tracking stays active until every request is released. The first request also
starts a refresh.

Tracking calls can be nested; each `requestStatusTracking` call must have one
matching `releaseStatusTracking` call. Extra releases are ignored.

### `onStatusChanged(listener): () => void`

Subscribes to status updates. The listener receives the same file list as
`getStatus()` after the plugin recomputes status. The returned function removes
the listener and is safe to call more than once.

Subscribe and request tracking during plugin load, then release tracking and
unsubscribe when your plugin unloads.

## Errors

Methods reject with `FileStatusApiError`:

- `not-ready`: no repository is available or the Obsidian Git plugin has not
  finished loading. Retry after the plugin is ready or let your feature degrade.
- `invalid-path`: the path is not a safe vault-relative path.
- `status-failed`: the Git backend failed to compute status. The original error
  is available as `error.cause`.

Background refreshes started by `requestStatusTracking` do not throw to the
caller; failures are logged and retried by the next plugin refresh. A later
`getStatus` or `getFileStatus` call reports the failure as `status-failed`.

## Lifecycle

The API belongs to the plugin instance. Do not keep a reference after the
plugin unloads. Releasing tracking and unsubscribing in your plugin's unload
path prevents work on behalf of a plugin that no longer needs status. An
Obsidian Git settings reload recreates its internal Git manager but keeps the
same public API object and tracking requests.
