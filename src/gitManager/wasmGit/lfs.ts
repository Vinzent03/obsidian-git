import { sha256 } from "js-sha256";
import { requestUrl } from "obsidian";
import { NoNetworkError } from "../../types";
import { HttpStatusError } from "./httpBridge";

export const LFS_POINTER_VERSION = "https://git-lfs.github.com/spec/v1";

export interface LfsPointer {
    sha256: string;
    size: number;
}

export interface LfsAttributeRule {
    pattern: string;
    /** `lfs` when the path is tracked; undefined when the filter is unset. */
    filter: string | undefined;
}

export function parseLfsPointer(content: string): LfsPointer | undefined {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    if (lines[0] !== `version ${LFS_POINTER_VERSION}`) return undefined;
    let sha: string | undefined;
    let size: number | undefined;
    for (const line of lines.slice(1)) {
        if (line.length === 0) continue;
        const oid = line.match(/^oid sha256:([0-9a-f]{64})$/);
        if (oid) {
            sha = oid[1];
            continue;
        }
        const sizeMatch = line.match(/^size (\d+)$/);
        if (sizeMatch) {
            size = parseInt(sizeMatch[1]!, 10);
        }
    }
    if (sha == undefined || size == undefined) return undefined;
    return { sha256: sha, size };
}

export function serializeLfsPointer(hash: string, size: number): string {
    return (
        `version ${LFS_POINTER_VERSION}\n` +
        `oid sha256:${hash}\n` +
        `size ${size}\n`
    );
}

export function hashLfsContent(data: Uint8Array): string {
    return sha256(data);
}

export function parseGitAttributes(content: string): LfsAttributeRule[] {
    const rules: LfsAttributeRule[] = [];
    for (const raw of content.split("\n")) {
        const line = raw.trim();
        if (line.length === 0 || line.startsWith("#")) continue;
        const parts = line.split(/\s+/);
        const pattern = parts[0];
        if (pattern == undefined) continue;
        let filter: string | undefined;
        let sawFilter = false;
        for (const part of parts.slice(1)) {
            if (part === "-filter") {
                sawFilter = true;
                filter = undefined;
                continue;
            }
            const match = part.match(/^filter=(.*)$/);
            if (match) {
                sawFilter = true;
                filter = match[1] === "" ? undefined : match[1];
            }
        }
        if (sawFilter) {
            rules.push({ pattern, filter });
        }
    }
    return rules;
}

export function isLfsTracked(
    repoPath: string,
    rules: LfsAttributeRule[]
): boolean {
    let tracked = false;
    for (const rule of rules) {
        if (pathMatchesGitAttribute(repoPath, rule.pattern)) {
            tracked = rule.filter === "lfs";
        }
    }
    return tracked;
}

/**
 * Git-attribute glob: a pattern without `/` matches in any directory;
 * `*` is one path segment; `**` crosses directories.
 */
export function pathMatchesGitAttribute(
    repoPath: string,
    pattern: string
): boolean {
    const normalized = repoPath.replace(/^\/+/, "");
    let source = pattern;
    if (source.startsWith("/")) source = source.slice(1);
    const matchAnywhere = !pattern.includes("/");
    let regex = "^";
    if (matchAnywhere) regex += "(?:.*/)?";
    for (let i = 0; i < source.length; i++) {
        const char = source[i]!;
        if (char === "*" && source[i + 1] === "*") {
            regex += ".*";
            i += 1;
            if (source[i + 1] === "/") i += 1;
            continue;
        }
        if (char === "*") {
            regex += "[^/]*";
            continue;
        }
        if (char === "?") {
            regex += "[^/]";
            continue;
        }
        if ("\\^$+.=!|[](){}".includes(char)) {
            regex += `\\${char}`;
            continue;
        }
        regex += char;
    }
    regex += "$";
    return new RegExp(regex).test(normalized);
}

export function parseLfsConfigUrl(content: string): string | undefined {
    let inLfs = false;
    for (const raw of content.split("\n")) {
        const line = raw.trim();
        if (line.length === 0 || line.startsWith("#")) continue;
        const section = line.match(/^\[([^\]]+)\]$/);
        if (section) {
            inLfs = section[1]!.replace(/"/g, "").trim() === "lfs";
            continue;
        }
        if (!inLfs) continue;
        const url = line.match(/^url\s*=\s*(.+)$/);
        if (url) return url[1]!.trim();
    }
    return undefined;
}

export function lfsBatchEndpoint(
    remoteUrl: string,
    configuredUrl?: string
): string {
    if (configuredUrl != undefined && configuredUrl.length > 0) {
        return `${configuredUrl.replace(/\/$/, "")}/objects/batch`;
    }
    const base = remoteUrl.replace(/\/$/, "");
    const withGit = base.endsWith(".git") ? base : `${base}.git`;
    return `${withGit}/info/lfs/objects/batch`;
}

export async function lfsBatch(
    endpoint: string,
    operation: "upload" | "download",
    objects: LfsPointer[],
    getAuthHeader: () => string | undefined
): Promise<LfsBatchObject[]> {
    if (objects.length === 0) return [];
    const headers: Record<string, string> = {
        Accept: "application/vnd.git-lfs+json",
        "Content-Type": "application/vnd.git-lfs+json",
    };
    const auth = getAuthHeader();
    if (auth) headers["Authorization"] = auth;
    const response = await lfsRequest(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
            operation,
            transfers: ["basic"],
            objects: objects.map((object) => ({
                oid: object.sha256,
                size: object.size,
            })),
        }),
    });
    const parsed = JSON.parse(response.text) as { objects?: LfsBatchObject[] };
    return parsed.objects ?? [];
}

export async function lfsTransfer(
    href: string,
    method: "GET" | "PUT",
    headers: Record<string, string> | undefined,
    body: ArrayBuffer | undefined,
    getAuthHeader: () => string | undefined
): Promise<Uint8Array> {
    const requestHeaders: Record<string, string> = { ...headers };
    const auth = getAuthHeader();
    if (auth && requestHeaders["Authorization"] == undefined) {
        requestHeaders["Authorization"] = auth;
    }
    const response = await lfsRequest(href, {
        method,
        headers: requestHeaders,
        body,
    });
    return new Uint8Array(response.arrayBuffer);
}

export interface LfsBatchObject {
    oid: string;
    size: number;
    actions?: {
        upload?: { href: string; header?: Record<string, string> };
        download?: { href: string; header?: Record<string, string> };
    };
    error?: { code: number; message: string };
}

async function lfsRequest(
    url: string,
    opts: {
        method: string;
        headers: Record<string, string>;
        body?: string | ArrayBuffer;
    }
): Promise<{ status: number; text: string; arrayBuffer: ArrayBuffer }> {
    let response;
    try {
        response = await requestUrl({
            url,
            method: opts.method,
            headers: opts.headers,
            body: opts.body,
            throw: false,
        });
    } catch (error) {
        throw new NoNetworkError(
            error instanceof Error ? error.message : String(error)
        );
    }
    if (response.status >= 400) {
        throw new HttpStatusError(response.status, url);
    }
    return {
        status: response.status,
        text: response.text,
        arrayBuffer: response.arrayBuffer,
    };
}
