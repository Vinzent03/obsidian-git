import type ObsidianGit from "./main";
import type { FileStatusResult, Status } from "./types";

/** Version of the public file status API exposed as `plugin.api`. */
export const FILE_STATUS_API_VERSION = 1;

/**
 * Coarse file state intended for badges and other read-only UI.
 *
 * A file with both staged and unstaged changes is reported as `staged`.
 * Renamed files are reported as `staged` and include {@link PublicFileStatus.from}.
 */
export type PublicFileStatusKind =
    | "modified"
    | "untracked"
    | "staged"
    | "deleted"
    | "conflicted"
    | "unchanged";

/** Read-only Git status of one vault file. */
export interface PublicFileStatus {
    /** Vault-relative path with `/` separators. */
    path: string;
    /** Coarse state for display purposes. */
    status: PublicFileStatusKind;
    /**
     * First character of the `git status --short` code.
     *
     * An untracked file is reported as `U` by both bundled Git backends.
     */
    index: string;
    /** Second character of the `git status --short` code. */
    workingDir: string;
    /** Vault-relative previous path for renamed files. */
    from?: string;
}

export interface FileStatusQueryOptions {
    /**
     * Recompute the status instead of returning the latest snapshot.
     *
     * Without tracking, the latest snapshot can be stale after vault changes.
     */
    refresh?: boolean;
}

export type FileStatusApiErrorCode =
    "not-ready" | "invalid-path" | "status-failed";

/** Error raised by the public file status API. */
export class FileStatusApiError extends Error {
    readonly code: FileStatusApiErrorCode;
    readonly cause: unknown;

    constructor(
        code: FileStatusApiErrorCode,
        message: string,
        cause?: unknown
    ) {
        super(message);
        this.name = "FileStatusApiError";
        this.code = code;
        this.cause = cause;
    }
}

/**
 * Read-only file status API for other plugins.
 *
 * Access it as `app.plugins.plugins["obsidian-git"].api`. The API never stages,
 * commits, or otherwise changes the repository.
 */
export class FileStatusApi {
    /** Bumped only for breaking changes; new methods may be added within a version. */
    readonly version = FILE_STATUS_API_VERSION;

    private readonly listeners = new Set<
        (files: readonly PublicFileStatus[]) => void
    >();
    private trackingConsumers = 0;
    private pendingStatus?: Promise<Status>;

    constructor(private readonly plugin: ObsidianGit) {}

    /** Whether at least one consumer currently keeps the status up to date. */
    get isTracking(): boolean {
        return this.trackingConsumers > 0;
    }

    /**
     * Starts keeping status up to date while a consumer needs it.
     *
     * Pair every call with {@link releaseStatusTracking}. The first request
     * also starts a status refresh. A failed background refresh is logged and
     * retried by the next plugin refresh; status queries still report failures.
     */
    requestStatusTracking(): void {
        this.trackingConsumers++;
        if (this.trackingConsumers === 1 && this.plugin.gitReady) {
            this.refreshStatus().catch((error) => {
                this.plugin.log(
                    "File status API background refresh failed:",
                    error
                );
            });
        }
    }

    /** Stops the tracking request made by one consumer. Extra calls are ignored. */
    releaseStatusTracking(): void {
        if (this.trackingConsumers > 0) {
            this.trackingConsumers--;
        }
    }

    /**
     * Subscribes to status updates while status is being recomputed.
     *
     * Call {@link requestStatusTracking} if updates are needed without the
     * Source Control view or the changed-files status bar indicator.
     *
     * @returns An idempotent function that removes the listener.
     */
    onStatusChanged(
        listener: (files: readonly PublicFileStatus[]) => void
    ): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Returns all changed files inside the vault.
     *
     * Returns the latest snapshot by default. Pass `{ refresh: true }` to
     * recompute before reading it.
     */
    async getStatus(
        options: FileStatusQueryOptions = {}
    ): Promise<readonly PublicFileStatus[]> {
        const status = await this.loadStatus(options.refresh === true);
        return this.toPublicFiles(status);
    }

    /**
     * Returns the status of one vault-relative file, or `unchanged` when the
     * file has no pending changes.
     *
     * @throws {@link FileStatusApiError} with code `invalid-path` for absolute
     * paths, parent traversal, and empty paths.
     */
    async getFileStatus(
        path: string,
        options: FileStatusQueryOptions = {}
    ): Promise<PublicFileStatus> {
        const vaultPath = normalizeVaultPath(path);
        const files = await this.getStatus(options);
        const file = files.find((entry) => entry.path === vaultPath);
        if (file) {
            return file;
        }

        const untrackedDirectory = files.find(
            (entry) =>
                entry.status === "untracked" &&
                entry.path.endsWith("/") &&
                vaultPath.startsWith(entry.path)
        );
        if (untrackedDirectory) {
            return {
                path: vaultPath,
                status: "untracked",
                index: "U",
                workingDir: "U",
            };
        }

        return {
            path: vaultPath,
            status: "unchanged",
            index: " ",
            workingDir: " ",
        };
    }

    /** Called by the plugin after it recomputes the cached status. */
    notifyStatusChanged(status: Status): void {
        if (this.listeners.size === 0) {
            return;
        }

        let files: readonly PublicFileStatus[];
        try {
            files = this.toPublicFiles(status);
        } catch (error) {
            this.plugin.log(
                "File status API failed to prepare a status update:",
                error
            );
            return;
        }

        for (const listener of [...this.listeners]) {
            try {
                listener(files);
            } catch (error) {
                this.plugin.log("File status API listener failed:", error);
            }
        }
    }

    /** Clears tracking requests and listeners when the plugin unloads. */
    dispose(): void {
        this.listeners.clear();
        this.trackingConsumers = 0;
        this.pendingStatus = undefined;
    }

    private async loadStatus(refresh: boolean): Promise<Status> {
        if (!this.plugin.gitReady) {
            throw new FileStatusApiError(
                "not-ready",
                "Git is not ready. No repository is available or the plugin has not finished loading."
            );
        }
        if (this.pendingStatus) {
            return this.waitForStatus(this.pendingStatus);
        }
        if (!refresh && this.plugin.cachedStatus) {
            return this.plugin.cachedStatus;
        }
        return this.waitForStatus(this.refreshStatus());
    }

    private refreshStatus(): Promise<Status> {
        this.pendingStatus ??= this.plugin.updateCachedStatus().finally(() => {
            this.pendingStatus = undefined;
        });
        return this.pendingStatus;
    }

    private async waitForStatus(promise: Promise<Status>): Promise<Status> {
        try {
            return await promise;
        } catch (error) {
            if (error instanceof FileStatusApiError) {
                throw error;
            }
            throw new FileStatusApiError(
                "status-failed",
                "Failed to read Git status",
                error
            );
        }
    }

    private toPublicFiles(status: Status): PublicFileStatus[] {
        const basePath = normalizeBasePath(this.plugin.settings.basePath);
        const conflicted = new Set(status.conflicted);
        const files = new Map<string, PublicFileStatus>();

        for (const file of status.all) {
            const vaultPath = toVaultRelativePath(file.path, basePath);
            if (vaultPath == undefined || files.has(vaultPath)) {
                continue;
            }
            files.set(
                vaultPath,
                this.toPublicFile(file, vaultPath, basePath, conflicted)
            );
        }

        for (const conflictedPath of status.conflicted) {
            const vaultPath = toVaultRelativePath(conflictedPath, basePath);
            if (vaultPath == undefined || files.has(vaultPath)) {
                continue;
            }
            files.set(vaultPath, {
                path: vaultPath,
                status: "conflicted",
                index: "U",
                workingDir: "U",
            });
        }

        return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
    }

    private toPublicFile(
        file: FileStatusResult,
        vaultPath: string,
        basePath: string,
        conflicted: ReadonlySet<string>
    ): PublicFileStatus {
        const from =
            file.from != undefined
                ? toVaultRelativePath(file.from, basePath)
                : undefined;
        return {
            path: vaultPath,
            status: toPublicStatus(
                file.index,
                file.workingDir,
                conflicted.has(file.path)
            ),
            index: file.index,
            workingDir: file.workingDir,
            ...(from != undefined ? { from } : {}),
        };
    }
}

function toPublicStatus(
    index: string,
    workingDir: string,
    conflicted: boolean
): PublicFileStatusKind {
    if (conflicted) {
        return "conflicted";
    }
    if (
        (index === "U" || index === "?") &&
        (workingDir === "U" || workingDir === "?")
    ) {
        return "untracked";
    }
    if (index === "D" || workingDir === "D") {
        return "deleted";
    }
    if (index !== " " && index !== "?" && index !== "U") {
        return "staged";
    }
    if (workingDir !== " " && workingDir !== "?" && workingDir !== "U") {
        return "modified";
    }
    return "unchanged";
}

function normalizeBasePath(basePath: string): string {
    const normalized = basePath
        .replace(/\\/g, "/")
        .replace(/^\.\/+/, "")
        .replace(/^\/+|\/+$/g, "");
    return normalized === "." ? "" : normalized;
}

function toVaultRelativePath(
    repoPath: string,
    basePath: string
): string | undefined {
    const normalized = repoPath.replace(/\\/g, "/").replace(/^\.\/+/, "");
    if (!basePath) {
        return normalized;
    }
    if (normalized.startsWith(basePath + "/")) {
        return normalized.substring(basePath.length + 1);
    }
    return undefined;
}

function normalizeVaultPath(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    if (
        normalized.startsWith("/") ||
        /^[A-Za-z]:/.test(normalized) ||
        normalized.includes("\0")
    ) {
        throw invalidPathError(path);
    }

    const segments = normalized
        .split("/")
        .filter((segment) => segment.length > 0 && segment !== ".");
    if (segments.length === 0 || segments.includes("..")) {
        throw invalidPathError(path);
    }
    return segments.join("/");
}

function invalidPathError(path: string): FileStatusApiError {
    return new FileStatusApiError(
        "invalid-path",
        `Invalid vault-relative path: ${path}`
    );
}
