/**
 * Type declarations for the wasm-git (libgit2 compiled to WebAssembly)
 * Emscripten module. Only the small API surface used by this plugin is typed.
 */
declare module "wasm-git/lg2_async.js" {
    export interface Lg2FSStats {
        size: number;
        mtime: Date;
        mode: number;
    }

    export interface Lg2FS {
        writeFile(
            path: string,
            data: string | Uint8Array,
            opts?: { encoding?: string }
        ): void;
        readFile(path: string): Uint8Array;
        readFile(path: string, opts: { encoding: "utf8" }): string;
        readdir(path: string): string[];
        mkdir(path: string): void;
        rmdir(path: string): void;
        unlink(path: string): void;
        rename(oldPath: string, newPath: string): void;
        stat(path: string): Lg2FSStats;
        isDir(mode: number): boolean;
        isFile(mode: number): boolean;
        utime(path: string, atime: number, mtime: number): void;
        chdir(path: string): void;
        cwd(): string;
        analyzePath(path: string): { exists: boolean };
    }

    export interface Lg2Module {
        callMain(args: string[]): Promise<number | undefined>;
        FS: Lg2FS;
        HEAPU8: Uint8Array;
        emscriptenhttpconnect(
            url: string,
            bufferSize: number,
            method?: string,
            headers?: Record<string, string>
        ): Promise<number>;
        emscriptenhttpwrite(
            connectionNo: number,
            buffer: number,
            length: number
        ): void;
        emscriptenhttpread(
            connectionNo: number,
            buffer: number,
            bufferSize: number
        ): Promise<number>;
        emscriptenhttpfree(connectionNo: number): void;
    }

    export interface Lg2ModuleArgs {
        print?: (text: string) => void;
        printErr?: (text: string) => void;
        instantiateWasm?: (
            imports: WebAssembly.Imports,
            successCallback: (
                instance: WebAssembly.Instance,
                module?: WebAssembly.Module
            ) => void
        ) => Record<string, never>;
    }

    export default function initLg2(args?: Lg2ModuleArgs): Promise<Lg2Module>;
}

declare module "wasm-git/lg2_async.wasm" {
    /** Raw wasm bytes embedded by the esbuild `binary` loader. */
    const wasmBinary: Uint8Array;
    export default wasmBinary;
}
