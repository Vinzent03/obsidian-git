import { writeFileSync } from "fs";
import path from "path";
import simpleGit, {
    type SimpleGit as SimpleGitClient,
    type SimpleGitProgressEvent,
} from "simple-git";
import { describe, expect, it, vi } from "vitest";
import { SimpleGit } from "../../src/gitManager/simpleGit";
import { GitOperation, type GitProgress } from "../../src/types";
import { withCleanup } from "../helpers/cleanup";
import { createFakePlugin, type FakePlugin } from "../helpers/createFakePlugin";
import { createRepoWithOrigin } from "../helpers/gitRepo";

function createManager(
    repoPath: string,
    gitClient: SimpleGitClient,
    plugin: FakePlugin = createFakePlugin()
): SimpleGit {
    (
        plugin.app as unknown as {
            vault: { adapter: { getBasePath(): string } };
        }
    ).vault = {
        adapter: {
            getBasePath: () => repoPath,
        },
    };
    const manager = new SimpleGit(plugin);
    manager.git = gitClient;
    manager.absoluteRepoPath = repoPath;
    return manager;
}

function addStatusBar(plugin: FakePlugin) {
    const displayProgress = vi.fn<(progress: GitProgress) => void>();
    const clearProgress = vi.fn<(display?: boolean) => void>();
    const statusBar = {
        displayProgress,
        clearProgress,
    };
    plugin.statusBar = statusBar as unknown as FakePlugin["statusBar"];
    return statusBar;
}

type ProgressMapper = {
    toGitProgress(progress: SimpleGitProgressEvent): GitProgress;
};

async function createRemoteCommit(repo: {
    dir: string;
    remotePath: string;
}): Promise<void> {
    const remoteWorktreePath = path.join(repo.dir, "remote-worktree");
    await simpleGit(repo.dir).raw([
        "clone",
        repo.remotePath,
        remoteWorktreePath,
    ]);

    const remoteGit = simpleGit({
        baseDir: remoteWorktreePath,
        config: ["core.quotepath=off"],
    });
    await remoteGit.addConfig("user.email", "test@example.com");
    await remoteGit.addConfig("user.name", "Test User");
    writeFileSync(path.join(remoteWorktreePath, "remote.md"), "remote\n");
    await remoteGit.add("remote.md");
    await remoteGit.commit("remote commit");
    await remoteGit.push(["--quiet"]);
}

describe("SimpleGit.commit", () => {
    it("commits staged changes without staging unstaged changes", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        repo.write("staged.md", "staged\n");
        repo.write("unstaged.md", "unstaged\n");
        await repo.git.add("staged.md");
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changes = await manager.commit({ message: "commit staged" });

        expect(changes).toBe(1);
        expect(await repo.headMessage()).toBe("commit staged");
        expect(await repo.show("HEAD:staged.md")).toBe("staged");
        expect(await repo.statusPorcelain()).toBe("?? unstaged.md");
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.commit }],
            [{ operation: GitOperation.idle }],
        ]);
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });

    it("amends the previous commit when amend is true", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const headBefore = await repo.head();
        repo.write("note.md", "base\namended\n");
        await repo.git.add("note.md");
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changes = await manager.commit({
            message: "amended base",
            amend: true,
        });

        expect(changes).toBe(1);
        expect(await repo.head()).not.toBe(headBefore);
        expect(await repo.headMessage()).toBe("amended base");
        expect(await repo.unpushedCount()).toBe(1);
        expect(await repo.show("HEAD:note.md")).toBe("base\namended");
        expect(await repo.statusPorcelain()).toBe("");
    });
});

describe("SimpleGit.commitAll", () => {
    it("stages and commits tracked, untracked, and deleted files", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.writeAndCommit(
            "delete-me.md",
            "delete me\n",
            "add deleted file"
        );
        await repo.git.push(["--quiet"]);
        repo.write("note.md", "base\nchanged\n");
        repo.write("created.md", "created\n");
        await repo.raw(["rm", "delete-me.md"]);
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changes = await manager.commitAll({ message: "commit all" });

        expect(changes).toBe(3);
        expect(await repo.headMessage()).toBe("commit all");
        expect(await repo.show("HEAD:note.md")).toBe("base\nchanged");
        expect(await repo.show("HEAD:created.md")).toBe("created");
        expect(await repo.statusPorcelain()).toBe("");
        await expect(repo.show("HEAD:delete-me.md")).rejects.toThrow();
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.commit }],
            [{ operation: GitOperation.idle }],
        ]);
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });
});

describe("SimpleGit.pull", () => {
    it("pulls remote changes and returns changed files", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await createRemoteCommit(repo);
        const plugin = createFakePlugin();
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changes = await manager.pull();

        expect(changes).toEqual([
            {
                path: "remote.md",
                workingDir: "P",
                vaultPath: "remote.md",
            },
        ]);
        expect(await repo.headMessage()).toBe("remote commit");
        expect(await repo.show("HEAD:remote.md")).toBe("remote");
        expect(await repo.statusPorcelain()).toBe("");
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.pull }],
            [{ operation: GitOperation.idle }],
        ]);
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });

    it("returns an empty change list when the branch is already up to date", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const plugin = createFakePlugin();
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changes = await manager.pull();

        expect(changes).toEqual([]);
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.pull }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("clears progress when done without manually setting pull progress", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const plugin = createFakePlugin();
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";
        const statusBar = addStatusBar(plugin);
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.pull();

        expect(statusBar.displayProgress).not.toHaveBeenCalled();
        expect(statusBar.clearProgress).toHaveBeenCalledWith(false);
    });

    it("resets the current branch to upstream when sync method is reset", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await createRemoteCommit(repo);
        const plugin = createFakePlugin();
        plugin.settings.syncMethod = "reset";
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changes = await manager.pull();

        expect(changes).toEqual([
            {
                path: "remote.md",
                workingDir: "P",
                vaultPath: "remote.md",
            },
        ]);
        expect(await repo.headMessage()).toBe("remote commit");
        expect(await repo.show("HEAD:remote.md")).toBe("remote");
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });

    it("reports an error when no current branch is checked out", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const fetch = vi.fn().mockResolvedValue(undefined);
        const git = {
            status: vi.fn().mockResolvedValue({
                current: undefined,
                tracking: "origin/main",
            }),
            branch: vi.fn().mockResolvedValue({ all: ["main", "origin/main"] }),
            fetch,
        } as unknown as SimpleGitClient;
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, git, plugin);

        const changes = await manager.pull();

        expect(changes).toBeUndefined();
        expect(plugin.displayError).toHaveBeenCalledWith(
            "No current branch found. Cannot pull."
        );
        expect(fetch).not.toHaveBeenCalled();
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.pull }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("updates submodules only when no tracking branch exists", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.git.checkoutLocalBranch("local-only");
        const headBefore = await repo.head();
        const plugin = createFakePlugin();
        plugin.settings.updateSubmodules = true;
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changes = await manager.pull();

        expect(changes).toBeUndefined();
        expect(await repo.head()).toBe(headBefore);
        expect(plugin.log).toHaveBeenCalledWith(
            "No tracking branch found. Ignoring pull of main repo and updating submodules only."
        );
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });
});

describe("SimpleGit.push", () => {
    it("pushes local commits and returns the changed file count", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.appendAndCommit("note.md", "local\n", "local commit");
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changedFiles = await manager.push();

        expect(changedFiles).toBe(1);
        expect(await repo.unpushedCount()).toBe(0);
        expect(await repo.show("origin/main:note.md")).toBe("base\nlocal");
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.push }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("returns null when pushing without a tracking branch", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.git.checkoutLocalBranch("local-only");
        await repo.git.addConfig("push.default", "current");
        await repo.writeAndCommit("local-only.md", "local\n", "local only");
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changedFiles = await manager.push();

        expect(changedFiles).toBeNull();
        expect(
            await repo.raw(["ls-remote", "--heads", "origin", "local-only"])
        ).toContain(await repo.head());
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.push }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("clears progress when done without manually setting push progress", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const plugin = createFakePlugin();
        const statusBar = addStatusBar(plugin);
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.push();

        expect(statusBar.displayProgress).not.toHaveBeenCalled();
        expect(statusBar.clearProgress).toHaveBeenCalledWith(false);
    });

    it("reports an error when no current branch is checked out", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const push = vi.fn().mockResolvedValue(undefined);
        const git = {
            status: vi.fn().mockResolvedValue({
                current: undefined,
                tracking: "origin/main",
            }),
            push,
        } as unknown as SimpleGitClient;
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, git, plugin);

        const changedFiles = await manager.push();

        expect(changedFiles).toBeUndefined();
        expect(plugin.displayError).toHaveBeenCalledWith(
            "No current branch found. Cannot push."
        );
        expect(push).not.toHaveBeenCalled();
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.push }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("updates submodules only when no tracking branch exists", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.git.checkoutLocalBranch("local-only");
        await repo.writeAndCommit("local-only.md", "local\n", "local only");
        const plugin = createFakePlugin();
        plugin.settings.updateSubmodules = true;
        const manager = createManager(repo.repoPath, repo.git, plugin);

        const changedFiles = await manager.push();

        expect(changedFiles).toBeUndefined();
        expect(
            await repo.raw(["ls-remote", "--heads", "origin", "local-only"])
        ).toBe("");
        expect(plugin.log).toHaveBeenCalledWith(
            "No tracking branch found. Ignoring push of main repo and updating submodules only."
        );
    });
});

describe("SimpleGit.fetch", () => {
    it("sets the fetch operation and clears progress when done", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const plugin = createFakePlugin();
        const statusBar = addStatusBar(plugin);
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.fetch();

        expect(statusBar.displayProgress).not.toHaveBeenCalled();
        expect(statusBar.clearProgress).toHaveBeenCalledWith(false);
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.fetch }],
            [{ operation: GitOperation.idle }],
        ]);
    });
});

describe("SimpleGit.checkout", () => {
    it("sets the checkout operation and clears progress when done", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.git.checkout(["--quiet", "-b", "feature"]);
        await repo.git.checkout(["--quiet", "main"]);
        const plugin = createFakePlugin();
        const statusBar = addStatusBar(plugin);
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.checkout("feature");

        expect(await repo.git.revparse(["--abbrev-ref", "HEAD"])).toBe(
            "feature"
        );
        expect(statusBar.displayProgress).not.toHaveBeenCalled();
        expect(statusBar.clearProgress).toHaveBeenCalledWith(false);
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.checkout }],
            [{ operation: GitOperation.idle }],
        ]);
    });
});

describe("SimpleGit progress", () => {
    it("maps simple-git progress events to status bar progress", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const manager = createManager(repo.repoPath, repo.git);
        const mapper = manager as unknown as ProgressMapper;

        expect(
            mapper.toGitProgress({
                method: "fetch",
                stage: "receiving",
                progress: 42,
                processed: 12,
                total: 28,
            })
        ).toEqual({
            action: "Fetching",
            stage: "receiving",
            progress: 42,
            processed: 12,
            total: 28,
        });

        expect(
            mapper.toGitProgress({
                method: "push",
                stage: "writing",
                progress: 75,
                processed: 3,
                total: 4,
            })
        ).toEqual({
            action: "Pushing",
            stage: "writing",
            progress: 75,
            processed: 3,
            total: 4,
        });

        expect(
            mapper.toGitProgress({
                method: "checkout",
                stage: "updating",
                progress: 25,
                processed: 1,
                total: 4,
            })
        ).toEqual({
            action: "Checking out",
            stage: "updating",
            progress: 25,
            processed: 1,
            total: 4,
        });
    });
});

describe("SimpleGit.squashAllUnpushedCommits", () => {
    it("squashes multiple unpushed commits into one commit with the previous HEAD message", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        await repo.appendAndCommit("note.md", "two\n", "commit two");
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.squashAllUnpushedCommits();

        expect(await repo.unpushedCount()).toBe(1);
        expect(await repo.headMessage()).toBe("commit two");
        expect(await repo.statusPorcelain()).toBe("");
        expect(await repo.show("HEAD:note.md")).toBe("base\none\ntwo");
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.commit }],
            [{ operation: GitOperation.idle }],
        ]);
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });

    it("does nothing when there is only one unpushed commit", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        const headBefore = await repo.head();
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.squashAllUnpushedCommits();

        expect(await repo.head()).toBe(headBefore);
        expect(await repo.unpushedCount()).toBe(1);
        expect(plugin.setPluginState).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });

    it("does nothing when staged changes are present", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        await repo.appendAndCommit("note.md", "two\n", "commit two");
        repo.write("staged.md", "staged\n");
        await repo.git.add("staged.md");
        const headBefore = await repo.head();
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.squashAllUnpushedCommits();

        expect(await repo.head()).toBe(headBefore);
        expect(await repo.unpushedCount()).toBe(2);
        expect(await repo.cachedDiffNames()).toBe("staged.md");
        expect(plugin.setPluginState).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });

    it("does nothing when unpushed history contains a merge commit", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        await repo.git.checkout(["--quiet", "-b", "feature"]);
        await repo.writeAndCommit("feature.md", "feature\n", "feature");
        await repo.git.checkout(["--quiet", "main"]);
        await repo.writeAndCommit("main.md", "main\n", "main");
        await repo.git.raw([
            "merge",
            "--quiet",
            "--no-ff",
            "feature",
            "-m",
            "merge feature",
        ]);
        const headBefore = await repo.head();
        const plugin = createFakePlugin();
        const manager = createManager(repo.repoPath, repo.git, plugin);

        await manager.squashAllUnpushedCommits();

        expect(await repo.head()).toBe(headBefore);
        expect(await repo.mergeCommitCount()).toBe(1);
        expect(plugin.setPluginState).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });
});
