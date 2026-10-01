import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
    simpleGit,
    type SimpleGit as SimpleGitClient,
    type SimpleGitProgressEvent,
} from "simple-git";
import { describe, expect, it, vi } from "vitest";
import { GitOperation, type GitProgress } from "../../src/types";
import { SimpleGit } from "../../src/gitManager/simpleGit";
import { withCleanup } from "../helpers/cleanup";
import { createFakePlugin, type FakePlugin } from "../helpers/createFakePlugin";
import { createEmptyRepo, createRepoWithOrigin } from "../helpers/gitRepo";
import { createSimpleGitTestContext } from "../helpers/simpleGit";

function createManager(
    repoPath: string,
    gitClient: SimpleGitClient,
    plugin: FakePlugin = createFakePlugin(),
    vaultPath = repoPath
): SimpleGit {
    (
        plugin.app as unknown as {
            vault: {
                adapter: {
                    getBasePath(): string;
                    exists(filePath: string): Promise<boolean>;
                };
            };
        }
    ).vault = {
        adapter: {
            getBasePath: () => vaultPath,
            exists: (filePath: string) =>
                Promise.resolve(existsSync(path.join(vaultPath, filePath))),
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

async function addVaultDirectory(
    repo: Awaited<ReturnType<typeof createRepoWithOrigin>>
) {
    mkdirSync(path.join(repo.repoPath, "docs"));
    repo.write("docs/vault.md", "vault base\n");
    await repo.git.add("docs/vault.md");
    await repo.git.commit("add vault");
    await repo.git.push(["--quiet"]);
    return path.join(repo.repoPath, "docs");
}

type ProgressMapper = {
    toGitProgress(progress: SimpleGitProgressEvent): GitProgress;
};

async function createRemoteCommit(
    repo: {
        dir: string;
        remotePath: string;
    },
    files: Record<string, string> = { "remote.md": "remote\n" }
): Promise<void> {
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
    for (const [filePath, content] of Object.entries(files)) {
        const absolutePath = path.join(remoteWorktreePath, filePath);
        mkdirSync(path.dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, content);
    }
    await remoteGit.add(Object.keys(files));
    await remoteGit.commit("remote commit");
    await remoteGit.push(["--quiet"]);
}

async function createPullConflict(repo: {
    dir: string;
    remotePath: string;
    writeAndCommit(
        file: string,
        content: string,
        message: string
    ): Promise<void>;
}): Promise<void> {
    const remoteWorktreePath = path.join(repo.dir, "conflict-worktree");
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

    await repo.writeAndCommit("note.md", "local\n", "local conflict");
    writeFileSync(path.join(remoteWorktreePath, "note.md"), "remote\n");
    await remoteGit.add("note.md");
    await remoteGit.commit("remote conflict");
    await remoteGit.push(["--quiet"]);
}

describe("SimpleGit.commit", () => {
    it("returns the change count and triggers a head-change event", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        repo.write("staged.md", "staged\n");
        await repo.git.add("staged.md");

        const changes = await manager.commit({ message: "commit staged" });

        expect(changes).toBe(1);
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.commit }],
            [{ operation: GitOperation.idle }],
        ]);
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });

    it("stages vault changes and commits files already staged outside the vault", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const vaultPath = await addVaultDirectory(repo);
        repo.write("docs/vault.md", "vault changed\n");
        repo.write("note.md", "outside unstaged\n");
        repo.write("outside-staged.md", "outside staged\n");
        await repo.git.add("outside-staged.md");
        const plugin = createFakePlugin();
        plugin.settings.limitToVault = true;
        const manager = createManager(
            repo.repoPath,
            repo.git,
            plugin,
            vaultPath
        );

        const changes = await manager.commitAll({ message: "scoped commit" });

        expect(changes).toBe(2);
        expect(await repo.show("HEAD:docs/vault.md")).toBe("vault changed");
        expect(await repo.show("HEAD:outside-staged.md")).toBe(
            "outside staged"
        );
        expect(await repo.show("HEAD:note.md")).toBe("base");
        expect(await repo.statusPorcelain()).toBe("M note.md");
    });
});

describe("SimpleGit vault scope", () => {
    it("keeps repository-wide behavior when the setting is disabled", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const vaultPath = await addVaultDirectory(repo);
        repo.write("docs/vault.md", "vault changed\n");
        repo.write("note.md", "outside changed\n");
        const plugin = createFakePlugin();
        plugin.settings.limitToVault = false;
        const manager = createManager(
            repo.repoPath,
            repo.git,
            plugin,
            vaultPath
        );

        const status = await manager.status();

        expect(status.changed.map((file) => file.path).sort()).toEqual([
            "docs/vault.md",
            "note.md",
        ]);
        expect(status.stagedOutsideVault).toBe(0);
    });

    it("limits status data while counting staged files outside the vault", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const vaultPath = await addVaultDirectory(repo);
        repo.write("docs/vault.md", "vault changed\n");
        repo.write("docs/new.md", "new vault file\n");
        repo.write("note.md", "outside unstaged\n");
        repo.write("outside-staged.md", "outside staged\n");
        await repo.git.add("outside-staged.md");
        const plugin = createFakePlugin();
        plugin.settings.limitToVault = true;
        const manager = createManager(
            repo.repoPath,
            repo.git,
            plugin,
            vaultPath
        );

        const status = await manager.status();

        expect(status.changed.map((file) => file.path).sort()).toEqual([
            "docs/new.md",
            "docs/vault.md",
        ]);
        expect(status.staged).toEqual([]);
        expect(status.stagedOutsideVault).toBe(1);
        expect(status.conflictedOutsideVault).toBe(0);

        const tree = manager.getTreeStructure(status.changed, "vault");
        expect(tree.map((item) => item.title).sort()).toEqual([
            "new.md",
            "vault.md",
        ]);
        expect(tree.map((item) => item.path).sort()).toEqual([
            "docs/new.md",
            "docs/vault.md",
        ]);
        expect(tree.map((item) => item.vaultPath).sort()).toEqual([
            "new.md",
            "vault.md",
        ]);
    });

    it("unstages and discards only changes inside the vault", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const vaultPath = await addVaultDirectory(repo);
        repo.write("docs/vault.md", "vault changed\n");
        repo.write("note.md", "outside changed\n");
        await repo.git.add(["docs/vault.md", "note.md"]);
        const plugin = createFakePlugin();
        plugin.settings.limitToVault = true;
        const manager = createManager(
            repo.repoPath,
            repo.git,
            plugin,
            vaultPath
        );

        await manager.unstageAll({});
        expect(await repo.cachedDiffNames()).toBe("note.md");

        await manager.discardAll({});
        expect(readFileSync(path.join(vaultPath, "vault.md"), "utf8")).toBe(
            "vault base\n"
        );
        expect(readFileSync(path.join(repo.repoPath, "note.md"), "utf8")).toBe(
            "outside changed\n"
        );
    });

    it("counts conflicts outside the vault without listing unrelated changes", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const vaultPath = await addVaultDirectory(repo);
        await createRemoteCommit(repo, {
            "docs/vault.md": "remote vault change\n",
            "note.md": "remote change\n",
        });
        repo.write("docs/vault.md", "local vault change\n");
        repo.write("note.md", "local change\n");
        await repo.git.add(["docs/vault.md", "note.md"]);
        await repo.git.commit("local change");
        await repo.git.fetch();
        await expect(repo.git.merge(["origin/main"])).rejects.toThrow();
        const plugin = createFakePlugin();
        plugin.settings.limitToVault = true;
        const manager = createManager(
            repo.repoPath,
            repo.git,
            plugin,
            vaultPath
        );

        const status = await manager.status();

        expect(status.conflicted).toEqual(["docs/vault.md"]);
        expect(status.conflictedOutsideVault).toBe(1);
        expect(status.changed).toEqual([]);
        expect(status.all.map((file) => file.path)).toEqual(["docs/vault.md"]);
    });
});

describe("SimpleGit.pull", () => {
    it("pulls remote changes and returns changed files", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await createRemoteCommit(repo);
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";

        const changes = await manager.pull();

        expect(changes).toEqual({
            status: "updated",
            files: [
                {
                    path: "remote.md",
                    workingDir: "P",
                    vaultPath: "remote.md",
                },
            ],
            outsideVault: 0,
        });
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

    it("reports vault and outside-vault changes separately", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const vaultPath = await addVaultDirectory(repo);
        await createRemoteCommit(repo, {
            "docs/remote.md": "vault remote\n",
            "outside-remote.md": "outside remote\n",
        });
        const plugin = createFakePlugin();
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";
        plugin.settings.limitToVault = true;
        const manager = createManager(
            repo.repoPath,
            repo.git,
            plugin,
            vaultPath
        );

        const changes = await manager.pull();

        expect(changes).toEqual({
            status: "updated",
            files: [
                {
                    path: "docs/remote.md",
                    workingDir: "P",
                    vaultPath: "remote.md",
                },
            ],
            outsideVault: 1,
        });
    });

    it("returns an explicit result when the branch is already up to date", async () => {
        const { plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";

        const changes = await manager.pull();

        expect(changes).toEqual({ status: "up-to-date" });
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.pull }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("returns up-to-date when the local branch is ahead of upstream", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.appendAndCommit("note.md", "local\n", "local commit");
        const headBefore = await repo.head();
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";

        const changes = await manager.pull();

        expect(changes).toEqual({ status: "up-to-date" });
        expect(await repo.head()).toBe(headBefore);
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });

    it("throws a shared conflict error without displaying it", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await createPullConflict(repo);
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";

        await expect(manager.pull()).rejects.toMatchObject({
            name: "GitConflictError",
            files: ["note.md"],
        });

        expect((await manager.status()).conflicted).toEqual(["note.md"]);
        expect(plugin.displayError).not.toHaveBeenCalled();
        expect(plugin.setPluginState).toHaveBeenLastCalledWith({
            operation: GitOperation.idle,
        });
    });

    it("autostashes local changes when rebasing with autostash enabled", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await createRemoteCommit(repo);
        repo.write("note.md", "local change\n");
        await repo.git.addConfig("rebase.autoStash", "false");
        plugin.settings.syncMethod = "rebase";
        plugin.settings.mergeStrategy = "none";
        plugin.settings.rebaseAutoStash = "enabled";

        const changes = await manager.pull();

        expect(changes).toEqual({
            status: "updated",
            files: [
                {
                    path: "remote.md",
                    workingDir: "P",
                    vaultPath: "remote.md",
                },
            ],
            outsideVault: 0,
        });
        expect(await repo.show("HEAD:remote.md")).toBe("remote");
        expect(readFileSync(path.join(repo.repoPath, "note.md"), "utf8")).toBe(
            "local change\n"
        );
        expect(await repo.raw(["stash", "list"])).toBe("");
    });

    it("disables autostash when rebasing even when Git enables it", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await createRemoteCommit(repo);
        repo.write("note.md", "local change\n");
        await repo.git.addConfig("rebase.autoStash", "true");
        const headBefore = await repo.head();
        plugin.settings.syncMethod = "rebase";
        plugin.settings.mergeStrategy = "none";
        plugin.settings.rebaseAutoStash = "disabled";

        await expect(manager.pull()).rejects.toThrow();
        expect(await repo.head()).toBe(headBefore);
        expect(readFileSync(path.join(repo.repoPath, "note.md"), "utf8")).toBe(
            "local change\n"
        );
        expect(plugin.displayError).not.toHaveBeenCalled();
    });

    it("uses the Git autostash configuration when requested", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await createRemoteCommit(repo);
        repo.write("note.md", "local change\n");
        await repo.git.addConfig("rebase.autoStash", "true");
        plugin.settings.syncMethod = "rebase";
        plugin.settings.mergeStrategy = "none";
        plugin.settings.rebaseAutoStash = "git-config";

        const changes = await manager.pull();

        expect(changes).toMatchObject({
            status: "updated",
            files: [{ path: "remote.md" }],
        });
        expect(await repo.show("HEAD:remote.md")).toBe("remote");
        expect(readFileSync(path.join(repo.repoPath, "note.md"), "utf8")).toBe(
            "local change\n"
        );
        expect(await repo.raw(["stash", "list"])).toBe("");
    });

    it("clears progress when done without manually setting pull progress", async () => {
        const { plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        plugin.settings.syncMethod = "merge";
        plugin.settings.mergeStrategy = "none";
        const statusBar = addStatusBar(plugin);

        await manager.pull();

        expect(statusBar.displayProgress).not.toHaveBeenCalled();
        expect(statusBar.clearProgress).toHaveBeenCalledWith(false);
    });

    it("resets the current branch to upstream when sync method is reset", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await createRemoteCommit(repo);
        plugin.settings.syncMethod = "reset";

        const changes = await manager.pull();

        expect(changes).toEqual({
            status: "updated",
            files: [
                {
                    path: "remote.md",
                    workingDir: "P",
                    vaultPath: "remote.md",
                },
            ],
            outsideVault: 0,
        });
        expect(await repo.headMessage()).toBe("remote commit");
        expect(await repo.show("HEAD:remote.md")).toBe("remote");
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
    });

    it("reports an error when no current branch is checked out", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.raw(["checkout", "--quiet", "--detach"]);
        const fetch = vi.spyOn(manager.git, "fetch");

        await expect(manager.pull()).rejects.toThrow(
            "No current branch found. Cannot pull."
        );
        expect(plugin.displayError).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.pull }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("updates submodules only when no tracking branch exists", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("local-only");
        const headBefore = await repo.head();
        plugin.settings.updateSubmodules = true;

        const changes = await manager.pull();

        expect(changes).toEqual({
            status: "skipped",
            reason: "no-upstream",
        });
        expect(await repo.head()).toBe(headBefore);
        expect(plugin.log).toHaveBeenCalledWith(
            "No tracking branch found. Ignoring pull of main repo and updated submodules only."
        );
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });

    it("skips pulling when no tracking branch exists", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("local-only");
        const headBefore = await repo.head();

        const changes = await manager.pull();

        expect(changes).toEqual({
            status: "skipped",
            reason: "no-upstream",
        });
        expect(await repo.head()).toBe(headBefore);
        expect(plugin.log).toHaveBeenCalledWith(
            "No tracking branch found. Ignoring pull."
        );
        expect(plugin.displayError).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });
});

describe("SimpleGit.push", () => {
    it("pushes local commits and returns the changed file count", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.appendAndCommit("note.md", "local\n", "local commit");

        const result = await manager.push();

        expect(result).toEqual({ status: "pushed", files: 1 });
        expect(await repo.unpushedCount()).toBe(0);
        expect(await repo.show("origin/main:note.md")).toBe("base\nlocal");
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.push }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("returns null when pushing without a tracking branch", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("local-only");
        await repo.git.addConfig("push.default", "current");
        await repo.writeAndCommit("local-only.md", "local\n", "local only");

        expect(await manager.canPush()).toBe(true);
        const result = await manager.push();

        expect(result).toEqual({ status: "pushed", files: null });
        expect(await manager.canPush()).toBe(false);
        expect(
            await repo.raw(["ls-remote", "--heads", "origin", "local-only"])
        ).toContain(await repo.head());
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.push }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("uses the push target when it differs from the upstream branch", async () => {
        const { repo, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("dev");
        await repo.raw(["branch", "--set-upstream-to=origin/main", "dev"]);
        await repo.git.addConfig("push.default", "current");
        await repo.writeAndCommit(
            "dev-only.md",
            "published\n",
            "published on dev"
        );
        await repo.git.push(["--quiet"]);

        expect(await manager.getUnpushedCommits()).toBe(0);
        expect(await manager.canPush()).toBe(false);

        await repo.writeAndCommit("new.md", "new\n", "new on dev");

        expect(await manager.getUnpushedCommits()).toBe(1);
        expect(await manager.canPush()).toBe(true);
        expect(await manager.push()).toEqual({ status: "pushed", files: 1 });
        expect(await manager.getUnpushedCommits()).toBe(0);
        expect(await manager.canPush()).toBe(false);
    });

    it("clears progress when done without manually setting push progress", async () => {
        const { plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        const statusBar = addStatusBar(plugin);

        await expect(manager.push()).resolves.toEqual({
            status: "up-to-date",
        });

        expect(statusBar.displayProgress).not.toHaveBeenCalled();
        expect(statusBar.clearProgress).toHaveBeenCalledWith(false);
    });

    it("returns a blocked result when no current branch is checked out", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.raw(["checkout", "--quiet", "--detach"]);
        const push = vi.spyOn(manager.git, "push");

        const result = await manager.push();

        expect(result).toEqual({ status: "blocked", reason: "no-branch" });
        expect(plugin.displayError).not.toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
        expect(plugin.setPluginState.mock.calls).toEqual([
            [{ operation: GitOperation.push }],
            [{ operation: GitOperation.idle }],
        ]);
    });

    it("updates submodules only when no push target exists", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("local-only");
        await repo.writeAndCommit("local-only.md", "local\n", "local only");
        plugin.settings.updateSubmodules = true;

        const result = await manager.push();

        expect(result).toEqual({
            status: "skipped",
            reason: "no-upstream",
        });
        expect(
            await repo.raw(["ls-remote", "--heads", "origin", "local-only"])
        ).toBe("");
        expect(plugin.log).toHaveBeenCalledWith(
            "No push target found. Ignoring push of main repo and updating submodules only."
        );
    });
});

describe("SimpleGit.branchInfo", () => {
    it("returns the current branch, its upstream and all local branches", async () => {
        const { repo, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.raw(["branch", "feature"]);

        expect(await manager.branchInfo()).toEqual({
            current: "main",
            tracking: "origin/main",
            branches: ["feature", "main"],
        });
    });

    it("returns no upstream for a branch without one", async () => {
        const { repo, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("local-only");

        expect(await manager.branchInfo()).toEqual({
            current: "local-only",
            tracking: undefined,
            branches: ["local-only", "main"],
        });
    });

    it("returns no current branch when HEAD is detached", async () => {
        const { repo, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.raw(["checkout", "--quiet", "--detach"]);

        expect(await manager.branchInfo()).toEqual({
            current: undefined,
            tracking: undefined,
            branches: ["main"],
        });
    });

    it("returns the current branch before the first commit", async () => {
        const { manager } = withCleanup(
            await createSimpleGitTestContext({
                fixture: createEmptyRepo,
            })
        );

        expect(await manager.branchInfo()).toEqual({
            current: "main",
            tracking: undefined,
            branches: [],
        });
    });
});

describe("SimpleGit.fetch", () => {
    it("sets the fetch operation and clears progress when done", async () => {
        const { plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        const statusBar = addStatusBar(plugin);

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
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkout(["--quiet", "-b", "feature"]);
        await repo.git.checkout(["--quiet", "main"]);
        const statusBar = addStatusBar(plugin);

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
        const { manager } = withCleanup(await createSimpleGitTestContext());
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
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        await repo.appendAndCommit("note.md", "two\n", "commit two");

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

    it("squashes against the push target when it differs from the upstream branch", async () => {
        const { repo, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("dev");
        await repo.raw(["branch", "--set-upstream-to=origin/main", "dev"]);
        await repo.git.addConfig("push.default", "current");
        await repo.appendAndCommit(
            "note.md",
            "published\n",
            "published on dev"
        );
        await repo.git.push(["--quiet"]);
        const publishedHead = await repo.head();
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        await repo.appendAndCommit("note.md", "two\n", "commit two");

        await manager.squashAllUnpushedCommits();

        expect(await repo.unpushedCount("origin/dev")).toBe(1);
        expect(await repo.raw(["rev-parse", "HEAD^"])).toBe(publishedHead);
        expect(await repo.show("HEAD:note.md")).toBe(
            "base\npublished\none\ntwo"
        );
        await expect(repo.git.push(["--quiet"])).resolves.toBeDefined();
        expect(await repo.raw(["rev-parse", "origin/dev"])).toBe(
            await repo.head()
        );
    });

    it("does nothing when there is only one unpushed commit", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        const headBefore = await repo.head();

        await manager.squashAllUnpushedCommits();

        expect(await repo.head()).toBe(headBefore);
        expect(await repo.unpushedCount()).toBe(1);
        expect(plugin.setPluginState).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });

    it("does nothing before the push target has been created", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.git.checkoutLocalBranch("dev");
        await repo.raw(["branch", "--set-upstream-to=origin/main", "dev"]);
        await repo.git.addConfig("push.default", "current");
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        await repo.appendAndCommit("note.md", "two\n", "commit two");
        const headBefore = await repo.head();

        await manager.squashAllUnpushedCommits();

        expect(await repo.head()).toBe(headBefore);
        expect(plugin.setPluginState).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });

    it("does nothing when staged changes are present", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        await repo.appendAndCommit("note.md", "one\n", "commit one");
        await repo.appendAndCommit("note.md", "two\n", "commit two");
        repo.write("staged.md", "staged\n");
        await repo.git.add("staged.md");
        const headBefore = await repo.head();

        await manager.squashAllUnpushedCommits();

        expect(await repo.head()).toBe(headBefore);
        expect(await repo.unpushedCount()).toBe(2);
        expect(await repo.cachedDiffNames()).toBe("staged.md");
        expect(plugin.setPluginState).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });

    it("does nothing when unpushed history contains a merge commit", async () => {
        const { repo, plugin, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
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

        await manager.squashAllUnpushedCommits();

        expect(await repo.head()).toBe(headBefore);
        expect(await repo.mergeCommitCount()).toBe(1);
        expect(plugin.setPluginState).not.toHaveBeenCalled();
        expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
    });
});

describe("SimpleGit.show", () => {
    it("applies the configured textconv filter", async () => {
        const { repo, manager } = withCleanup(
            await createSimpleGitTestContext()
        );
        repo.write(".gitattributes", "*.secret diff=upper\n");
        await repo.writeAndCommit("note.secret", "hidden\n", "add secret");
        await manager.setConfig("diff.upper.textconv", "tr a-z A-Z <");

        const content = await manager.show("HEAD", "note.secret");

        expect(content).toBe("HIDDEN\n");
    });
});
