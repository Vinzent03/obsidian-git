import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASK_PASS_SCRIPT, ASK_PASS_SCRIPT_FILE } from "../../src/constants";
import { AskpassServer } from "../../src/gitManager/askpassServer";
import { createFakePlugin } from "../helpers/createFakePlugin";
import {
    cleanupTempDirectory,
    createRepoWithOrigin,
    createTempDirectory,
} from "../helpers/gitRepo";
import { createSimpleGitTestContext } from "../helpers/simpleGit";

const modal = vi.hoisted(() => ({
    open: vi.fn(),
    close: vi.fn(),
    configs: [] as { obscure: boolean; placeholder: string }[],
}));
vi.mock("../../src/ui/modals/generalModal", () => ({
    GeneralModal: class {
        constructor(
            _plugin: unknown,
            config: { obscure: boolean; placeholder: string }
        ) {
            modal.configs.push(config);
        }
        openAndGetResult = modal.open;
        close = modal.close;
    },
}));

function send(port: number, token: string, prompt: string): Promise<Response> {
    return fetch(`http://127.0.0.1:${port}/askpass`, {
        method: "POST",
        body: `${token}\n${prompt}`,
    });
}

function runScript(port: number, token: string, prompt: string) {
    return new Promise<{ code: number | null; stdout: string }>(
        (resolve, reject) => {
            const child = spawn(
                "sh",
                ["-c", ASK_PASS_SCRIPT, "askpass", prompt],
                {
                    env: {
                        ...process.env,
                        OBSIDIAN_GIT_ASKPASS_PORT: `${port}`,
                        OBSIDIAN_GIT_ASKPASS_TOKEN: token,
                    },
                }
            );
            let stdout = "";
            child.stdout.on("data", (data: Buffer) => {
                stdout += data.toString();
            });
            child.on("error", reject);
            child.on("close", (code) => resolve({ code, stdout }));
        }
    );
}

describe("askpass socket bridge", () => {
    const servers: AskpassServer[] = [];

    beforeEach(() => {
        vi.clearAllMocks();
        modal.configs.length = 0;
        modal.open.mockResolvedValue("answer");
    });
    afterEach(() => {
        for (const server of servers) server.stop();
        servers.length = 0;
    });

    async function start() {
        const plugin = createFakePlugin();
        const server = new AskpassServer(plugin);
        servers.push(server);
        return { ...(await server.start()), server, plugin };
    }

    it("returns the chosen answer and distinguishes an empty answer from cancellation", async () => {
        const { port, token } = await start();
        const username = await send(port, token, "Username for 'host':");
        expect(username.status).toBe(200);
        expect(await username.text()).toBe("answer\n");
        expect(modal.configs[0]?.obscure).toBe(false);

        modal.open.mockResolvedValueOnce("");
        const empty = await send(port, token, "Password for 'host':");
        expect(empty.status).toBe(200);
        expect(await empty.text()).toBe("\n");
        expect(modal.configs[1]?.obscure).toBe(true);

        modal.open.mockResolvedValueOnce(undefined);
        const cancelled = await send(port, token, "Password:");
        expect(cancelled.status).toBe(409);
        expect(await cancelled.text()).toBe("");
    });

    it("rejects requests without the session token before opening a modal", async () => {
        const { port } = await start();
        const response = await send(port, "wrong", "Password:");
        expect(response.status).toBe(403);
        expect(modal.open).not.toHaveBeenCalled();
    });

    it("shows only one prompt at a time", async () => {
        const { port, token } = await start();
        let finishFirst!: (answer: string) => void;
        modal.open.mockImplementationOnce(
            () =>
                new Promise<string>((resolve) => {
                    finishFirst = resolve;
                })
        );
        const first = send(port, token, "First prompt");
        await vi.waitFor(() => expect(modal.open).toHaveBeenCalledTimes(1));
        const second = send(port, token, "Second prompt");
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(modal.open).toHaveBeenCalledTimes(1);
        finishFirst("first");
        expect(await (await first).text()).toBe("first\n");
        expect(await (await second).text()).toBe("answer\n");
        expect(modal.open).toHaveBeenCalledTimes(2);
    });

    it("ends a pending request and closes its modal on unload", async () => {
        const { port, token, server } = await start();
        let finish!: (answer: undefined) => void;
        modal.open.mockImplementation(
            () =>
                new Promise<undefined>((resolve) => {
                    finish = resolve;
                })
        );
        modal.close.mockImplementation(() => finish(undefined));
        const pending = send(port, token, "Password:");
        await vi.waitFor(() => expect(modal.open).toHaveBeenCalledTimes(1));
        server.stop();
        expect((await pending).status).toBe(503);
        expect(modal.close).toHaveBeenCalledTimes(1);
    });

    it("does not leave a listener running when stopped during startup", async () => {
        const server = new AskpassServer(createFakePlugin());
        servers.push(server);
        const starting = server.start();
        server.stop();
        await expect(starting).rejects.toThrow("stopped during startup");
    });

    it("passes a prompt through the shell helper without writing a credential file", async () => {
        const { port, token } = await start();
        const result = await runScript(port, token, "Password for 'host':");
        expect(result).toEqual({ code: 0, stdout: "answer\n" });
        expect(modal.configs[0]?.placeholder).toBe("Password for 'host':");

        modal.open.mockResolvedValueOnce(undefined);
        const cancelled = await runScript(port, token, "Password:");
        expect(cancelled.code).not.toBe(0);
        expect(cancelled.stdout).toBe("");
    });

    it("answers native Git credential prompts through the socket", async () => {
        const { port, token } = await start();
        const vault = createTempDirectory("obsidian-git-askpass-test-");
        try {
            const pluginDir = path.join(
                vault,
                ".obsidian",
                "plugins",
                "obsidian-git"
            );
            mkdirSync(pluginDir, { recursive: true });
            const script = path.join(pluginDir, ASK_PASS_SCRIPT_FILE);
            writeFileSync(script, ASK_PASS_SCRIPT, { mode: 0o755 });
            modal.open
                .mockResolvedValueOnce("alice")
                .mockResolvedValueOnce("secret-token");

            const result = await new Promise<{
                code: number | null;
                stdout: string;
                stderr: string;
            }>((resolve, reject) => {
                const child = spawn(
                    "git",
                    ["-c", "credential.helper=", "credential", "fill"],
                    {
                        cwd: vault,
                        env: {
                            ...process.env,
                            GIT_ASKPASS: script,
                            GIT_TERMINAL_PROMPT: "0",
                            OBSIDIAN_GIT_ASKPASS_PORT: `${port}`,
                            OBSIDIAN_GIT_ASKPASS_TOKEN: token,
                        },
                    }
                );
                let stdout = "";
                let stderr = "";
                child.stdout.on("data", (data: Buffer) => {
                    stdout += data.toString();
                });
                child.stderr.on("data", (data: Buffer) => {
                    stderr += data.toString();
                });
                child.on("error", reject);
                child.on("close", (code) => resolve({ code, stdout, stderr }));
                child.stdin.end("protocol=https\nhost=example.com\n\n");
            });

            expect(result.code).toBe(0);
            expect(result.stderr).toBe("");
            expect(result.stdout).toContain("username=alice\n");
            expect(result.stdout).toContain("password=secret-token\n");
            expect(modal.open).toHaveBeenCalledTimes(2);
        } finally {
            cleanupTempDirectory(vault);
        }
    });

    it("installs the socket helper when SimpleGit initializes", async () => {
        vi.stubEnv("SSH_ASKPASS", undefined);
        try {
            const context = await createSimpleGitTestContext({
                fixture: async () => {
                    const repo = await createRepoWithOrigin();
                    mkdirSync(
                        path.join(
                            repo.repoPath,
                            ".obsidian",
                            "plugins",
                            "obsidian-git"
                        ),
                        { recursive: true }
                    );
                    return repo;
                },
                configurePlugin: (plugin) => {
                    plugin.localStorage.getEnvVars = () => [];
                },
            });
            try {
                await context.manager.setGitInstance();
                expect(
                    readFileSync(
                        path.join(
                            context.repo.repoPath,
                            ".obsidian",
                            "plugins",
                            "obsidian-git",
                            ASK_PASS_SCRIPT_FILE
                        ),
                        "utf8"
                    )
                ).toBe(ASK_PASS_SCRIPT);
            } finally {
                context.cleanup();
            }
        } finally {
            vi.unstubAllEnvs();
        }
    });
});
