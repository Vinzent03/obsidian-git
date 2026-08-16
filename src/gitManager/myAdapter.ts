import type { DataAdapter, Vault } from "obsidian";
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
        if (path === ".") path = "/";
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
        if (path === "." || path === "/") return;

        if (!this.isHiddenPath(path)) {
            const file = this.vault.getFolderByPath(path);
            if (file) return;

            await this.vault.createFolder(path);
            return;
        }

        return this.adapter.mkdir(path);
    }
    async rmdir(path: string, opts?: RmdirOptions) {
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
        if (this.isIndexPath(path)) {
            if (
                this.index !== undefined &&
                this.indexctime != undefined &&
                this.indexmtime != undefined
            ) {
                return {
                    isFile: () => true,
                    isDirectory: () => false,
                    isSymbolicLink: () => false,
                    size: this.index.byteLength,
                    type: "file",
                    ctimeMs: this.indexctime,
                    mtimeMs: this.indexmtime,
                };
            } else {
                const stat = await this.adapter.stat(path);
                if (stat == undefined) {
                    throw new FileNotFoundError(path);
                }
                this.indexctime = stat.ctime;
                this.indexmtime = stat.mtime;
                return {
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
                ctimeMs: file.stat.ctime,
                mtimeMs: file.stat.mtime,
                size: file.stat.size,
                type: "file",
                isFile: () => true,
                isDirectory: () => false,
                isSymbolicLink: () => false,
            };
        } else {
            const stat = await this.adapter.stat(path);
            if (stat) {
                return {
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

    private isHiddenPath(path: string): boolean {
        // Faster check for the common case of the .git directory itself
        if (path.startsWith(this.gitDir)) {
            return true;
        }
        return normalizePath(path)
            .split("/")
            .some(
                (component) => component.startsWith(".") && component !== "."
            );
    }

    private maybeLog(_: string) {
        // console.log(text);
    }
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
