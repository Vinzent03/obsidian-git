import type { Lg2FS, Lg2Module } from "wasm-git/lg2_async.js";
import initLg2 from "wasm-git/lg2_async.js";
import wasmBinary from "wasm-git/lg2_async.wasm";
import type { WasmGitHttpBridge } from "./httpBridge";

export interface Lg2Result {
    stdout: string;
    stderr: string;
}

export class Lg2Error extends Error {
    constructor(
        public readonly args: string[],
        public readonly stdout: string,
        public readonly stderr: string
    ) {
        super(
            `git ${args.join(" ")} failed: ${stderr.trim() || stdout.trim() || "unknown error"}`
        );
    }
}

/**
 * The lg2 examples signal failures through stderr instead of a usable exit
 * code (the Asyncify-wrapped `callMain` discards it), so failures are detected
 * by the well-known error formats of `lg2.c` and `common.h`:
 * - `Bad news:\n <message>` from the command dispatcher,
 * - `<message> [<errorcode>]...` from `check_lg2`/`fatal`,
 * - `USAGE:`/usage output for argument errors.
 *
 * Benign chatter is excluded: `show_ahead_behind` prints
 * `error: reference '...' not found` for branches without an upstream, and
 * checkout progress is purely informational.
 */
const ERROR_PATTERNS = [
    /^Bad news:/m,
    /\s\[-?\d+\]( - |$)/m,
    /^THROW: /m,
    /^USAGE: /m,
    /^usage: /m,
    /^Unsupported option/m,
    /^Unknown command line argument/m,
    /^Command not found/m,
    /^failed to /m,
    /^Unable to /m,
    /^invalid command/m,
    /^command is not valid/m,
    /^Unable to open repository/m,
];

export function containsLg2Error(stderr: string): boolean {
    return ERROR_PATTERNS.some((pattern) => pattern.test(stderr));
}

/**
 * Wraps one wasm-git (libgit2) Emscripten module instance.
 *
 * All commands run against a single in-memory filesystem and are serialized
 * through an internal queue: the Asyncify build cannot re-enter the wasm
 * while a previous call is suspended, so overlapping `callMain` invocations
 * would corrupt its state.
 */
export class Lg2 {
    private module: Lg2Module | undefined;
    private queue: Promise<unknown> = Promise.resolve();
    private stdout: string[] = [];
    private stderr: string[] = [];
    private progressHandler: ((line: string) => void) | undefined;

    constructor(private readonly httpBridge: WasmGitHttpBridge) {}

    get fs(): Lg2FS {
        if (!this.module) {
            throw new Error("wasm-git module is not initialized");
        }
        return this.module.FS;
    }

    get initialized(): boolean {
        return this.module != undefined;
    }

    async init(): Promise<void> {
        if (this.module) return;
        // wasm-git only wraps `callMain` to await Asyncify completion when it
        // detects a web environment. Obsidian always provides `window`, and
        // the Vitest setup defines it as well, but fail fast if it's absent
        // because without the wrapper every network command would return
        // before it actually finished.
        if (!("window" in globalThis)) {
            throw new Error(
                "wasm-git requires a window global for the async callMain wrapper"
            );
        }
        const module = await initLg2({
            print: (text) => {
                this.stdout.push(text);
                this.progressHandler?.(text);
            },
            printErr: (text) => this.stderr.push(text),
            instantiateWasm: (imports, successCallback) => {
                // Instantiate from the embedded bytes instead of letting
                // Emscripten fetch `lg2_async.wasm` from disk/network:
                // Obsidian plugins are distributed as a single main.js.
                void WebAssembly.instantiate(getWasmBinaryCopy(), imports)
                    .then((result) =>
                        successCallback(result.instance, result.module)
                    )
                    .catch((error) => {
                        console.error(
                            "obsidian-git: failed to instantiate wasm-git",
                            error
                        );
                        throw error;
                    });
                return {};
            },
        });
        this.httpBridge.attach(module);
        module.FS.writeFile(
            "/home/web_user/.gitconfig",
            // Placeholder identity so lg2 commands that require a signature
            // fail with a clear message instead of a generic one. The real
            // identity lives in the repository config (user.name/user.email).
            "[core]\n\tautocrlf = false\n"
        );
        this.module = module;
    }

    /**
     * Runs one lg2 command with the given working directory and returns the
     * captured stdout/stderr. Rejects with {@link Lg2Error} when the command
     * reported a failure.
     */
    async run(
        cwd: string,
        args: string[],
        opts?: {
            /** Do not throw on detected errors; caller inspects the output. */
            ignoreErrors?: boolean;
            /** Receives every stdout line as it is printed (for progress). */
            onProgress?: (line: string) => void;
        }
    ): Promise<Lg2Result> {
        const exec = async (): Promise<Lg2Result> => {
            if (!this.module) {
                throw new Error("wasm-git module is not initialized");
            }
            this.stdout = [];
            this.stderr = [];
            this.progressHandler = opts?.onProgress;
            this.httpBridge.resetError();
            try {
                this.module.FS.chdir(cwd);
                await this.module.callMain(args);
            } catch (error) {
                this.stderr.push(
                    "THROW: " +
                        (error instanceof Error ? error.message : String(error))
                );
            } finally {
                this.progressHandler = undefined;
            }
            const result: Lg2Result = {
                stdout: this.stdout.join("\n"),
                stderr: this.stderr.join("\n"),
            };
            const httpError = this.httpBridge.takeError();
            if (httpError && !opts?.ignoreErrors) {
                throw httpError;
            }
            if (!opts?.ignoreErrors && containsLg2Error(result.stderr)) {
                throw new Lg2Error(args, result.stdout, result.stderr);
            }
            return result;
        };
        const chained = this.queue.then(exec, exec);
        // Keep the queue alive independently of whether the caller handles
        // the rejection, so one failed command can't wedge all later ones.
        this.queue = chained.catch(() => {});
        return chained;
    }

    unload(): void {
        // Emscripten instances cannot be torn down explicitly; dropping every
        // reference lets the wasm memory be garbage collected.
        this.module = undefined;
        this.queue = Promise.resolve();
    }
}

function getWasmBinaryCopy(): Uint8Array {
    // Defensive copy: WebAssembly.instantiate may detach or the esbuild
    // binary loader may share the buffer between plugin reloads.
    return new Uint8Array(wasmBinary);
}
