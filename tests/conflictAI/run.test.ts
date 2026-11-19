import {
    appendFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { describe, expect, it, vi } from "vitest";
import { withCleanup } from "../helpers/cleanup";
import { createSimpleGitTestContext } from "../helpers/simpleGit";
import type { TestRepo } from "../helpers/gitRepo";

const complete = vi.hoisted(() =>
    vi.fn<(...args: string[]) => Promise<string>>()
);
vi.mock("../../src/conflictAI/claude", () => ({
    complete,
    ClaudeError: class ClaudeError extends Error {
        kind = "other";
    },
}));

import { resolveConflictsWithAi } from "../../src/conflictAI/run";

const reply = (resolved: string, confidence = "high") =>
    `<summary>test</summary>\n<confidence>${confidence}</confidence>\n<resolved>\n${resolved}\n</resolved>`;

async function setup() {
    const ctx = withCleanup(await createSimpleGitTestContext());
    const { repo, plugin } = ctx;
    const root = repo.repoPath;
    const adapter = {
        read: (p: string) =>
            Promise.resolve(readFileSync(path.join(root, p), "utf8")),
        write: (p: string, t: string) => {
            mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
            writeFileSync(path.join(root, p), t);
            return Promise.resolve();
        },
        remove: (p: string) => Promise.resolve(rmSync(path.join(root, p))),
        exists: (p: string) => Promise.resolve(existsSync(path.join(root, p))),
        getBasePath: () => root,
    };
    Object.assign(plugin.app, {
        vault: { configDir: ".obsidian", adapter },
        secretStorage: { getSecret: () => "key" },
    });
    Object.assign(plugin.settings, {
        syncMethod: "merge",
        mergeStrategy: "none",
        aiConflictResolution: true,
        aiConflictApiKeySecret: "secret",
        aiConflictModel: "m",
    });
    Object.assign(plugin, {
        displayMessage: vi.fn(),
        saveSettings: vi.fn(),
    });
    return ctx;
}

async function remoteCommit(
    repo: TestRepo,
    change: (dir: string, git: ReturnType<typeof simpleGit>) => Promise<void>
) {
    const dir = path.join(repo.dir, "remote-worktree");
    await simpleGit(repo.dir).raw(["clone", repo.remotePath, dir]);
    const git = simpleGit(dir);
    await git.addConfig("user.email", "r@example.com");
    await git.addConfig("user.name", "Remote");
    await change(dir, git);
    await git.commit("remote");
    await git.push(["--quiet"]);
}

describe("resolveConflictsWithAi", () => {
    it("resolves a text conflict, commits the merge and lets the sync continue", async () => {
        const { repo, plugin, manager } = await setup();
        await repo.writeAndCommit("note.md", "local\n", "local");
        await remoteCommit(repo, async (dir, git) => {
            writeFileSync(path.join(dir, "note.md"), "remote\n");
            await git.add("note.md");
        });
        complete.mockResolvedValue(reply("local\nremote"));

        await expect(manager.pull()).rejects.toMatchObject({
            name: "GitConflictError",
        });
        expect(await resolveConflictsWithAi(plugin)).toBe(1);

        expect(readFileSync(path.join(repo.repoPath, "note.md"), "utf8")).toBe(
            "local\nremote\n"
        );
        expect(await manager.isMergeInProgress()).toBe(false);
        expect((await manager.status()).conflicted).toEqual([]);
        expect(await repo.mergeCommitCount("origin/main~..HEAD")).toBe(1);
    });

    it("applies your edits to a file the other side moved", async () => {
        const { repo, plugin, manager } = await setup();
        const base = "one\ntwo\nthree\nfour\nfive\nsix\n";
        await repo.writeAndCommit("Old.md", base, "base notes");
        await repo.raw(["push", "--quiet"]);
        await repo.writeAndCommit("Old.md", base + "mine\n", "my edit");
        await remoteCommit(repo, async (dir, git) => {
            mkdirSync(path.join(dir, "Projects"));
            await git.raw(["mv", "Old.md", "Projects/New.md"]);
            // Enough new content that Git no longer detects the rename.
            appendFileSync(
                path.join(dir, "Projects/New.md"),
                Array.from(
                    { length: 30 },
                    (_, i) => `remote line number ${i}\n`
                ).join("")
            );
            await git.add("Projects/New.md");
        });
        complete.mockResolvedValue(reply(base + "mine\nremote"));

        await expect(manager.pull()).rejects.toMatchObject({
            name: "GitConflictError",
        });
        expect(await resolveConflictsWithAi(plugin)).toBe(1);

        expect(existsSync(path.join(repo.repoPath, "Old.md"))).toBe(false);
        expect(
            readFileSync(path.join(repo.repoPath, "Projects/New.md"), "utf8")
        ).toBe(base + "mine\nremote\n");
        expect(await manager.isMergeInProgress()).toBe(false);
    });

    it("resolves what it can and leaves only the failures to the user", async () => {
        const { repo, plugin, manager } = await setup();
        await repo.writeAndCommit("a.md", "base\n", "a");
        await repo.writeAndCommit("b.md", "base\n", "b");
        await repo.raw(["push", "--quiet"]);
        await repo.writeAndCommit("a.md", "local a\n", "local a");
        await repo.writeAndCommit("b.md", "local b\n", "local b");
        await remoteCommit(repo, async (dir, git) => {
            writeFileSync(path.join(dir, "a.md"), "remote a\n");
            writeFileSync(path.join(dir, "b.md"), "remote b\n");
            await git.add(["a.md", "b.md"]);
        });
        complete
            .mockResolvedValueOnce(reply("a merged"))
            .mockResolvedValueOnce("garbage");

        await expect(manager.pull()).rejects.toMatchObject({
            name: "GitConflictError",
        });
        expect(await resolveConflictsWithAi(plugin)).toBeNull();

        expect((await manager.status()).conflicted).toEqual(["b.md"]);
        expect(readFileSync(path.join(repo.repoPath, "a.md"), "utf8")).toBe(
            "a merged\n"
        );
        expect(await manager.isMergeInProgress()).toBe(true);
    });

    it("finishes a rebase, continuing through each conflicted commit", async () => {
        const { repo, plugin, manager } = await setup();
        plugin.settings.syncMethod = "rebase";
        plugin.settings.rebaseAutoStash = "disabled";
        await repo.writeAndCommit("note.md", "local\n", "local");
        await remoteCommit(repo, async (dir, git) => {
            writeFileSync(path.join(dir, "note.md"), "remote\n");
            await git.add("note.md");
        });
        complete.mockResolvedValue(reply("local\nremote"));

        await expect(manager.pull()).rejects.toMatchObject({
            name: "GitConflictError",
        });
        const out = await resolveConflictsWithAi(plugin);
        expect(out).toBe(1);

        expect(readFileSync(path.join(repo.repoPath, "note.md"), "utf8")).toBe(
            "local\nremote\n"
        );
        expect(await repo.statusPorcelain()).toBe("");
        expect(await repo.mergeCommitCount("origin/main..HEAD")).toBe(0);
        expect(await repo.unpushedCount()).toBe(1);
    });

    it("resolves a large file one conflict at a time", async () => {
        const { repo, plugin, manager } = await setup();
        const big = (a: string, b: string) =>
            Array.from({ length: 2000 }, (_, i) =>
                i === 10 ? a : i === 1500 ? b : `line ${i} ${"x".repeat(40)}`
            ).join("\n") + "\n";
        await repo.writeAndCommit(
            "big.md",
            big("ten", "fifteen hundred"),
            "big"
        );
        await repo.raw(["push", "--quiet"]);
        await repo.writeAndCommit(
            "big.md",
            big("ten L", "fifteen hundred L"),
            "mine"
        );
        await remoteCommit(repo, async (dir, git) => {
            writeFileSync(
                path.join(dir, "big.md"),
                big("ten R", "fifteen hundred R")
            );
            await git.add("big.md");
        });
        complete.mockReset();
        complete
            .mockResolvedValueOnce(reply("ten merged"))
            .mockResolvedValueOnce(reply("fifteen merged"));

        await expect(manager.pull()).rejects.toMatchObject({
            name: "GitConflictError",
        });
        expect(await resolveConflictsWithAi(plugin)).toBe(1);

        const text = readFileSync(path.join(repo.repoPath, "big.md"), "utf8");
        expect(text).toBe(big("ten merged", "fifteen merged"));
        expect(complete).toHaveBeenCalledTimes(2);
        expect(complete.mock.calls[0]![3]).toContain("--- text before ---");
    });
});
