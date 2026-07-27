import type { SimpleGit as SimpleGitClient } from "simple-git";
import { describe, expect, it } from "vitest";
import { SimpleGit } from "../../src/gitManager/simpleGit";
import { CurrentGitAction } from "../../src/types";
import { withCleanup } from "../helpers/cleanup";
import { createFakePlugin, type FakePlugin } from "../helpers/createFakePlugin";
import { createRepoWithOrigin } from "../helpers/gitRepo";

function createManager(
    repoPath: string,
    gitClient: SimpleGitClient,
    plugin: FakePlugin = createFakePlugin()
): SimpleGit {
    const manager = new SimpleGit(plugin);
    manager.git = gitClient;
    manager.absoluteRepoPath = repoPath;
    return manager;
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
            [{ gitAction: CurrentGitAction.commit }],
            [{ gitAction: CurrentGitAction.idle }],
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
            [{ gitAction: CurrentGitAction.add }],
            [{ gitAction: CurrentGitAction.commit }],
            [{ gitAction: CurrentGitAction.idle }],
        ]);
        expect(plugin.app.workspace.trigger).toHaveBeenCalledWith(
            "obsidian-git:head-change"
        );
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
            [{ gitAction: CurrentGitAction.commit }],
            [{ gitAction: CurrentGitAction.idle }],
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
