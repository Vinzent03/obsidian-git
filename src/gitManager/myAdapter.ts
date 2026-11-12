import type { DataAdapter, Stat, Vault } from "obsidian";
import { normalizePath, TFile, TFolder } from "obsidian";
import type ObsidianGit from "../main";

type BinaryData = ArrayBuffer | ArrayBufferView;
type MyAdapterPromises = Pick<
    MyAdapter,
    | "readFile"
    | "writeFile"
    | "readdir"
    | "mkdir"
    | "rmdir"
    | "stat"
    | "unlink"
    | "lstat"
    | "readlink"
    | "symlink"
>;
type RmdirOptions = {
    recursive?: boolean;
    options?: {
        recursive?: boolean;
    };
};

// Missing stats become NaN in isomorphic-git, so the index stat cache never hits.
const STABLE_STATS = { uid: 0, gid: 0, ino: 0, dev: 0 };

class FileNotFoundError extends Error {
    readonly code = "ENOENT";

    constructor(path: string) {
        super(`File not found: ${path}`);
        this.name = "FileNotFoundError";
    }
}

export class MyAdapter {
    promises: MyAdapterPromises;
    adapter: DataAdapter;
    vault: Vault;
    index: ArrayBuffer | undefined;
    indexctime: number | undefined;
    indexmtime: number | undefined;
    /** Native stat of the unmodified index, kept until `clearIndex`. */
    private indexStat: Stat | undefined;
    /**
     * Native listings of git directories (e.g. `objects/pack`), kept until
     * the git directory is written to or the operation ends.
     */
    private gitListings = new Map<string, Promise<string[]>>();
    lastBasePath: string | undefined;

    constructor(
        vault: Vault,
        private readonly plugin: ObsidianGit
    ) {
        this.adapter = vault.adapter;
        this.vault = vault;
        this.lastBasePath = this.plugin.settings.basePath;

        this.promises = {
            readFile: this.readFile.bind(this),
            writeFile: this.writeFile.bind(this),
            readdir: this.readdir.bind(this),
            mkdir: this.mkdir.bind(this),
            rmdir: this.rmdir.bind(this),
            stat: this.stat.bind(this),
            unlink: this.unlink.bind(this),
            lstat: this.lstat.bind(this),
            readlink: this.readlink.bind(this),
            symlink: this.symlink.bind(this),
        };
    }
    async readFile(
        path: string,
        opts?: string | { encoding?: string; [key: string]: unknown }
    ) {
        if (path === undefined) return undefined;
        path = normalizePath(path);
        this.maybeLog("Read: " + path + JSON.stringify(opts));
        const encoding = typeof opts === "string" ? opts : opts?.encoding;
        if (encoding === "utf8") {
            const file = this.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                this.maybeLog("Reuse");

                return this.vault.read(file);
            } else {
                return this.adapter.read(path);
            }
        } else {
            if (await this.isMissingLooseObject(path)) {
                throw new FileNotFoundError(path);
            }
            if (this.isIndexPath(path)) {
                if (this.plugin.settings.basePath != this.lastBasePath) {
                    this.clearIndex();
                    this.lastBasePath = this.plugin.settings.basePath;
                    return this.adapter.readBinary(path);
                }
                return this.index ?? this.adapter.readBinary(path);
            }
            const file = this.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                this.maybeLog("Reuse");

                return this.vault.readBinary(file);
            } else {
                return this.adapter.readBinary(path);
            }
        }
    }
    async writeFile(path: string, data: string | BinaryData) {
        this.maybeLog("Write: " + path);
        path = normalizePath(path);
        return this.invalidatingGitListings(path, () =>
            this.writeFileUncached(path, data)
        );
    }
    private async writeFileUncached(path: string, data: string | BinaryData) {
        if (typeof data === "string") {
            const file = this.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                return this.vault.modify(file, data);
            } else if (!this.isHiddenPath(path)) {
                await this.vault.create(path, data);
            } else {
                return this.adapter.write(path, data);
            }
        } else {
            const binaryData = toArrayBuffer(data);
            if (this.isIndexPath(path)) {
                this.index = binaryData;
                const now = Date.now();
                this.indexctime ??= now;
                this.indexmtime = now;
                // this.adapter.writeBinary(path, data);
            } else {
                const file = this.vault.getAbstractFileByPath(path);
                if (file instanceof TFile) {
                    return this.vault.modifyBinary(file, binaryData);
                } else if (!this.isHiddenPath(path)) {
                    await this.vault.createBinary(path, binaryData);
                } else {
                    return this.adapter.writeBinary(path, binaryData);
                }
            }
        }
    }
    async readdir(path: string) {
        path = normalizePath(path);
        this.maybeLog("ReadDir: " + path);
        if (path === ".") path = "/";
        if (this.isGitPath(path)) return this.listGitDir(path);
        return this.listNative(path);
    }
    private async listNative(path: string) {
        const res = await this.adapter.list(path);
        const all = [...res.files, ...res.folders];
        let formattedAll;
        if (path !== "/") {
            formattedAll = all.map((e) =>
                normalizePath(e.substring(path.length))
            );
        } else {
            formattedAll = all;
        }
        return formattedAll;
    }
    async mkdir(path: string) {
        path = normalizePath(path);
        if (path === "." || path === "/") return;
        return this.invalidatingGitListings(path, () =>
            this.mkdirUncached(path)
        );
    }
    private async mkdirUncached(path: string) {
        if (!this.isHiddenPath(path)) {
            const file = this.vault.getFolderByPath(path);
            if (file) return;

            await this.vault.createFolder(path);
            return;
        }

        return this.adapter.mkdir(path);
    }
    async rmdir(path: string, opts?: RmdirOptions) {
        path = normalizePath(path);
        this.maybeLog("Rmdir: " + path + JSON.stringify(opts));
        return this.invalidatingGitListings(path, () =>
            this.rmdirUncached(path, opts)
        );
    }
    private async rmdirUncached(path: string, opts?: RmdirOptions) {
        if (!this.isHiddenPath(path)) {
            const file = this.vault.getAbstractFileByPath(path);
            if (file instanceof TFolder) {
                await this.vault.delete(
                    file,
                    opts?.recursive === true ||
                        opts?.options?.recursive === true
                );
                return;
            }
        }

        return this.adapter.rmdir(
            path,
            opts?.recursive === true || opts?.options?.recursive === true
        );
    }
    async stat(path: string) {
        path = normalizePath(path);

        if (this.isIndexPath(path)) {
            if (
                this.index !== undefined &&
                this.indexctime != undefined &&
                this.indexmtime != undefined
            ) {
                return {
                    ...STABLE_STATS,
                    isFile: () => true,
                    isDirectory: () => false,
                    isSymbolicLink: () => false,
                    size: this.index.byteLength,
                    type: "file",
                    ctimeMs: this.indexctime,
                    mtimeMs: this.indexmtime,
                };
            } else {
                // isomorphic-git stats the index once per file while walking
                // the working tree. Native calls are slow on mobile, so reuse
                // the stat until the index is written or cleared.
                const stat = this.indexStat ?? (await this.adapter.stat(path));
                if (stat == undefined) {
                    throw new FileNotFoundError(path);
                }
                this.indexStat = stat;
                this.indexctime = stat.ctime;
                this.indexmtime = stat.mtime;
                return {
                    ...STABLE_STATS,
                    ctimeMs: stat.ctime,
                    mtimeMs: stat.mtime,
                    size: stat.size,
                    type: "file",
                    isFile: () => true,
                    isDirectory: () => false,
                    isSymbolicLink: () => false,
                };
            }
        }
        if (path === ".") path = "/";
        const file = this.vault.getAbstractFileByPath(path);
        this.maybeLog("Stat: " + path);
        if (file instanceof TFile) {
            this.maybeLog("Reuse stat");
            return {
                ...STABLE_STATS,
                ctimeMs: file.stat.ctime,
                mtimeMs: file.stat.mtime,
                size: file.stat.size,
                type: "file",
                isFile: () => true,
                isDirectory: () => false,
                isSymbolicLink: () => false,
            };
        } else if (file instanceof TFolder) {
            // isomorphic-git only needs the type of a folder, so avoid a
            // native call for each folder of the working tree.
            return {
                ...STABLE_STATS,
                ctimeMs: 0,
                mtimeMs: 0,
                size: 0,
                type: "directory",
                isFile: () => false,
                isDirectory: () => true,
                isSymbolicLink: () => false,
            };
        } else {
            const stat = await this.adapter.stat(path);
            if (stat) {
                return {
                    ...STABLE_STATS,
                    ctimeMs: stat.ctime,
                    mtimeMs: stat.mtime,
                    size: stat.size,
                    type: stat.type === "folder" ? "directory" : stat.type,
                    isFile: () => stat.type === "file",
                    isDirectory: () => stat.type === "folder",
                    isSymbolicLink: () => false,
                };
            } else {
                // used to determine whether a file exists or not
                throw new FileNotFoundError(path);
            }
        }
    }
    async unlink(path: string) {
        path = normalizePath(path);
        return this.invalidatingGitListings(path, () =>
            this.unlinkUncached(path)
        );
    }
    private async unlinkUncached(path: string) {
        if (!this.isHiddenPath(path)) {
            const file = this.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                return this.vault.delete(file);
            }
        }

        return this.adapter.remove(path);
    }
    async lstat(path: string) {
        return this.stat(path);
    }
    readlink(path: string): Promise<never> {
        return Promise.reject(
            new Error(`readlink of (${path}) is not implemented.`)
        );
    }
    symlink(path: string): Promise<never> {
        return Promise.reject(
            new Error(`symlink of (${path}) is not implemented.`)
        );
    }

    async saveAndClear(): Promise<void> {
        this.gitListings.clear();
        if (this.index !== undefined) {
            await this.adapter.writeBinary(this.getIndexPath(), this.index, {
                ctime: this.indexctime,
                mtime: this.indexmtime,
            });
        }
        this.clearIndex();
    }

    clearIndex() {
        this.index = undefined;
        this.indexStat = undefined;
        this.indexctime = undefined;
        this.indexmtime = undefined;
    }

    private get gitDir(): string {
        return this.plugin.settings.gitDir || ".git";
    }

    private getIndexPath(): string {
        return this.plugin.gitManager.getRelativeVaultPath(
            this.gitDir + "/index"
        );
    }

    private isIndexPath(path: string): boolean {
        return path === this.getIndexPath();
    }

    private getGitDirPath(): string {
        return normalizePath(
            this.plugin.gitManager.getRelativeVaultPath(this.gitDir)
        );
    }

    private isGitPath(path: string): boolean {
        const gitDirPath = this.getGitDirPath();
        return path === gitDirPath || path.startsWith(gitDirPath + "/");
    }

    /**
     * Lists a git directory natively once and reuses the result. isomorphic-git
     * lists `objects/pack` for every object it reads.
     */
    private listGitDir(path: string): Promise<string[]> {
        const cached = this.gitListings.get(path);
        if (cached) return cached;
        const listing = this.listNative(path);
        this.gitListings.set(path, listing);
        // Don't keep failures, so the next caller tries again.
        listing.catch(() => {
            if (this.gitListings.get(path) === listing) {
                this.gitListings.delete(path);
            }
        });
        return listing;
    }

    /** Runs a write and drops git listings it may have made stale. */
    private async invalidatingGitListings<T>(
        path: string,
        write: () => Promise<T>
    ): Promise<T> {
        if (!this.isGitPath(path)) return write();
        this.gitListings.clear();
        try {
            return await write();
        } finally {
            // Listings started during the write may predate it.
            this.gitListings.clear();
        }
    }

    /**
     * Whether `path` is a loose object that does not exist, judged from the
     * listings of `objects` and its fan-out folder. isomorphic-git tries to
     * read every object as loose before looking into packfiles.
     */
    private async isMissingLooseObject(path: string): Promise<boolean> {
        const objectsDir = this.getGitDirPath() + "/objects";
        if (!path.startsWith(objectsDir + "/")) return false;
        const match = /^([0-9a-f]{2})\/([0-9a-f]{38})$/.exec(
            path.substring(objectsDir.length + 1)
        );
        if (!match) return false;
        const [, fanOut = "", name = ""] = match;
        try {
            const folders = await this.listGitDir(objectsDir);
            if (!folders.some((entry) => baseName(entry) === fanOut)) {
                return true;
            }
            const objects = await this.listGitDir(`${objectsDir}/${fanOut}`);
            return !objects.some((entry) => baseName(entry) === name);
        } catch {
            // Fall back to reading the object if a listing fails.
            return false;
        }
    }

    private isHiddenPath(path: string): boolean {
        // Faster check for the common case of the .git directory itself
        if (path.startsWith(this.gitDir)) {
            return true;
        }
        return path
            .split("/")
            .some(
                (component) => component.startsWith(".") && component !== "."
            );
    }

    private maybeLog(_: string) {
        // console.log(text);
    }
}

function baseName(path: string): string {
    return path.substring(path.lastIndexOf("/") + 1);
}

function toArrayBuffer(data: BinaryData): ArrayBuffer {
    if (data instanceof ArrayBuffer) {
        return data;
    }

    // Obsidian's binary APIs expect an ArrayBuffer, while isomorphic-git may pass Buffer/Uint8Array views.
    if (
        data.buffer instanceof ArrayBuffer &&
        data.byteOffset === 0 &&
        data.byteLength === data.buffer.byteLength
    ) {
        return data.buffer;
    }

    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()
        .buffer;
}
