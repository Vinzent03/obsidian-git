import { mkdir, readFile, stat } from "fs/promises";
import path from "path";
import git from "isomorphic-git";
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
    it("leaves HEAD and the worktree alone when a fast-forward overlaps a local edit", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const settingsFile = ".obsidian/plugins/obsidian-git/data.json";
        await repo.writeAndCommit(
            ".gitignore",
            ".obsidian/plugins/**\n!.obsidian/plugins/*/\n!.obsidian/plugins/*/data.json\n",
            "ignore plugin code"
        );
        await mkdir(path.dirname(path.join(repo.repoPath, settingsFile)), {
            recursive: true,
        });
        await repo.writeAndCommit(settingsFile, '{"a":1}\n', "settings");
        const oldHead = await repo.head();
        await repo.writeAndCommit(
            settingsFile,
            '{"a":1,"remote":true}\n',
            "remote change"
        );
        await repo.writeAndCommit("new.md", "new\n", "remote addition");
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", oldHead]);
        repo.write(settingsFile, '{"a":1,"local":true}\n');

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();

        await expect(manager.pull()).rejects.toThrow(/uncommitted/);
        expect(await repo.head()).toBe(oldHead);
        await expect(
            readFile(path.join(repo.repoPath, settingsFile), "utf8")
        ).resolves.toBe('{"a":1,"local":true}\n');
        await expect(
            stat(path.join(repo.repoPath, "new.md"))
        ).rejects.toThrow();

        await repo.git.add(settingsFile);
        await expect(manager.pull()).rejects.toThrow(/uncommitted/);
        expect(await repo.head()).toBe(oldHead);
        await expect(repo.cachedDiffNames()).resolves.toBe(settingsFile);

        await manager.commitAll({ message: "automatic backup" });
        expect(await repo.raw(["rev-parse", "HEAD^"])).toBe(oldHead);
    });

    it("preserves unrelated staged and unstaged changes during a fast-forward", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.writeAndCommit("staged.md", "base\n", "staged file");
        await repo.writeAndCommit("unstaged.md", "base\n", "unstaged file");
        const oldHead = await repo.head();
        await repo.writeAndCommit("note.md", "remote\n", "remote change");
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", oldHead]);
        repo.write("staged.md", "local staged\n");
        await repo.git.add("staged.md");
        repo.write("unstaged.md", "local unstaged\n");

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();

        await expect(manager.pull()).resolves.toMatchObject({
            status: "updated",
        });
        expect(await repo.head()).toBe(remoteHead);
        await expect(
            readFile(path.join(repo.repoPath, "staged.md"), "utf8")
        ).resolves.toBe("local staged\n");
        await expect(
            readFile(path.join(repo.repoPath, "unstaged.md"), "utf8")
        ).resolves.toBe("local unstaged\n");
        await expect(repo.cachedDiffNames()).resolves.toBe("staged.md");
    });

    it("reports up to date with a dirty worktree when the local branch is ahead", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.writeAndCommit("local.md", "local\n", "local commit");
        const localHead = await repo.head();
        repo.write("note.md", "uncommitted\n");

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();

        await expect(manager.pull()).resolves.toEqual({ status: "up-to-date" });
        expect(await repo.head()).toBe(localHead);
        await expect(
            readFile(path.join(repo.repoPath, "note.md"), "utf8")
        ).resolves.toBe("uncommitted\n");
    });

    it("creates a merge commit with no tree changes without requiring a clean worktree", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const oldHead = await repo.head();
        await repo.raw([
            "commit",
            "--allow-empty",
            "-m",
            "empty remote commit",
        ]);
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", oldHead]);
        await repo.raw(["commit", "--allow-empty", "-m", "empty local commit"]);
        const localHead = await repo.head();
        repo.write("note.md", "local uncommitted\n");

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();
        const checkout = vi.spyOn(git, "checkout");

        await expect(manager.pull()).resolves.toMatchObject({
            status: "updated",
            files: [],
        });
        expect(checkout).not.toHaveBeenCalled();
        expect(await repo.head()).not.toBe(localHead);
        expect(await repo.head()).not.toBe(remoteHead);
        expect(
            (
                await repo.raw(["rev-list", "--parents", "-n", "1", "HEAD"])
            ).split(" ")
        ).toHaveLength(3);
        await expect(
            readFile(path.join(repo.repoPath, "note.md"), "utf8")
        ).resolves.toBe("local uncommitted\n");
    });

    it("catches an affected file edited while a fast-forward is being prepared", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const oldHead = await repo.head();
        await repo.writeAndCommit("note.md", "remote\n", "remote change");
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", oldHead]);

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();
        const merge = git.merge;
        vi.spyOn(git, "merge").mockImplementation(async (options) => {
            const result = await merge(options);
            repo.write("note.md", "edited during pull\n");
            return result;
        });

        await expect(manager.pull()).rejects.toThrow(/uncommitted/);
        expect(await repo.head()).toBe(oldHead);
        await expect(
            readFile(path.join(repo.repoPath, "note.md"), "utf8")
        ).resolves.toBe("edited during pull\n");
    });

    it("does not overwrite an ignored untracked file added by the remote", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const incomingPath = ".obsidian/plugins/new-plugin/data.json";
        await repo.writeAndCommit(
            ".gitignore",
            ".obsidian/plugins/**\n",
            "ignore plugin data"
        );
        const oldHead = await repo.head();
        await mkdir(path.dirname(path.join(repo.repoPath, incomingPath)), {
            recursive: true,
        });
        repo.write(incomingPath, "remote\n");
        await repo.git.add(["-f", incomingPath]);
        await repo.git.commit("remote addition");
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", oldHead]);
        await mkdir(path.dirname(path.join(repo.repoPath, incomingPath)), {
            recursive: true,
        });
        repo.write(incomingPath, "local\n");

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();

        await expect(manager.pull()).rejects.toThrow(/untracked file/);
        expect(await repo.head()).toBe(oldHead);
        await expect(
            readFile(path.join(repo.repoPath, incomingPath), "utf8")
        ).resolves.toBe("local\n");
    });

    it("does not advance HEAD if checkout fails", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const oldHead = await repo.head();
        await repo.writeAndCommit("remote.md", "remote\n", "remote change");
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", oldHead]);

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();
        vi.spyOn(git, "checkout").mockRejectedValueOnce(
            new Error("checkout failed")
        );

        await expect(manager.pull()).rejects.toThrow("checkout failed");
        expect(await repo.head()).toBe(oldHead);
        await expect(
            stat(path.join(repo.repoPath, "remote.md"))
        ).rejects.toThrow();
    });

    it("limits a forced merge checkout to changed paths and preserves unrelated edits", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.writeAndCommit("note.md", "a\nb\nc\nd\ne\nf\n", "six lines");
        await repo.writeAndCommit("old.md", "old\n", "old file");
        await repo.writeAndCommit("staged.md", "base\n", "staged file");
        await repo.writeAndCommit("unstaged.md", "base\n", "unstaged file");
        const base = await repo.head();
        await repo.writeAndCommit(
            "note.md",
            "REMOTE\nb\nc\nd\ne\nf\n",
            "remote change"
        );
        await repo.writeAndCommit("new.md", "new\n", "remote addition");
        await repo.git.rm("old.md");
        await repo.git.commit("remote deletion");
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", base]);
        await repo.writeAndCommit(
            "note.md",
            "a\nb\nc\nd\ne\nLOCAL\n",
            "local change"
        );
        repo.write("staged.md", "local staged\n");
        await repo.git.add("staged.md");
        repo.write("unstaged.md", "local unstaged\n");

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();
        const checkout = vi.spyOn(git, "checkout");

        await expect(manager.pull()).resolves.toMatchObject({
            status: "updated",
        });
        expect(checkout).toHaveBeenCalledWith(
            expect.objectContaining({
                force: true,
                noUpdateHead: true,
            })
        );
        expect(new Set(checkout.mock.calls[0]?.[0].filepaths)).toEqual(
            new Set(["note.md", "new.md", "old.md"])
        );
        await expect(
            readFile(path.join(repo.repoPath, "note.md"), "utf8")
        ).resolves.toBe("REMOTE\nb\nc\nd\ne\nLOCAL\n");
        await expect(repo.show("HEAD:note.md")).resolves.toBe(
            "REMOTE\nb\nc\nd\ne\nLOCAL"
        );
        await expect(
            readFile(path.join(repo.repoPath, "new.md"), "utf8")
        ).resolves.toBe("new\n");
        await expect(
            stat(path.join(repo.repoPath, "old.md"))
        ).rejects.toThrow();
        await expect(
            readFile(path.join(repo.repoPath, "staged.md"), "utf8")
        ).resolves.toBe("local staged\n");
        await expect(
            readFile(path.join(repo.repoPath, "unstaged.md"), "utf8")
        ).resolves.toBe("local unstaged\n");
        await expect(repo.cachedDiffNames()).resolves.toBe("staged.md");
    });

    it("rejects an uncommitted change to a file affected by a real merge", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.writeAndCommit("note.md", "a\nb\nc\nd\ne\nf\n", "six lines");
        const base = await repo.head();
        await repo.writeAndCommit(
            "note.md",
            "REMOTE\nb\nc\nd\ne\nf\n",
            "remote change"
        );
        const remoteHead = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", remoteHead]);
        await repo.raw(["reset", "--hard", base]);
        await repo.writeAndCommit(
            "note.md",
            "a\nb\nc\nd\ne\nLOCAL\n",
            "local change"
        );
        const localHead = await repo.head();
        repo.write("note.md", "local uncommitted edit\n");

        const { manager } = createIsomorphicGitManager(repo.repoPath);
        vi.spyOn(manager, "fetch").mockResolvedValue();
        const merge = vi.spyOn(git, "merge");

        await expect(manager.pull()).rejects.toThrow(/uncommitted/);
        expect(merge).toHaveBeenCalledOnce();
        expect(merge).toHaveBeenCalledWith(
            expect.objectContaining({ abortOnConflict: true })
        );
        expect(await repo.head()).toBe(localHead);
        await expect(
            readFile(path.join(repo.repoPath, "note.md"), "utf8")
        ).resolves.toBe("local uncommitted edit\n");
    });

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

    it("preserves local edits before materializing a conflict, then writes conflict markers and merge metadata", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.writeAndCommit("unrelated.md", "base\n", "unrelated file");
        await repo.git.checkoutLocalBranch("theirs");
        await repo.writeAndCommit("note.md", "theirs\n", "their change");
        const theirCommit = await repo.head();
        await repo.git.checkout("main");
        await repo.writeAndCommit("note.md", "ours\n", "our change");
        const localCommit = await repo.head();
        await repo.raw(["update-ref", "refs/remotes/origin/main", theirCommit]);
        repo.write("unrelated.md", "local uncommitted\n");

        const { manager, plugin, updateCachedStatus } =
            createIsomorphicGitManager(repo.repoPath);
        plugin.settings.mergeStrategy = "none";
        vi.spyOn(manager, "fetch").mockResolvedValue();

        await expect(manager.pull()).rejects.toThrow(/uncommitted/);
        expect(await repo.head()).toBe(localCommit);
        await expect(
            readFile(path.join(repo.repoPath, "note.md"), "utf8")
        ).resolves.toBe("ours\n");
        await expect(
            readFile(path.join(repo.repoPath, "unrelated.md"), "utf8")
        ).resolves.toBe("local uncommitted\n");
        await expect(
            stat(path.join(repo.repoPath, ".git", "MERGE_HEAD"))
        ).rejects.toThrow();

        repo.write("unrelated.md", "base\n");
        await expect(manager.pull()).rejects.toBeInstanceOf(GitConflictError);

        const content = await readFile(
            path.join(repo.repoPath, "note.md"),
            "utf8"
        );
        expect(content).toMatch(/<<<<<<<[^\n]*\nours\n/);
        expect(content).toMatch(/=======\ntheirs\n/);
        expect(content).toMatch(/>>>>>>>[^\n]*\n?/);
        expect((await manager.status()).conflicted).toContain("note.md");
        await expect(
            readFile(path.join(repo.repoPath, ".git", "ORIG_HEAD"), "utf8")
        ).resolves.toBe(`${localCommit}\n`);
        await expect(
            readFile(path.join(repo.repoPath, ".git", "MERGE_HEAD"), "utf8")
        ).resolves.toBe(`${theirCommit}\n`);
        await expect(
            readFile(path.join(repo.repoPath, ".git", "MERGE_MSG"), "utf8")
        ).resolves.toBe("Merge branch 'origin/main' into main\n");
        expect(updateCachedStatus).not.toHaveBeenCalled();
        expect(plugin.displayError).not.toHaveBeenCalled();
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
    it("includes a mode-only change in paths needing checkout", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const before = await repo.head();
        await repo.raw(["update-index", "--chmod=+x", "note.md"]);
        await repo.git.commit("change file mode");
        const after = await repo.head();
        const { manager } = createIsomorphicGitManager(repo.repoPath);

        await expect(
            manager.getFileChangesCount(before, after)
        ).resolves.toEqual([{ path: "note.md", type: "M" }]);
    });

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
