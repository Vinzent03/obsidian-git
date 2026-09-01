import { TFile } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyAdapter } from "../../src/gitManager/myAdapter";
import { createFakePlugin, type FakePlugin } from "../helpers/createFakePlugin";

// Minimal in-memory stand-in for Obsidian's DataAdapter, backed by a Map keyed
// on the normalized (leading-slash-free) path so it behaves like the real FS.
function createFakeAdapter(initial: Record<string, string | ArrayBuffer> = {}) {
    const files = new Map<string, string | ArrayBuffer>(
        Object.entries(initial)
    );
    return {
        files,
        exists: vi.fn((path: string) => Promise.resolve(files.has(path))),
        write: vi.fn((path: string, data: string) => {
            files.set(path, data);
            return Promise.resolve();
        }),
        writeBinary: vi.fn((path: string, data: ArrayBuffer) => {
            files.set(path, data);
            return Promise.resolve();
        }),
    };
}

function createFakeVault(adapter: ReturnType<typeof createFakeAdapter>) {
    return {
        adapter,
        // The metadata cache never resolves the isomorphic-git worktree paths in
        // these tests, matching the mobile scenario where the write goes through
        // the fallback branch.
        getAbstractFileByPath: vi.fn<(path: string) => TFile | null>(
            () => null
        ),
        create: vi.fn((path: string, data: string) => {
            if (adapter.files.has(path)) {
                return Promise.reject(new Error("File already exists."));
            }
            adapter.files.set(path, data);
            return Promise.resolve();
        }),
        createBinary: vi.fn((path: string, data: ArrayBuffer) => {
            if (adapter.files.has(path)) {
                return Promise.reject(new Error("File already exists."));
            }
            adapter.files.set(path, data);
            return Promise.resolve();
        }),
        modify: vi.fn(),
        modifyBinary: vi.fn(),
    };
}

function createAdapterUnderTest(
    initial: Record<string, string | ArrayBuffer> = {}
) {
    const adapter = createFakeAdapter(initial);
    const vault = createFakeVault(adapter);
    const plugin = createFakePlugin();
    plugin.settings = { basePath: "", gitDir: "" } as FakePlugin["settings"];
    plugin.gitManager = {
        getRelativeVaultPath: (path: string) => path,
    } as unknown as FakePlugin["gitManager"];

    const myAdapter = new MyAdapter(vault as never, plugin);
    return { myAdapter, adapter, vault };
}

describe("MyAdapter.writeFile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Regression test for issue #1164: with an empty base path, isomorphic-git
    // hands worktree paths in with a leading slash ("/note.md"). Updating an
    // existing tracked file must not throw "File already exists".
    it("overwrites an existing file given a non-normalized path (binary)", async () => {
        const original = new TextEncoder().encode("old").buffer;
        const updated = new TextEncoder().encode("new").buffer;
        const { myAdapter, adapter, vault } = createAdapterUnderTest({
            "notes/foo.md": original,
        });

        await expect(
            myAdapter.writeFile("/notes/foo.md", updated)
        ).resolves.not.toThrow();

        expect(vault.createBinary).not.toHaveBeenCalled();
        expect(adapter.writeBinary).toHaveBeenCalledWith(
            "notes/foo.md",
            updated
        );
        expect(adapter.files.get("notes/foo.md")).toBe(updated);
    });

    it("overwrites an existing file given a non-normalized path (utf8)", async () => {
        const { myAdapter, adapter, vault } = createAdapterUnderTest({
            "notes/foo.md": "old",
        });

        await expect(
            myAdapter.writeFile("/notes/foo.md", "new")
        ).resolves.not.toThrow();

        expect(vault.create).not.toHaveBeenCalled();
        expect(adapter.write).toHaveBeenCalledWith("notes/foo.md", "new");
        expect(adapter.files.get("notes/foo.md")).toBe("new");
    });

    it("creates a genuinely new file through the vault API", async () => {
        const data = new TextEncoder().encode("brand new").buffer;
        const { myAdapter, adapter, vault } = createAdapterUnderTest();

        await myAdapter.writeFile("/notes/new.md", data);

        expect(vault.createBinary).toHaveBeenCalledWith("notes/new.md", data);
        expect(adapter.writeBinary).not.toHaveBeenCalled();
        expect(adapter.files.get("notes/new.md")).toBe(data);
    });

    it("reuses the cached TFile when the vault resolves the normalized path", async () => {
        const updated = new TextEncoder().encode("new").buffer;
        const { myAdapter, adapter, vault } = createAdapterUnderTest({
            "notes/foo.md": new TextEncoder().encode("old").buffer,
        });
        const tfile = Object.create(TFile.prototype) as TFile;
        vault.getAbstractFileByPath.mockImplementation((path) =>
            path === "notes/foo.md" ? tfile : null
        );

        await myAdapter.writeFile("/notes/foo.md", updated);

        expect(vault.modifyBinary).toHaveBeenCalledWith(tfile, updated);
        expect(adapter.writeBinary).not.toHaveBeenCalled();
        expect(vault.createBinary).not.toHaveBeenCalled();
    });
});
