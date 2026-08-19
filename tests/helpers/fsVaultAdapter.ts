import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmdirSync,
    rmSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from "fs";
import path from "path";

/**
 * Filesystem-backed stand-in for Obsidian's `DataAdapter`, exposing the
 * subset used by the wasm-git engine (the `MirrorAdapter` contract plus the
 * text helpers used in tests). All paths are vault-relative with `/`
 * separators, exactly like Obsidian's adapter.
 */
export class FsVaultAdapter {
    constructor(readonly baseDir: string) {}

    private full(vaultPath: string): string {
        if (vaultPath === "" || vaultPath === "/" || vaultPath === ".") {
            return this.baseDir;
        }
        return path.join(this.baseDir, vaultPath);
    }

    exists(vaultPath: string): Promise<boolean> {
        return Promise.resolve(existsSync(this.full(vaultPath)));
    }

    stat(vaultPath: string): Promise<{
        type: "file" | "folder";
        mtime: number;
        size: number;
    } | null> {
        const fullPath = this.full(vaultPath);
        if (!existsSync(fullPath)) return Promise.resolve(null);
        const stats = statSync(fullPath);
        return Promise.resolve({
            type: stats.isDirectory() ? ("folder" as const) : ("file" as const),
            mtime: Math.floor(stats.mtimeMs),
            size: stats.size,
        });
    }

    list(vaultPath: string): Promise<{ files: string[]; folders: string[] }> {
        const fullPath = this.full(vaultPath);
        const files: string[] = [];
        const folders: string[] = [];
        const prefix =
            vaultPath === "" || vaultPath === "/" || vaultPath === "."
                ? ""
                : `${vaultPath}/`;
        for (const entry of readdirSync(fullPath, { withFileTypes: true })) {
            const childVaultPath = `${prefix}${entry.name}`;
            if (entry.isDirectory()) {
                folders.push(childVaultPath);
            } else if (entry.isFile()) {
                files.push(childVaultPath);
            }
        }
        return Promise.resolve({ files, folders });
    }

    readBinary(vaultPath: string): Promise<ArrayBuffer> {
        const data = readFileSync(this.full(vaultPath));
        return Promise.resolve(
            data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength
            )
        );
    }

    writeBinary(vaultPath: string, data: ArrayBuffer): Promise<void> {
        writeFileSync(this.full(vaultPath), new Uint8Array(data));
        return Promise.resolve();
    }

    read(vaultPath: string): Promise<string> {
        return Promise.resolve(readFileSync(this.full(vaultPath), "utf8"));
    }

    write(vaultPath: string, content: string): Promise<void> {
        mkdirSync(path.dirname(this.full(vaultPath)), { recursive: true });
        writeFileSync(this.full(vaultPath), content);
        return Promise.resolve();
    }

    mkdir(vaultPath: string): Promise<void> {
        mkdirSync(this.full(vaultPath), { recursive: true });
        return Promise.resolve();
    }

    remove(vaultPath: string): Promise<void> {
        unlinkSync(this.full(vaultPath));
        return Promise.resolve();
    }

    rmdir(vaultPath: string, recursive: boolean): Promise<void> {
        if (recursive) {
            rmSync(this.full(vaultPath), { recursive: true, force: true });
        } else {
            rmdirSync(this.full(vaultPath));
        }
        return Promise.resolve();
    }
}
