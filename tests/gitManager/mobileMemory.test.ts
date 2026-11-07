import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import git from "isomorphic-git";
import { createPatch } from "diff";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withCleanup } from "../helpers/cleanup";
import { createRepoWithOrigin } from "../helpers/gitRepo";
import { createIsomorphicGitManager } from "../helpers/isomorphicGit";

afterEach(() => vi.restoreAllMocks());

function trackBinaryReads(
    context: ReturnType<typeof createIsomorphicGitManager>
) {
    const adapter = context.plugin.app.vault.adapter;
    const read = adapter.readBinary.bind(adapter);
    let activeWorktreeReads = 0;
    let peakWorktreeReads = 0;
    let packReads = 0;
    vi.spyOn(adapter, "readBinary").mockImplementation(async (file) => {
        const worktree = !file.replace(/^\/+/, "").startsWith(".git/");
        if (file.endsWith(".pack")) packReads++;
        if (worktree) {
            activeWorktreeReads++;
            peakWorktreeReads = Math.max(
                peakWorktreeReads,
                activeWorktreeReads
            );
        }
        try {
            const data = await read(file);
            await setTimeout(5);
            return data;
        } finally {
            if (worktree) activeWorktreeReads--;
        }
    });
    return () => ({ packReads, peakWorktreeReads });
}

describe("mobile operation memory", () => {
    it.each([false, true])(
        "unstages packed files with one cache and preserves working edits (supplied status: %s)",
        async (suppliedStatus) => {
            const repo = withCleanup(await createRepoWithOrigin());
            const files = Array.from({ length: 4 }, (_, i) => `file-${i}.md`);
            for (const file of files) repo.write(file, "base\n");
            await repo.git.add(".");
            await repo.git.commit("files");
            await repo.raw(["gc", "--prune=now"]);
            for (const file of files) repo.write(file, "staged\n");
            await repo.git.add(".");
            for (const file of files) repo.write(file, "unstaged\n");
            const context = createIsomorphicGitManager(repo.repoPath);
            const status = suppliedStatus
                ? await context.manager.status()
                : undefined;
            const reads = trackBinaryReads(context);

            await context.manager.unstageAll({ status });

            expect(await repo.cachedDiffNames()).toBe("");
            for (const file of files) {
                expect(
                    await readFile(path.join(repo.repoPath, file), "utf8")
                ).toBe("unstaged\n");
            }
            expect(reads().packReads).toBe(1);
            expect(reads().peakWorktreeReads).toBe(1);
        },
        20000
    );

    it("shares a cache across both sides of a historical diff", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.appendAndCommit("note.md", "changed\n", "change");
        const hash = await repo.head();
        await repo.raw(["gc", "--prune=now"]);
        const context = createIsomorphicGitManager(repo.repoPath);
        const reads = trackBinaryReads(context);

        const diff = await context.manager.getDiffString(
            "note.md",
            false,
            hash
        );

        expect(diff).toContain("+changed\n");
        expect(reads().packReads).toBe(1);
        // A new request must not retain the previous cache.
        await context.manager.getDiffString("note.md", false, hash);
        expect(reads().packReads).toBe(2);
    }, 15000);

    it("shares a cache between staged content and HEAD in a staged diff", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.appendAndCommit("note.md", "staged\n", "packed staged blob");
        const hash = await repo.head();
        await repo.raw(["reset", "--soft", "HEAD^"]);
        await repo.raw(["gc", "--prune=now"]);
        const context = createIsomorphicGitManager(repo.repoPath);
        const reads = trackBinaryReads(context);

        const diff = await context.manager.getDiffString("note.md", true);

        expect(diff).toContain("+staged\n");
        expect(reads().packReads).toBe(1);
        expect(await repo.head()).not.toBe(hash);
    }, 15000);

    it.each(["checkout", "pull", "discardAll"] as const)(
        "%s materializes files one at a time",
        async (operation) => {
            const repo = withCleanup(await createRepoWithOrigin());
            const files = Array.from({ length: 4 }, (_, i) => `file-${i}.md`);
            for (const file of files) repo.write(file, "base\n");
            await repo.git.add(".");
            await repo.git.commit("files");
            const before = await repo.head();
            for (const file of files) repo.write(file, "remote\n");
            await repo.git.add(".");
            await repo.git.commit("changes");
            const after = await repo.head();
            if (operation === "discardAll") {
                for (const file of files) repo.write(file, "dirty\n");
            } else {
                await repo.raw(["reset", "--hard", before]);
                await repo.raw([
                    "update-ref",
                    "refs/remotes/origin/main",
                    after,
                ]);
            }
            const { manager, plugin } = createIsomorphicGitManager(
                repo.repoPath
            );
            vi.spyOn(manager, "fetch").mockResolvedValue();
            const vault = plugin.app.vault;
            const create = vault.createBinary.bind(vault);
            let active = 0;
            let peak = 0;
            vi.spyOn(vault, "createBinary").mockImplementation(
                async (file, data) => {
                    active++;
                    peak = Math.max(peak, active);
                    try {
                        await setTimeout(5);
                        return await create(file, data);
                    } finally {
                        active--;
                    }
                }
            );

            if (operation === "checkout") await manager.checkout(after);
            else if (operation === "pull") await manager.pull();
            else await manager.discardAll({});

            expect(peak).toBe(1);
            expect(await repo.head()).toBe(after);
            for (const file of files) {
                expect(
                    await readFile(path.join(repo.repoPath, file), "utf8")
                ).toBe("remote\n");
            }
            expect(await repo.cachedDiffNames()).toBe("");
        },
        20000
    );

    it("reads files serially when staging a directory", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        for (let i = 0; i < 4; i++) repo.write(`folder/file-${i}.md`, "new\n");
        const context = createIsomorphicGitManager(repo.repoPath);
        const reads = trackBinaryReads(context);

        await context.manager.stage("folder", false);

        expect((await repo.cachedDiffNames()).split("\n")).toHaveLength(4);
        expect(reads().peakWorktreeReads).toBe(1);
    }, 15000);

    it("flushes completed resets and stops after an unstaging failure", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        for (const file of ["a.md", "b.md", "c.md"]) repo.write(file, "base\n");
        await repo.git.add(".");
        await repo.git.commit("files");
        for (const file of ["a.md", "b.md", "c.md"])
            repo.write(file, "changed\n");
        await repo.git.add(".");
        const { manager } = createIsomorphicGitManager(repo.repoPath);
        const status = await manager.status();
        const reset = git.resetIndex;
        const error = new Error("reset failed");
        const resetSpy = vi
            .spyOn(git, "resetIndex")
            .mockImplementation((options) => {
                if (options.filepath === "b.md") return Promise.reject(error);
                return reset(options);
            });

        await expect(manager.unstageAll({ status })).rejects.toBe(error);

        expect(
            resetSpy.mock.calls.map(([options]) => options.filepath)
        ).toEqual(["a.md", "b.md"]);
        expect(await repo.cachedDiffNames()).toBe("b.md\nc.md");
        expect(manager.getRepo().fs.index).toBeUndefined();
        expect(await readFile(path.join(repo.repoPath, "a.md"), "utf8")).toBe(
            "changed\n"
        );
    }, 15000);

    it("preserves historical patches for initial, added, and deleted files", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager } = createIsomorphicGitManager(repo.repoPath);
        expect(
            await manager.getDiffString("note.md", false, await repo.head())
        ).toBe(createPatch("note.md", "", "base\n"));
        await repo.writeAndCommit("added.md", "added\n", "add");
        expect(
            await manager.getDiffString("added.md", false, await repo.head())
        ).toBe(createPatch("added.md", "", "added\n"));
        repo.remove("added.md");
        await repo.git.add(".");
        await repo.git.commit("delete");
        expect(
            await manager.getDiffString("added.md", false, await repo.head())
        ).toBe(createPatch("added.md", "added\n", ""));
    }, 15000);

    it("propagates historical commit read failures", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager } = createIsomorphicGitManager(repo.repoPath);
        const error = new Error("read failed");
        vi.spyOn(git, "readCommit").mockRejectedValue(error);
        await expect(
            manager.getDiffString("note.md", false, await repo.head())
        ).rejects.toBe(error);
    }, 15000);

    it("unstages additions and deletions only within the requested folder", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.writeAndCommit(
            "folder/deleted.md",
            "base\n",
            "tracked file"
        );
        repo.remove("folder/deleted.md");
        repo.write("folder/added.md", "new\n");
        repo.write("outside.md", "keep staged\n");
        await repo.git.add(".");
        const { manager } = createIsomorphicGitManager(repo.repoPath);

        await manager.unstageAll({ dir: "folder" });

        expect(await repo.cachedDiffNames()).toBe("outside.md");
        expect(
            await readFile(path.join(repo.repoPath, "folder/added.md"), "utf8")
        ).toBe("new\n");
        await expect(
            readFile(path.join(repo.repoPath, "folder/deleted.md"))
        ).rejects.toThrow();
    }, 15000);

    it("preserves executable index modes with batched checkout", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const before = await repo.head();
        await repo.raw(["update-index", "--chmod=+x", "note.md"]);
        await repo.git.commit("executable");
        const after = await repo.head();
        await repo.raw(["reset", "--hard", before]);
        const { manager } = createIsomorphicGitManager(repo.repoPath);

        await manager.checkout(after);

        expect(await repo.head()).toBe(after);
        expect(await repo.raw(["ls-files", "--stage", "note.md"])).toMatch(
            /^100755 /
        );
        expect(
            await readFile(path.join(repo.repoPath, "note.md"), "utf8")
        ).toBe("base\n");
    }, 15000);

    it("does not advance HEAD or notify refs when a batched pull write fails", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const before = await repo.head();
        await repo.appendAndCommit("note.md", "remote\n", "remote change");
        const after = await repo.head();
        await repo.raw(["reset", "--hard", before]);
        await repo.raw(["update-ref", "refs/remotes/origin/main", after]);
        const { manager, plugin } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();
        const error = new Error("write failed");
        vi.spyOn(plugin.app.vault, "createBinary").mockRejectedValue(error);
        vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(manager.pull()).rejects.toThrow(/multiple errors/i);

        expect(await repo.head()).toBe(before);
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalledWith(
            "obsidian-git:refs-changed"
        );
        expect(manager.getRepo().fs.index).toBeUndefined();
    }, 15000);

    it("clones through smart HTTP with one working-file write at a time", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        for (let i = 0; i < 4; i++) repo.write(`file-${i}.md`, "remote\n");
        await repo.git.add(".");
        await repo.git.commit("files");
        const destination = path.join(repo.dir, "clone");
        await mkdir(destination);
        const { manager, plugin } = createIsomorphicGitManager(destination);
        const getRepo = manager.getRepo.bind(manager);
        vi.spyOn(manager, "getRepo").mockImplementation(() => ({
            ...getRepo(),
            http: {
                async request({ url, method, body }) {
                    const advertise = method === "GET";
                    const chunks: Uint8Array[] = [];
                    if (body)
                        for await (const chunk of body) chunks.push(chunk);
                    const data = await new Promise<Buffer>(
                        (resolve, reject) => {
                            const child = execFile(
                                "git",
                                [
                                    "upload-pack",
                                    "--stateless-rpc",
                                    ...(advertise ? ["--advertise-refs"] : []),
                                    repo.repoPath,
                                ],
                                { encoding: "buffer" },
                                (error, stdout) => {
                                    if (error instanceof Error) reject(error);
                                    else if (error)
                                        reject(
                                            new Error("git upload-pack failed")
                                        );
                                    else resolve(stdout);
                                }
                            );
                            child.stdin?.end(Buffer.concat(chunks));
                        }
                    );
                    const payload = advertise
                        ? Buffer.concat([
                              Buffer.from(
                                  "001e# service=git-upload-pack\n0000"
                              ),
                              data,
                          ])
                        : data;
                    return {
                        url,
                        method,
                        statusCode: 200,
                        statusMessage: "OK",
                        headers: {
                            "content-type": advertise
                                ? "application/x-git-upload-pack-advertisement"
                                : "application/x-git-upload-pack-result",
                        },
                        body: (async function* () {
                            yield await Promise.resolve(payload);
                        })(),
                    };
                },
            },
        }));
        const vault = plugin.app.vault;
        const create = vault.createBinary.bind(vault);
        let active = 0;
        let peak = 0;
        vi.spyOn(vault, "createBinary").mockImplementation(
            async (file, data) => {
                active++;
                peak = Math.max(peak, active);
                try {
                    await setTimeout(5);
                    return await create(file, data);
                } finally {
                    active--;
                }
            }
        );

        await manager.clone("https://example.com/vault.git", "/", 1);

        expect(peak).toBe(1);
        expect(await manager.resolveRef("HEAD")).toBe(await repo.head());
        for (let i = 0; i < 4; i++) {
            expect(
                await readFile(path.join(destination, `file-${i}.md`), "utf8")
            ).toBe("remote\n");
        }
        expect(await manager.getConfig("branch.main.remote")).toBe("origin");
    }, 20000);
});
