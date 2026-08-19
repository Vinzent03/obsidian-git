import type { Lg2FS } from "wasm-git/lg2_async.js";

/**
 * The subset of Obsidian's `DataAdapter` used by the mirror. Declared
 * structurally so tests can provide a filesystem-backed fake.
 */
export interface MirrorAdapter {
    exists(path: string): Promise<boolean>;
    stat(
        path: string
    ): Promise<{ type: "file" | "folder"; mtime: number; size: number } | null>;
    list(path: string): Promise<{ files: string[]; folders: string[] }>;
    readBinary(path: string): Promise<ArrayBuffer>;
    writeBinary(path: string, data: ArrayBuffer): Promise<void>;
    mkdir(path: string): Promise<void>;
    remove(path: string): Promise<void>;
    rmdir(path: string, recursive: boolean): Promise<void>;
}

interface FileMeta {
    mtime: number;
    size: number;
}

/**
 * Keeps one directory of the vault and one directory of the Emscripten
 * in-memory filesystem in sync.
 *
 * libgit2 requires synchronous filesystem access while Obsidian's vault
 * adapter is asynchronous, so git operates on an in-memory copy: `syncIn`
 * brings vault changes into memory before a git command and `syncOut`
 * writes files changed by git back to the vault afterwards.
 *
 * A manifest of `path -> (mtime, size)` records the state at the last sync
 * point. Only entries whose metadata changed are copied, and the vault's
 * mtimes are replicated into the memory filesystem so libgit2's index stat
 * cache stays valid across syncs.
 */
export class VaultMirror {
    /** State of every mirrored file at the last completed sync. */
    private manifest = new Map<string, FileMeta>();

    constructor(
        private readonly adapter: MirrorAdapter,
        private readonly fs: Lg2FS,
        /** Vault-relative directory that is mirrored ("" for the root). */
        readonly vaultRoot: string,
        /** Absolute directory in the in-memory filesystem. */
        readonly memRoot: string,
        /** Returns true for relative paths that must not be mirrored. */
        private readonly exclude: (relativePath: string) => boolean = () =>
            false
    ) {}

    private toVaultPath(relativePath: string): string {
        return this.vaultRoot === ""
            ? relativePath
            : `${this.vaultRoot}/${relativePath}`;
    }

    private toMemPath(relativePath: string): string {
        return `${this.memRoot}/${relativePath}`;
    }

    /** Copies vault-side changes into the in-memory filesystem. */
    async syncIn(): Promise<void> {
        this.ensureMemDir(this.memRoot);
        const { files: vaultFiles, dirs: vaultDirs } = await this.walkVault();

        // Replicate directories even when empty: git requires e.g.
        // `.git/objects` and `.git/refs` to exist for a valid layout.
        for (const dir of vaultDirs) {
            this.ensureMemDir(this.toMemPath(dir));
        }

        for (const [relativePath, meta] of vaultFiles) {
            const known = this.manifest.get(relativePath);
            if (
                known &&
                known.mtime === meta.mtime &&
                known.size === meta.size
            ) {
                continue;
            }
            const data = await this.adapter.readBinary(
                this.toVaultPath(relativePath)
            );
            const memPath = this.toMemPath(relativePath);
            this.ensureMemDir(parentOf(memPath));
            this.fs.writeFile(memPath, new Uint8Array(data));
            this.fs.utime(memPath, meta.mtime, meta.mtime);
            this.manifest.set(relativePath, meta);
        }

        for (const relativePath of [...this.manifest.keys()]) {
            if (vaultFiles.has(relativePath)) continue;
            this.removeMemFile(this.toMemPath(relativePath));
            this.manifest.delete(relativePath);
        }

        // Drop stray files that exist only in memory (e.g. leftovers of a
        // failed operation) so git sees exactly the vault state.
        for (const relativePath of this.walkMem().files.keys()) {
            if (!vaultFiles.has(relativePath)) {
                this.removeMemFile(this.toMemPath(relativePath));
            }
        }
    }

    /** Writes files changed by git in the in-memory filesystem to the vault. */
    async syncOut(): Promise<void> {
        const { files: memFiles, dirs: memDirs } = this.walkMem();

        for (const dir of memDirs) {
            await this.ensureVaultDir(this.toVaultPath(dir));
        }

        for (const [relativePath, meta] of memFiles) {
            const known = this.manifest.get(relativePath);
            if (
                known &&
                known.mtime === meta.mtime &&
                known.size === meta.size
            ) {
                continue;
            }
            const vaultPath = this.toVaultPath(relativePath);
            await this.ensureVaultDir(parentOf(vaultPath));
            const data = this.fs.readFile(this.toMemPath(relativePath));
            // Skip rewriting files whose content did not actually change
            // (libgit2 sometimes rewrites identical loose objects, and
            // object files may be read-only when created by native git).
            const unchanged =
                known != undefined &&
                known.size === meta.size &&
                (await this.vaultContentEquals(vaultPath, data));
            if (!unchanged) {
                await this.adapter.writeBinary(vaultPath, toArrayBuffer(data));
            }
            const stat = await this.adapter.stat(vaultPath);
            const newMeta: FileMeta = {
                mtime: stat?.mtime ?? meta.mtime,
                size: meta.size,
            };
            // Align the memory mtime with the vault so the next syncIn does
            // not consider this file changed and re-read it.
            this.fs.utime(
                this.toMemPath(relativePath),
                newMeta.mtime,
                newMeta.mtime
            );
            this.manifest.set(relativePath, newMeta);
        }

        const removedDirs = new Set<string>();
        for (const relativePath of [...this.manifest.keys()]) {
            if (memFiles.has(relativePath)) continue;
            const vaultPath = this.toVaultPath(relativePath);
            if (await this.adapter.exists(vaultPath)) {
                await this.adapter.remove(vaultPath);
            }
            this.manifest.delete(relativePath);
            const parent = parentOf(vaultPath);
            if (parent) removedDirs.add(parent);
        }
        await this.pruneEmptyVaultDirs(removedDirs);
    }

    /** Forgets all mirror state (e.g. when the base path changed). */
    reset(): void {
        this.manifest.clear();
    }

    private async walkVault(): Promise<{
        files: Map<string, FileMeta>;
        dirs: string[];
    }> {
        const files = new Map<string, FileMeta>();
        const dirs: string[] = [];
        if (!(await this.adapter.exists(this.vaultRoot || "/"))) {
            return { files, dirs };
        }
        const pending: string[] = [this.vaultRoot];
        while (pending.length > 0) {
            const dir = pending.pop()!;
            const listing = await this.adapter.list(dir || "/");
            for (const folder of listing.folders) {
                const relativePath = this.toRelative(folder);
                if (!this.exclude(relativePath)) {
                    dirs.push(relativePath);
                    pending.push(folder);
                }
            }
            for (const file of listing.files) {
                const relativePath = this.toRelative(file);
                if (this.exclude(relativePath)) continue;
                const stat = await this.adapter.stat(file);
                if (stat?.type !== "file") continue;
                files.set(relativePath, {
                    mtime: stat.mtime,
                    size: stat.size,
                });
            }
        }
        return { files, dirs };
    }

    private toRelative(vaultPath: string): string {
        if (this.vaultRoot === "") return vaultPath;
        return vaultPath.startsWith(this.vaultRoot + "/")
            ? vaultPath.substring(this.vaultRoot.length + 1)
            : vaultPath;
    }

    private walkMem(): { files: Map<string, FileMeta>; dirs: string[] } {
        const files = new Map<string, FileMeta>();
        const dirs: string[] = [];
        if (!this.fs.analyzePath(this.memRoot).exists) {
            return { files, dirs };
        }
        const pending: string[] = [this.memRoot];
        while (pending.length > 0) {
            const dir = pending.pop()!;
            for (const name of this.fs.readdir(dir)) {
                if (name === "." || name === "..") continue;
                const memPath = `${dir}/${name}`;
                const relativePath = memPath.substring(this.memRoot.length + 1);
                if (this.exclude(relativePath)) continue;
                const stat = this.fs.stat(memPath);
                if (this.fs.isDir(stat.mode)) {
                    dirs.push(relativePath);
                    pending.push(memPath);
                } else if (this.fs.isFile(stat.mode)) {
                    files.set(relativePath, {
                        mtime: stat.mtime.getTime(),
                        size: stat.size,
                    });
                }
            }
        }
        return { files, dirs };
    }

    private async vaultContentEquals(
        vaultPath: string,
        data: Uint8Array
    ): Promise<boolean> {
        if (!(await this.adapter.exists(vaultPath))) return false;
        const existing = new Uint8Array(
            await this.adapter.readBinary(vaultPath)
        );
        if (existing.length !== data.length) return false;
        for (let i = 0; i < data.length; i++) {
            if (existing[i] !== data[i]) return false;
        }
        return true;
    }

    private ensureMemDir(path: string): void {
        if (path === "" || this.fs.analyzePath(path).exists) return;
        ensureMemDirRecursive(this.fs, path);
    }

    private removeMemFile(memPath: string): void {
        if (!this.fs.analyzePath(memPath).exists) return;
        this.fs.unlink(memPath);
        // Prune now-empty parent directories up to the mirror root, since
        // git treats empty directories as nonexistent anyway.
        let dir = parentOf(memPath);
        while (dir.length > this.memRoot.length) {
            const entries = this.fs
                .readdir(dir)
                .filter((entry) => entry !== "." && entry !== "..");
            if (entries.length > 0) break;
            this.fs.rmdir(dir);
            dir = parentOf(dir);
        }
    }

    private async ensureVaultDir(path: string): Promise<void> {
        if (path === "" || (await this.adapter.exists(path))) return;
        await this.ensureVaultDir(parentOf(path));
        await this.adapter.mkdir(path);
    }

    private async pruneEmptyVaultDirs(dirs: Set<string>): Promise<void> {
        for (let dir of dirs) {
            while (
                dir !== "" &&
                dir !== this.vaultRoot &&
                dir !== "/" &&
                (await this.adapter.exists(dir))
            ) {
                const listing = await this.adapter.list(dir);
                if (listing.files.length > 0 || listing.folders.length > 0) {
                    break;
                }
                await this.adapter.rmdir(dir, false);
                dir = parentOf(dir);
            }
        }
    }
}

function parentOf(path: string): string {
    const index = path.lastIndexOf("/");
    return index <= 0 ? "" : path.substring(0, index);
}

function ensureMemDirRecursive(fs: Lg2FS, path: string): void {
    if (path === "" || path === "/" || fs.analyzePath(path).exists) return;
    ensureMemDirRecursive(fs, parentOf(path));
    fs.mkdir(path);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
    return data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
    );
}
