import { spawn } from "child_process";
import http from "http";
import type { AddressInfo } from "net";

export type GitHttpServer = {
    /** Base URL of the server; repositories are served as `${url}/<name>`. */
    url: string;
    close(): Promise<void>;
};

/**
 * Serves every git repository under `rootDir` over smart HTTP by delegating
 * each request to `git http-backend` (the reference CGI implementation).
 * Push is enabled; there is no authentication unless `credentials` is given,
 * in which case requests must carry a matching Basic Authorization header.
 */
export async function startGitHttpServer(
    rootDir: string,
    credentials?: { username: string; password: string }
): Promise<GitHttpServer> {
    const server = http.createServer((req, res) => {
        if (credentials) {
            const expected =
                "Basic " +
                Buffer.from(
                    `${credentials.username}:${credentials.password}`
                ).toString("base64");
            if (req.headers.authorization !== expected) {
                res.writeHead(401, {
                    "WWW-Authenticate": 'Basic realm="test"',
                });
                res.end("Unauthorized");
                return;
            }
        }
        const url = new URL(req.url!, "http://localhost");
        const backend = spawn("git", ["http-backend"], {
            env: {
                ...process.env,
                GIT_PROJECT_ROOT: rootDir,
                GIT_HTTP_EXPORT_ALL: "1",
                PATH_INFO: decodeURIComponent(url.pathname),
                QUERY_STRING: url.searchParams.toString(),
                REQUEST_METHOD: req.method!,
                CONTENT_TYPE: req.headers["content-type"] ?? "",
                CONTENT_LENGTH: req.headers["content-length"] ?? "",
                HTTP_CONTENT_ENCODING: req.headers["content-encoding"] ?? "",
                REMOTE_USER: credentials?.username ?? "",
                REMOTE_ADDR: "127.0.0.1",
            },
        });
        req.pipe(backend.stdin);

        // git http-backend speaks CGI: parse the header block it prints
        // before streaming the remaining bytes as the response body.
        let headerBuffer = Buffer.alloc(0);
        let headersDone = false;
        backend.stdout.on("data", (chunk: Buffer) => {
            if (headersDone) {
                res.write(chunk);
                return;
            }
            headerBuffer = Buffer.concat([headerBuffer, chunk]);
            const headerEnd = headerBuffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) return;
            const headerText = headerBuffer.subarray(0, headerEnd).toString();
            let status = 200;
            const headers: Record<string, string> = {};
            for (const line of headerText.split("\r\n")) {
                const colon = line.indexOf(":");
                if (colon === -1) continue;
                const name = line.substring(0, colon).trim();
                const value = line.substring(colon + 1).trim();
                if (name.toLowerCase() === "status") {
                    status = parseInt(value);
                } else {
                    headers[name] = value;
                }
            }
            res.writeHead(status, headers);
            res.write(headerBuffer.subarray(headerEnd + 4));
            headersDone = true;
        });
        backend.stdout.on("end", () => {
            if (!headersDone) {
                res.writeHead(500);
            }
            res.end();
        });
        backend.on("error", () => {
            if (!headersDone) {
                res.writeHead(500);
                headersDone = true;
            }
            res.end();
        });
    });

    await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
    );
    const port = (server.address() as AddressInfo).port;
    return {
        url: `http://127.0.0.1:${port}`,
        close: () =>
            new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            ),
    };
}
