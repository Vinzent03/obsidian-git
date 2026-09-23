import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { vi } from "vitest";
import { IsomorphicGit } from "../../src/gitManager/isomorphicGit";
import { createFakePlugin, type FakePlugin } from "./createFakePlugin";

export type IsomorphicGitTestContext = {
    manager: IsomorphicGit;
    setPluginState: ReturnType<typeof vi.fn>;
    setConflictFiles: ReturnType<typeof vi.fn>;
    handleConflict: ReturnType<typeof vi.fn>;
};

function createNodeVault(root: string) {
    const resolve = (vaultPath: string): string =>
        path.join(root, vaultPath.replace(/^\/+/, ""));
    const relative = (vaultPath: string, name: string): string =>
        vaultPath === "/" || vaultPath === "" ? name : `${vaultPath}/${name}`;

    const adapter = {
        exists: async (vaultPath: string) => {
            try {
                await stat(resolve(vaultPath));
                return true;
            } catch {
                return false;
            }
        },
        read: (vaultPath: string) => readFile(resolve(vaultPath), "utf8"),
        readBinary: async (vaultPath: string) => {
            const data = await readFile(resolve(vaultPath));
            return data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength
            );
        },
        write: async (vaultPath: string, data: string) => {
            await mkdir(path.dirname(resolve(vaultPath)), { recursive: true });
            await writeFile(resolve(vaultPath), data);
        },
        writeBinary: async (vaultPath: string, data: ArrayBuffer) => {
            await mkdir(path.dirname(resolve(vaultPath)), { recursive: true });
            await writeFile(resolve(vaultPath), new Uint8Array(data));
        },
        stat: async (vaultPath: string) => {
            try {
                const result = await stat(resolve(vaultPath));
                return {
                    type: result.isDirectory() ? "folder" : "file",
                    ctime: result.ctimeMs,
                    mtime: result.mtimeMs,
                    size: result.size,
                };
            } catch {
                return null;
            }
        },
        list: async (vaultPath: string) => {
            const entries = await readdir(resolve(vaultPath), {
                withFileTypes: true,
            });
            return {
                files: entries
                    .filter((entry) => entry.isFile())
                    .map((entry) => relative(vaultPath, entry.name)),
                folders: entries
                    .filter((entry) => entry.isDirectory())
                    .map((entry) => relative(vaultPath, entry.name)),
            };
        },
        mkdir: (vaultPath: string) =>
            mkdir(resolve(vaultPath), { recursive: true }),
        rmdir: (vaultPath: string, recursive = false) =>
            rm(resolve(vaultPath), { recursive, force: true }),
        remove: (vaultPath: string) =>
            rm(resolve(vaultPath), { recursive: true, force: true }),
    };

    return {
        adapter,
        getAbstractFileByPath: () => null,
        getFolderByPath: () => null,
    };
}

export function createIsomorphicGitManager(
    repoPath: string
): IsomorphicGitTestContext {
    const plugin = createFakePlugin();
    plugin.settings = {
        basePath: "",
        gitDir: "",
        mergeStrategy: "none",
        listChangedFilesInMessageBody: false,
    } as FakePlugin["settings"];

    const setPluginState = vi.fn();
    const setConflictFiles = vi.fn();
    const handleConflict = vi.fn();
    plugin.localStorage = {
        setConflictFiles,
        getHostname: vi.fn().mockReturnValue(null),
    } as unknown as FakePlugin["localStorage"];
    plugin.setPluginState = setPluginState;
    plugin.handleConflict = handleConflict;
    (plugin.app as unknown as { vault: unknown }).vault =
        createNodeVault(repoPath);

    const manager = new IsomorphicGit(plugin);
    plugin.gitManager = manager;
    return {
        manager,
        setPluginState,
        setConflictFiles,
        handleConflict,
    };
}
