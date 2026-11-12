import { describe, expect, it, vi } from "vitest";
import { FileStatusApi, FileStatusApiError } from "../src/fileStatusApi";
import type { FileStatusResult, Status } from "../src/types";
import { createFakePlugin, type FakePlugin } from "./helpers/createFakePlugin";

type TestPlugin = FakePlugin & {
    gitReady: boolean;
    cachedStatus: Status | undefined;
    updateCachedStatus: ReturnType<typeof vi.fn>;
};

type CreateApiOptions = {
    status?: Status;
    ready?: boolean;
    basePath?: string;
    update?: () => Promise<Status>;
};

function fileStatus(
    path: string,
    index: string,
    workingDir: string,
    from?: string
): FileStatusResult {
    return {
        path,
        vaultPath: path,
        index,
        workingDir,
        ...(from != undefined ? { from } : {}),
    };
}

function createStatus(
    all: FileStatusResult[] = [],
    conflicted: string[] = []
): Status {
    return {
        all,
        changed: [],
        staged: [],
        conflicted,
        stagedOutsideVault: 0,
        conflictedOutsideVault: 0,
    };
}

function createApi(options: CreateApiOptions = {}) {
    const plugin = createFakePlugin() as TestPlugin;
    plugin.gitReady = options.ready ?? true;
    plugin.cachedStatus = options.status;
    plugin.settings = {
        basePath: options.basePath ?? "",
    } as FakePlugin["settings"];
    const update = vi.fn(
        options.update ??
            (() => Promise.resolve(options.status ?? createStatus()))
    );
    plugin.updateCachedStatus = update;
    const api = new FileStatusApi(plugin);
    return { api, plugin, update };
}

async function rejection(
    promise: Promise<unknown>
): Promise<FileStatusApiError> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof FileStatusApiError) {
            return error;
        }
        throw error;
    }
    throw new Error("Expected promise to reject");
}

function byPath(files: readonly { path: string }[]) {
    return new Map(files.map((file) => [file.path, file]));
}

describe("FileStatusApi", () => {
    it("returns vault-relative files with coarse states", async () => {
        const status = createStatus(
            [
                fileStatus("notes/modified.md", " ", "M"),
                fileStatus("notes/untracked.md", "U", "U"),
                fileStatus("notes/staged.md", "A", " "),
                fileStatus("notes/deleted.md", " ", "D"),
                fileStatus("notes/conflicted.md", "U", "U"),
                fileStatus("notes/staged-and-modified.md", "M", "M"),
                fileStatus("notes/renamed.md", "R", " ", "notes/old.md"),
                fileStatus("other/outside.md", " ", "M"),
            ],
            ["notes/conflicted.md"]
        );
        const { api } = createApi({ status, basePath: "notes" });

        const files = await api.getStatus();
        const filesByPath = byPath(files);

        expect([...filesByPath.keys()]).toEqual([
            "conflicted.md",
            "deleted.md",
            "modified.md",
            "renamed.md",
            "staged-and-modified.md",
            "staged.md",
            "untracked.md",
        ]);
        expect(filesByPath.get("modified.md")).toMatchObject({
            status: "modified",
            index: " ",
            workingDir: "M",
        });
        expect(filesByPath.get("untracked.md")).toMatchObject({
            status: "untracked",
        });
        expect(filesByPath.get("staged.md")).toMatchObject({
            status: "staged",
        });
        expect(filesByPath.get("deleted.md")).toMatchObject({
            status: "deleted",
        });
        expect(filesByPath.get("conflicted.md")).toMatchObject({
            status: "conflicted",
        });
        expect(filesByPath.get("staged-and-modified.md")).toMatchObject({
            status: "staged",
        });
        expect(filesByPath.get("renamed.md")).toMatchObject({
            status: "staged",
            from: "old.md",
        });
        expect(filesByPath.has("outside.md")).toBe(false);
    });

    it("normalizes repository paths from the backend", async () => {
        const status = createStatus([
            fileStatus("notes\\folder\\note.md", "?", "?"),
        ]);
        const { api } = createApi({ status, basePath: "notes\\" });

        expect(await api.getStatus()).toEqual([
            {
                path: "folder/note.md",
                status: "untracked",
                index: "?",
                workingDir: "?",
            },
        ]);
    });

    it("reports files inside untracked directories as untracked", async () => {
        const status = createStatus([fileStatus("newdir/", "U", "U")]);
        const { api } = createApi({ status });

        expect(await api.getFileStatus("newdir/note.md")).toEqual({
            path: "newdir/note.md",
            status: "untracked",
            index: "U",
            workingDir: "U",
        });
        expect(await api.getFileStatus("other.md")).toEqual({
            path: "other.md",
            status: "unchanged",
            index: " ",
            workingDir: " ",
        });
    });

    it("normalizes vault paths and rejects unsafe paths", async () => {
        const { api, update } = createApi();

        expect(await api.getFileStatus("./folder//note.md")).toEqual({
            path: "folder/note.md",
            status: "unchanged",
            index: " ",
            workingDir: " ",
        });
        expect(await api.getFileStatus("folder\\note.md")).toMatchObject({
            path: "folder/note.md",
        });

        update.mockClear();
        for (const path of [
            "",
            "../note.md",
            "/note.md",
            "C:\\note.md",
            "a/../b.md",
        ]) {
            const error = await rejection(api.getFileStatus(path));
            expect(error).toBeInstanceOf(FileStatusApiError);
            expect(error).toMatchObject({ code: "invalid-path" });
        }
        expect(update).not.toHaveBeenCalled();
    });

    it("reports a clear error when Git is not ready", async () => {
        const status = createStatus([fileStatus("note.md", " ", "M")]);
        const { api, update } = createApi({ status, ready: false });

        const error = await rejection(api.getStatus());
        expect(error).toBeInstanceOf(FileStatusApiError);
        expect(error).toMatchObject({ code: "not-ready" });
        expect(update).not.toHaveBeenCalled();
    });

    it("returns the cached snapshot unless a refresh is requested", async () => {
        const cached = createStatus([fileStatus("note.md", " ", "M")]);
        const empty = createStatus();
        const { api, update } = createApi({
            status: cached,
            update: () => Promise.resolve(empty),
        });

        expect(await api.getStatus()).toEqual([
            expect.objectContaining({ path: "note.md", status: "modified" }),
        ]);
        expect(update).not.toHaveBeenCalled();

        expect(await api.getStatus({ refresh: true })).toEqual([]);
        expect(update).toHaveBeenCalledTimes(1);
    });

    it("coalesces concurrent status refreshes", async () => {
        let resolve!: (status: Status) => void;
        const pending = new Promise<Status>((res) => {
            resolve = res;
        });
        const { api, update } = createApi({ update: () => pending });

        const first = api.getStatus();
        const second = api.getStatus();
        expect(update).toHaveBeenCalledTimes(1);

        resolve(createStatus([fileStatus("note.md", "A", " ")]));
        await expect(first).resolves.toEqual([
            expect.objectContaining({ path: "note.md", status: "staged" }),
        ]);
        await expect(second).resolves.toEqual([
            expect.objectContaining({ path: "note.md", status: "staged" }),
        ]);
    });

    it("wraps backend failures", async () => {
        const cause = new Error("boom");
        const { api } = createApi({
            update: () => Promise.reject(cause),
        });

        const error = await rejection(api.getStatus());
        expect(error).toBeInstanceOf(FileStatusApiError);
        expect(error).toMatchObject({
            code: "status-failed",
            message: "Failed to read Git status",
        });
        expect(error.cause).toBe(cause);
    });

    it("tracks consumers with balanced releases", () => {
        const { api, update } = createApi();

        expect(api.isTracking).toBe(false);
        api.requestStatusTracking();
        expect(api.isTracking).toBe(true);
        expect(update).toHaveBeenCalledTimes(1);

        api.requestStatusTracking();
        expect(api.isTracking).toBe(true);
        expect(update).toHaveBeenCalledTimes(1);

        api.releaseStatusTracking();
        expect(api.isTracking).toBe(true);
        api.releaseStatusTracking();
        expect(api.isTracking).toBe(false);
        api.releaseStatusTracking();
        expect(api.isTracking).toBe(false);
    });

    it("waits for Git readiness before refreshing tracking", () => {
        const { api, update } = createApi({ ready: false });

        api.requestStatusTracking();

        expect(api.isTracking).toBe(true);
        expect(update).not.toHaveBeenCalled();
    });

    it("notifies listeners with public status and isolates listener errors", () => {
        const status = createStatus([fileStatus("note.md", " ", "M")]);
        const { api, plugin } = createApi({ status });
        const first = vi.fn();
        const failing = vi.fn(() => {
            throw new Error("listener failed");
        });

        const unsubscribe = api.onStatusChanged(first);
        api.onStatusChanged(failing);
        api.notifyStatusChanged(status);

        expect(first).toHaveBeenCalledTimes(1);
        expect(first).toHaveBeenCalledWith([
            expect.objectContaining({ path: "note.md", status: "modified" }),
        ]);
        expect(plugin.log).toHaveBeenCalled();

        unsubscribe();
        api.notifyStatusChanged(status);
        expect(first).toHaveBeenCalledTimes(1);
    });

    it("clears listeners and tracking on dispose", () => {
        const status = createStatus([fileStatus("note.md", " ", "M")]);
        const { api } = createApi({ status });
        const listener = vi.fn();
        api.onStatusChanged(listener);
        api.requestStatusTracking();

        api.dispose();

        expect(api.isTracking).toBe(false);
        api.notifyStatusChanged(status);
        expect(listener).not.toHaveBeenCalled();
    });
});
