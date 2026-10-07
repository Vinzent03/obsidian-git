import { mkdir, readFile, stat } from "fs/promises";
import path from "path";
import git, { Errors } from "isomorphic-git";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withCleanup } from "../helpers/cleanup";
import { GitConflictError } from "../../src/types";
import {
    createRepoWithMergeConflict,
    createRepoWithOrigin,
} from "../helpers/gitRepo";
import { createIsomorphicGitManager } from "../helpers/isomorphicGit";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("IsomorphicGit merge state", () => {
    it("lists an unresolved merge file only as conflicted", async () => {
        const repo = withCleanup(await createRepoWithMergeConflict());
        const { manager } = createIsomorphicGitManager(repo.repoPath);

        const status = await manager.status();
        expect(status.conflicted).toContain("note.md");
        expect(status.staged.map((file) => file.path)).not.toContain("note.md");
        expect(status.changed.map((file) => file.path)).not.toContain(
            "note.md"
        );

        repo.write("note.md", "resolved\n");
        await manager.stage("note.md", false);
        const resolvedStatus = await manager.status();

        expect(resolvedStatus.conflicted).not.toContain("note.md");
        expect(resolvedStatus.staged.map((file) => file.path)).toContain(
            "note.md"
        );
    });

    it("clears canonical merge metadata after committing", async () => {
        const repo = withCleanup(await createRepoWithMergeConflict());
        const { manager, setPluginState } = createIsomorphicGitManager(
            repo.repoPath
        );
        await manager.stage("note.md", false);

        await manager.commit({ message: "resolve merge" });

        await expect(
            stat(path.join(repo.repoPath, ".git", "MERGE_MSG"))
        ).rejects.toThrow();
        await expect(
            stat(path.join(repo.repoPath, ".git", "MERGE_MODE"))
        ).rejects.toThrow();
        expect(setPluginState).toHaveBeenCalledWith({
            mergeInProgress: false,
        });
    });

    it("leaves commit conflict reporting to the action boundary", async () => {
        const repo = withCleanup(await createRepoWithMergeConflict());
        const { manager, plugin, updateCachedStatus } =
            createIsomorphicGitManager(repo.repoPath);

        await expect(
            manager.commit({ message: "still conflicted" })
        ).rejects.toBeInstanceOf(GitConflictError);

        expect(updateCachedStatus).not.toHaveBeenCalled();
        expect(plugin.displayError).not.toHaveBeenCalled();
        expect(await manager.isMergeInProgress()).toBe(true);
    });

    it("writes canonical merge metadata when an isomorphic merge conflicts", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager, plugin, updateCachedStatus } =
            createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "resolveRef")
            .mockResolvedValueOnce("a".repeat(40))
            .mockResolvedValueOnce("b".repeat(40));
        vi.spyOn(manager, "fetch").mockResolvedValue();
        vi.spyOn(manager, "branchInfo").mockResolvedValue({
            current: "main",
            tracking: "origin/main",
            branches: ["main"],
            remote: "origin",
        });
        vi.spyOn(git, "merge").mockRejectedValue(
            new Errors.MergeConflictError(["note.md"], ["note.md"], [], [])
        );

        await expect(manager.pull()).rejects.toBeInstanceOf(GitConflictError);

        await expect(
            readFile(path.join(repo.repoPath, ".git", "ORIG_HEAD"), "utf8")
        ).resolves.toBe(`${"a".repeat(40)}\n`);
        await expect(
            readFile(path.join(repo.repoPath, ".git", "MERGE_HEAD"), "utf8")
        ).resolves.toBe(`${"b".repeat(40)}\n`);
        await expect(
            readFile(path.join(repo.repoPath, ".git", "MERGE_MSG"), "utf8")
        ).resolves.toBe("Merge branch 'origin/main' into main\n");
        expect(updateCachedStatus).not.toHaveBeenCalled();
        expect(plugin.displayError).not.toHaveBeenCalled();
    });

    it("writes conflict markers for a conflicting pull with the none merge strategy", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.git.checkoutLocalBranch("theirs");
        await repo.writeAndCommit("note.md", "theirs\n", "their change");
        const theirCommit = await repo.head();
        await repo.git.checkout("main");
        await repo.writeAndCommit("note.md", "ours\n", "our change");
        await repo.raw(["update-ref", "refs/remotes/origin/main", theirCommit]);

        const { manager, plugin } = createIsomorphicGitManager(repo.repoPath);
        plugin.settings.mergeStrategy = "none";
        vi.spyOn(manager, "fetch").mockResolvedValue();

        await expect(manager.pull()).rejects.toBeInstanceOf(GitConflictError);

        const content = await readFile(
            path.join(repo.repoPath, "note.md"),
            "utf8"
        );
        expect(content).toMatch(/<<<<<<<[^\n]*\nours\n/);
        expect(content).toMatch(/=======\ntheirs\n/);
        expect(content).toMatch(/>>>>>>>[^\n]*\n?/);
        expect((await manager.status()).conflicted).toContain("note.md");
    });
});

describe("IsomorphicGit.push", () => {
    it("returns explicit pushed and up-to-date results", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(git, "push").mockResolvedValue({
            ok: true,
            error: null,
            refs: {},
        });

        await expect(manager.push()).resolves.toEqual({
            status: "up-to-date",
        });

        await repo.appendAndCommit("note.md", "local\n", "local commit");

        await expect(manager.push()).resolves.toEqual({
            status: "pushed",
            files: 1,
        });
    });

    it("throws failures without displaying them", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager, plugin } = createIsomorphicGitManager(repo.repoPath);
        const error = new Error("push failed");
        vi.spyOn(git, "push").mockRejectedValue(error);

        await expect(manager.push()).rejects.toBe(error);

        expect(plugin.displayError).not.toHaveBeenCalled();
    });
});

describe("IsomorphicGit working-tree mutations", () => {
    it("throws stage failures without displaying them", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager, plugin } = createIsomorphicGitManager(repo.repoPath);
        const error = new Error("stage failed");
        vi.spyOn(git, "add").mockRejectedValue(error);

        await expect(manager.stage("note.md", false)).rejects.toBe(error);

        expect(plugin.displayError).not.toHaveBeenCalled();
    });
});

describe("IsomorphicGit.getFileChangesCount", () => {
    it("does not descend into subtrees that are identical in both commits", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await mkdir(path.join(repo.repoPath, "same", "nested"), {
            recursive: true,
        });
        await mkdir(path.join(repo.repoPath, "changed"));
        await repo.writeAndCommit("same/nested/note.md", "same\n", "add same");
        const first = await repo.head();
        await repo.writeAndCommit("changed/note.md", "changed\n", "add");
        const second = await repo.head();
        const sameTree = (
            await repo.raw(["rev-parse", "HEAD:same/nested"])
        ).trim();
        const { manager, plugin } = createIsomorphicGitManager(repo.repoPath);
        const readBinary = vi.spyOn(plugin.app.vault.adapter, "readBinary");

        const changes = await manager.getFileChangesCount(first, second);

        expect(changes).toEqual([{ path: "changed/note.md", type: "A" }]);
        const sameTreePath = `objects/${sameTree.slice(0, 2)}/${sameTree.slice(2)}`;
        expect(
            readBinary.mock.calls.some(([p]) => p.endsWith(sameTreePath))
        ).toBe(false);
        await expect(
            manager.getFileChangesCount(second, second)
        ).resolves.toEqual([]);
    });
});

describe("IsomorphicGit.status", () => {
    it("does not re-read unchanged files once the index stats are refreshed", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager, plugin } = createIsomorphicGitManager(repo.repoPath);
        const adapter = plugin.app.vault.adapter;
        const readBinary = vi.spyOn(adapter, "readBinary");
        const workTreeReads = () =>
            readBinary.mock.calls.filter(
                ([vaultPath]) =>
                    !vaultPath.replace(/^\/+/, "").startsWith(".git")
            ).length;

        // The first status hashes files because native git wrote the index.
        await manager.status();
        expect(workTreeReads()).toBeGreaterThan(0);

        readBinary.mockClear();
        await manager.status();
        expect(workTreeReads()).toBe(0);
    });
});
