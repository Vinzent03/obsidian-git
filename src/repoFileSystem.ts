import * as fs from "fs/promises";
import type { App, FileSystemAdapter, Stat } from "obsidian";
import { normalizePath, Platform, TFile, TFolder } from "obsidian";
import * as path from "path";

/**
 * Filesystem access using vault-relative paths, including ../ paths into the
 * surrounding repository on desktop. Paths use Obsidian's normalization.
 * Cached files use Vault APIs so Obsidian observes modifications immediately.
 */
export class RepoFileSystem {
    constructor(private readonly app: Pick<App, "vault" | "fileManager">) {}

    private normalize(filePath: string): string {
        if (
            Platform.isDesktopApp &&
            (path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath))
        ) {
            throw new Error(`Expected a vault-relative path: "${filePath}"`);
        }
        return normalizePath(filePath);
    }

    private isOutsideVault(filePath: string): boolean {
        return filePath === ".." || filePath.startsWith("../");
    }

    private cached(filePath: string) {
        // Never pass escaping paths to Obsidian's vault APIs either.
        return this.isOutsideVault(filePath)
            ? null
            : this.app.vault.getAbstractFileByPath(filePath);
    }

    private absolute(filePath: string): string {
        const adapter = this.app.vault.adapter as FileSystemAdapter;
        return path.join(adapter.getBasePath(), filePath);
    }

    async stat(filePath: string): Promise<Stat | null> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFile) return { type: "file", ...file.stat };
        if (!Platform.isDesktopApp)
            return this.app.vault.adapter.stat(filePath);
        try {
            const result = await fs.stat(this.absolute(filePath));
            return {
                type: result.isDirectory() ? "folder" : "file",
                ctime: result.ctimeMs,
                mtime: result.mtimeMs,
                size: result.size,
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw error;
        }
    }

    async exists(filePath: string): Promise<boolean> {
        filePath = this.normalize(filePath);
        if (this.cached(filePath)) return true;
        return (await this.stat(filePath)) !== null;
    }

    async read(filePath: string): Promise<string> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFile) return this.app.vault.read(file);
        return Platform.isDesktopApp
            ? fs.readFile(this.absolute(filePath), "utf8")
            : this.app.vault.adapter.read(filePath);
    }

    async readBinary(filePath: string): Promise<ArrayBuffer> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFile) return this.app.vault.readBinary(file);
        if (!Platform.isDesktopApp)
            return this.app.vault.adapter.readBinary(filePath);
        const data = await fs.readFile(this.absolute(filePath));
        return new Uint8Array(data).buffer;
    }

    private async canCreate(filePath: string): Promise<boolean> {
        return (
            !this.isOutsideVault(filePath) &&
            !filePath.split("/").some((part) => part.startsWith(".")) &&
            !(await this.exists(filePath))
        );
    }

    async write(filePath: string, data: string): Promise<void> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFile) return this.app.vault.modify(file, data);
        if (await this.canCreate(filePath)) {
            await this.app.vault.create(filePath, data);
        } else if (Platform.isDesktopApp) {
            await fs.writeFile(this.absolute(filePath), data);
        } else {
            await this.app.vault.adapter.write(filePath, data);
        }
    }

    async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFile)
            return this.app.vault.modifyBinary(file, data);
        if (await this.canCreate(filePath)) {
            await this.app.vault.createBinary(filePath, data);
        } else if (Platform.isDesktopApp) {
            await fs.writeFile(this.absolute(filePath), new Uint8Array(data));
        } else {
            await this.app.vault.adapter.writeBinary(filePath, data);
        }
    }

    async append(filePath: string, data: string): Promise<void> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFile) return this.app.vault.append(file, data);
        if (await this.canCreate(filePath)) {
            await this.app.vault.create(filePath, data);
        } else if (Platform.isDesktopApp) {
            await fs.appendFile(this.absolute(filePath), data);
        } else {
            await this.app.vault.adapter.append(filePath, data);
        }
    }

    async remove(filePath: string): Promise<void> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFile) return this.app.vault.delete(file);
        if (Platform.isDesktopApp) await fs.unlink(this.absolute(filePath));
        else await this.app.vault.adapter.remove(filePath);
    }

    /** Preserve Obsidian's configured trash behavior for cached vault items. */
    async trash(filePath: string): Promise<void> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file) return this.app.fileManager.trashFile(file);
        const stat = await this.stat(filePath);
        if (stat?.type === "folder") await this.rmdir(filePath, true);
        else await this.remove(filePath);
    }

    async rmdir(filePath: string, recursive = false): Promise<void> {
        filePath = this.normalize(filePath);
        const file = this.cached(filePath);
        if (file instanceof TFolder)
            return this.app.vault.delete(file, recursive);
        if (Platform.isDesktopApp) {
            if (recursive)
                await fs.rm(this.absolute(filePath), { recursive: true });
            else await fs.rmdir(this.absolute(filePath));
        } else {
            await this.app.vault.adapter.rmdir(filePath, recursive);
        }
    }
}
