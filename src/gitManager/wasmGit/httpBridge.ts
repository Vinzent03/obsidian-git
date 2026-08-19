import { requestUrl } from "obsidian";
import type { Lg2Module } from "wasm-git/lg2_async.js";
import { NoNetworkError } from "../../types";

export class HttpStatusError extends Error {
    constructor(
        public readonly status: number,
        public readonly url: string
    ) {
        super(`HTTP ${status} for ${url}`);
    }

    get isAuthFailure(): boolean {
        return this.status === 401 || this.status === 403;
    }
}

interface HttpConnection {
    url: string;
    method: string;
    headers: Record<string, string>;
    requestChunks: Uint8Array[];
    response: Uint8Array | undefined;
    readOffset: number;
    failed: boolean;
}

/**
 * Bridges wasm-git's libgit2 smart-HTTP subtransport to Obsidian's
 * `requestUrl`. The patched libgit2 calls the `emscriptenhttp*` hooks on the
 * Emscripten module; this class installs implementations that buffer the
 * request body, perform one HTTP request per stream, and replay the response.
 *
 * The hooks must never reject: an escaped rejection would leave the Asyncify
 * state machine suspended and corrupt every later command. Failures are
 * recorded on the bridge and surfaced as an EOF to libgit2, which then fails
 * the git command; {@link Lg2.run} rethrows the recorded error afterwards.
 */
export class WasmGitHttpBridge {
    private connections = new Map<number, HttpConnection>();
    private nextConnectionNo = 1;
    private lastError: Error | undefined;

    /**
     * Returns the value for the HTTP `Authorization` header, or undefined
     * when no credentials are configured.
     */
    getAuthHeader: () => string | undefined = () => undefined;

    attach(module: Lg2Module): void {
        // Assigned after module initialization on purpose: the bundled
        // post.js installs XHR-based defaults with Object.assign at the end
        // of startup, so earlier assignments would be overwritten.
        module.emscriptenhttpconnect = (url, _bufferSize, method, headers) => {
            const connectionNo = this.nextConnectionNo++;
            this.connections.set(connectionNo, {
                url,
                method: method ?? "GET",
                headers: headers ?? {},
                requestChunks: [],
                response: undefined,
                readOffset: 0,
                failed: false,
            });
            return Promise.resolve(connectionNo);
        };
        module.emscriptenhttpwrite = (connectionNo, buffer, length) => {
            const connection = this.connections.get(connectionNo);
            if (!connection) return;
            connection.requestChunks.push(
                module.HEAPU8.slice(buffer, buffer + length)
            );
        };
        module.emscriptenhttpread = async (
            connectionNo,
            buffer,
            bufferSize
        ) => {
            const connection = this.connections.get(connectionNo);
            if (!connection || connection.failed) return 0;
            if (!connection.response) {
                try {
                    connection.response = await this.performRequest(connection);
                } catch (error) {
                    connection.failed = true;
                    this.lastError =
                        error instanceof Error
                            ? error
                            : new Error(String(error));
                    return 0;
                }
            }
            const remaining =
                connection.response.length - connection.readOffset;
            const bytesToCopy = Math.min(remaining, bufferSize);
            module.HEAPU8.set(
                connection.response.subarray(
                    connection.readOffset,
                    connection.readOffset + bytesToCopy
                ),
                buffer
            );
            connection.readOffset += bytesToCopy;
            return bytesToCopy;
        };
        module.emscriptenhttpfree = (connectionNo) => {
            this.connections.delete(connectionNo);
        };
    }

    resetError(): void {
        this.lastError = undefined;
    }

    takeError(): Error | undefined {
        const error = this.lastError;
        this.lastError = undefined;
        return error;
    }

    private async performRequest(
        connection: HttpConnection
    ): Promise<Uint8Array> {
        const headers: Record<string, string> = {
            // Ask the server not to compress the response. The packfile
            // parser needs the exact raw bytes; if a server or proxy gzips
            // the response and the platform does not transparently inflate
            // it, the packfile is persisted corrupted.
            "Accept-Encoding": "identity",
            ...connection.headers,
        };
        const authHeader = this.getAuthHeader();
        if (authHeader) {
            headers["Authorization"] = authHeader;
        }
        let body: ArrayBuffer | undefined;
        if (connection.requestChunks.length > 0) {
            body = concatChunks(connection.requestChunks);
        }

        let response;
        try {
            response = await requestUrl({
                url: connection.url,
                method: connection.method,
                headers,
                body,
                throw: false,
            });
        } catch (error) {
            throw new NoNetworkError(
                error instanceof Error ? error.message : String(error)
            );
        }
        if (response.status >= 400) {
            throw new HttpStatusError(response.status, connection.url);
        }
        const inflated = await inflateIfGzipped(response.arrayBuffer);
        return new Uint8Array(inflated);
    }
}

function concatChunks(chunks: Uint8Array[]): ArrayBuffer {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    return merged.buffer;
}

// If `buffer` starts with the gzip magic bytes (0x1f 0x8b), inflate it and
// return the decompressed bytes; otherwise return it unchanged. A valid git
// smart-HTTP response body never starts with those bytes (it begins with an
// ASCII pkt-line length or "PACK"), so this check is unambiguous. Keyed on the
// content rather than the `Content-Encoding` header because some platforms
// transparently inflate the body while leaving the header in place.
async function inflateIfGzipped(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
        return buffer;
    }
    try {
        const stream = new Blob([buffer])
            .stream()
            .pipeThrough(new DecompressionStream("gzip"));
        return await new Response(stream).arrayBuffer();
    } catch {
        // If decompression is unavailable or fails, fall back to the original
        // bytes so behavior is no worse than before.
        return buffer;
    }
}
