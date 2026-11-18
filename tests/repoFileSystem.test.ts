import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { App, Stat } from "obsidian";
import { normalizePath, Platform, TFile, TFolder } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepoFileSystem } from "../src/repoFileSystem";
import { withCleanup } from "./helpers/cleanup";
import { cleanupTempDirectory, createTempDirectory } from "./helpers/gitRepo";

function createContext() {
    const root = createTempDirectory();
    withCleanup({ cleanup: () => cleanupTempDirectory(root) });
    const vaultPath = path.join(root, "vault");
    mkdirSync(vaultPath);
    const adapter = {
        getBasePath: vi.fn(() => vaultPath),
        stat: vi
            .fn<(filePath: string) => Promise<Stat | null>>()
            .mockResolvedValue(null),
        read: vi.fn().mockResolvedValue("adapter text"),
        readBinary: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        write: vi.fn().mockResolvedValue(undefined),
        writeBinary: vi.fn().mockResolvedValue(undefined),
        append: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        rmdir: vi.fn().mockResolvedValue(undefined),
    };
    const vault = {
        adapter,
        getAbstractFileByPath: vi
            .fn<(filePath: string) => TFile | TFolder | null>()
            .mockReturnValue(null),
        read: vi.fn().mockResolvedValue("cached text"),
        readBinary: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        modify: vi.fn().mockResolvedValue(undefined),
        modifyBinary: vi.fn().mockResolvedValue(undefined),
        append: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
        createBinary: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    };
    const fileManager = { trashFile: vi.fn().mockResolvedValue(undefined) };
    const fileSystem = new RepoFileSystem({
        vault,
        fileManager,
    } as unknown as App);
    return { fileSystem, adapter, vault, fileManager, root, vaultPath };
}

afterEach(() => {
    Platform.isDesktopApp = true;
});

describe("RepoFileSystem", () => {
    it.each([true, false])(
        "uses Vault APIs for cached folders (desktop: %s)",
        async (desktop) => {
            Platform.isDesktopApp = desktop;
            const { fileSystem, vault, adapter, fileManager } = createContext();
            const folder = new TFolder();
            vault.getAbstractFileByPath.mockReturnValue(folder);
            await expect(fileSystem.exists("folder")).resolves.toBe(true);
            await fileSystem.rmdir("folder", true);
            await fileSystem.trash("folder");
            expect(vault.delete).toHaveBeenCalledWith(folder, true);
            expect(fileManager.trashFile).toHaveBeenCalledWith(folder);
            expect(adapter.getBasePath).not.toHaveBeenCalled();
        }
    );
    it.each([true, false])(
        "prefers cached TFile APIs (desktop: %s)",
        async (desktop) => {
            Platform.isDesktopApp = desktop;
            const { fileSystem, vault, adapter, fileManager } = createContext();
            const file = new TFile();
            file.stat = { ctime: 1, mtime: 2, size: 3 };
            vault.getAbstractFileByPath.mockReturnValue(file);
            const binary = new Uint8Array([1, 2, 3]).buffer;

            await expect(fileSystem.stat("note.md")).resolves.toEqual({
                type: "file",
                ...file.stat,
            });
            await expect(fileSystem.exists("note.md")).resolves.toBe(true);
            await expect(fileSystem.read("note.md")).resolves.toBe(
                "cached text"
            );
            await fileSystem.readBinary("note.md");
            await fileSystem.write("note.md", "new text");
            await fileSystem.writeBinary("note.md", binary);
            await fileSystem.append("note.md", "more");
            await fileSystem.remove("note.md");
            await fileSystem.trash("note.md");

            expect(vault.read).toHaveBeenCalledWith(file);
            expect(vault.readBinary).toHaveBeenCalledWith(file);
            expect(vault.modify).toHaveBeenCalledWith(file, "new text");
            expect(vault.modifyBinary).toHaveBeenCalledWith(file, binary);
            expect(vault.append).toHaveBeenCalledWith(file, "more");
            expect(vault.delete).toHaveBeenCalledWith(file);
            expect(fileManager.trashFile).toHaveBeenCalledWith(file);
            expect(adapter.getBasePath).not.toHaveBeenCalled();
            expect(adapter.stat).not.toHaveBeenCalled();
        }
    );

    it("uses native fs outside the vault without passing escaping paths to Obsidian", async () => {
        const { fileSystem, vault, adapter, root } = createContext();
        await fileSystem.write("../outside.md", "hello");
        await fileSystem.append("../outside.md", " world");
        await expect(fileSystem.read("../outside.md")).resolves.toBe(
            "hello world"
        );
        await expect(fileSystem.stat("../outside.md")).resolves.toMatchObject({
            type: "file",
            size: 11,
        });
        expect(readFileSync(path.join(root, "outside.md"), "utf8")).toBe(
            "hello world"
        );

        const binary = new Uint8Array([0, 128, 255]).buffer;
        await fileSystem.writeBinary("../outside.bin", binary);
        await expect(fileSystem.readBinary("../outside.bin")).resolves.toEqual(
            binary
        );
        await fileSystem.remove("../outside.bin");
        await fileSystem.trash("../outside.md");
        await expect(fileSystem.exists("../outside.md")).resolves.toBe(false);
        mkdirSync(path.join(root, "folder"));
        writeFileSync(path.join(root, "folder/child"), "data");
        await fileSystem.trash("../folder");
        await expect(fileSystem.exists("../folder")).resolves.toBe(false);

        expect(vault.getAbstractFileByPath).not.toHaveBeenCalled();
        expect(adapter.stat).not.toHaveBeenCalled();
        expect(adapter.write).not.toHaveBeenCalled();
        expect(adapter.remove).not.toHaveBeenCalled();
    });

    it("uses native fs for uncached hidden files inside the vault", async () => {
        const { fileSystem, adapter } = createContext();
        await fileSystem.write(".gitignore", "ignored\n");
        await expect(fileSystem.read(".gitignore")).resolves.toBe("ignored\n");
        await fileSystem.remove(".gitignore");
        expect(adapter.write).not.toHaveBeenCalled();
        expect(adapter.read).not.toHaveBeenCalled();
    });

    it.each([true, false])(
        "creates new visible files through Vault APIs (desktop: %s)",
        async (desktop) => {
            Platform.isDesktopApp = desktop;
            const { fileSystem, vault } = createContext();
            const binary = new ArrayBuffer(1);
            await fileSystem.write("new.md", "text");
            await fileSystem.writeBinary("new.bin", binary);
            await fileSystem.append("append.md", "text");
            expect(vault.create).toHaveBeenCalledWith("new.md", "text");
            expect(vault.create).toHaveBeenCalledWith("append.md", "text");
            expect(vault.createBinary).toHaveBeenCalledWith("new.bin", binary);
        }
    );

    it("uses the mobile adapter for uncached files without requesting a native base path", async () => {
        Platform.isDesktopApp = false;
        const { fileSystem, adapter } = createContext();
        const binary = new ArrayBuffer(1);
        await fileSystem.stat(".hidden");
        await expect(fileSystem.read(".hidden")).resolves.toBe("adapter text");
        await fileSystem.readBinary(".hidden");
        await fileSystem.write(".hidden", "text");
        await fileSystem.writeBinary(".hidden", binary);
        await fileSystem.append(".hidden", "more");
        await fileSystem.remove(".hidden");
        await fileSystem.rmdir(".folder", true);
        expect(adapter.stat).toHaveBeenCalledWith(".hidden");
        expect(adapter.readBinary).toHaveBeenCalledWith(".hidden");
        expect(adapter.write).toHaveBeenCalledWith(".hidden", "text");
        expect(adapter.writeBinary).toHaveBeenCalledWith(".hidden", binary);
        expect(adapter.append).toHaveBeenCalledWith(".hidden", "more");
        expect(adapter.remove).toHaveBeenCalledWith(".hidden");
        expect(adapter.rmdir).toHaveBeenCalledWith(".folder", true);
        expect(adapter.getBasePath).not.toHaveBeenCalled();
    });

    it("returns null for missing desktop files and propagates other filesystem errors", async () => {
        const { fileSystem, vaultPath } = createContext();
        await expect(fileSystem.stat("missing.md")).resolves.toBeNull();
        writeFileSync(path.join(vaultPath, "file.md"), "text");
        await expect(fileSystem.stat("file.md/child")).rejects.toMatchObject({
            code: "ENOTDIR",
        });
        await expect(fileSystem.read("missing.md")).rejects.toMatchObject({
            code: "ENOENT",
        });
    });

    it("leaves mobile path validation to the adapter after Obsidian normalization", async () => {
        Platform.isDesktopApp = false;
        const { fileSystem, adapter } = createContext();
        const error = new Error("Path is outside the vault");
        adapter.read.mockRejectedValue(error);
        adapter.write.mockRejectedValue(error);
        for (const filePath of [
            "../outside.md",
            "sub/../../outside.md",
            "..\\outside.md",
        ]) {
            await expect(fileSystem.read(filePath)).rejects.toThrow(
                "outside the vault"
            );
            await expect(fileSystem.write(filePath, "text")).rejects.toThrow(
                "outside the vault"
            );
            expect(adapter.read).toHaveBeenCalledWith(normalizePath(filePath));
            expect(adapter.write).toHaveBeenCalledWith(
                normalizePath(filePath),
                "text"
            );
        }
    });

    it("rejects absolute paths", async () => {
        const { fileSystem } = createContext();
        for (const filePath of [
            "/outside.md",
            "C:\\outside.md",
            "\\\\server\\share\\file",
        ]) {
            await expect(fileSystem.read(filePath)).rejects.toThrow(
                "vault-relative path"
            );
        }
    });
});
