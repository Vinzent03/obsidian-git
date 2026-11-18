import { stat } from "fs/promises";
import path from "path";
import type { DataAdapter } from "obsidian";

// Only the adapter methods needed by the native Git test harness are modeled.
// Resolve and validate before accessing fs, including before handling ENOENT.
export function createFileSystemAdapter(vaultPath: string) {
    const root = path.resolve(vaultPath);
    const resolve = (vaultRelativePath: string): string => {
        const absolutePath = path.resolve(root, vaultRelativePath);
        const relativePath = path.relative(root, absolutePath);
        if (
            path.isAbsolute(vaultRelativePath) ||
            relativePath === ".." ||
            relativePath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativePath)
        ) {
            throw new Error(
                `Path "${vaultRelativePath}" is outside the vault.`
            );
        }
        return absolutePath;
    };

    const adapter = {
        getBasePath: () => root,
        stat: async (vaultRelativePath: string) => {
            const absolutePath = resolve(vaultRelativePath);
            try {
                const result = await stat(absolutePath);
                return {
                    type: result.isDirectory() ? "folder" : "file",
                    ctime: result.ctimeMs,
                    mtime: result.mtimeMs,
                    size: result.size,
                };
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    return null;
                }
                throw error;
            }
        },
        exists: async (vaultRelativePath: string): Promise<boolean> =>
            (await adapter.stat(vaultRelativePath)) !== null,
    } satisfies Pick<DataAdapter, "stat" | "exists"> & {
        getBasePath(): string;
    };
    return adapter;
}
