import { afterEach, describe, expect, it, vi } from "vitest";
import { GitActions } from "../../src/gitActions";
import { IsomorphicGit } from "../../src/gitManager/isomorphicGit";
import { GitConflictError, type FileStatusResult } from "../../src/types";
import {
    gitManagerBackends,
    type GitManagerTestHarness,
} from "../helpers/gitManagerHarness";
import { createRepoWithMergeConflict } from "../helpers/gitRepo";

function statusByPath(
    files: FileStatusResult[]
): Map<string, FileStatusResult> {
    return new Map(files.map((file) => [file.path, file]));
}

describe.each(gitManagerBackends)("$name GitManager contract", (backend) => {
    let context: GitManagerTestHarness | undefined;

    afterEach(() => {
        context?.cleanup();
        context = undefined;
    });

    it("reports repository-relative paths and consistent file states", async () => {
        context = await backend.create();
        const { manager, repo } = context;
        await repo.writeAndCommit(
            "deleted.md",
            "deleted\n",
            "add deleted file"
        );
        repo.write("note.md", "modified\n");
        repo.write("staged.md", "staged\n");
        repo.write("untracked.md", "untracked\n");
        await repo.git.add("staged.md");
        repo.remove("deleted.md");

        const status = await manager.status();
        const files = statusByPath(status.all);
        const basePath = context.plugin.settings.basePath;

        expect([...files.keys()].sort()).toEqual([
            "deleted.md",
            "note.md",
            "staged.md",
            "untracked.md",
        ]);
        expect(files.get("note.md")).toMatchObject({
            path: "note.md",
            vaultPath: `${basePath}/note.md`,
            index: " ",
            workingDir: "M",
        });
        expect(files.get("staged.md")).toMatchObject({
            path: "staged.md",
            vaultPath: `${basePath}/staged.md`,
            index: "A",
            workingDir: " ",
        });
        expect(files.get("untracked.md")).toMatchObject({
            path: "untracked.md",
            vaultPath: `${basePath}/untracked.md`,
            index: "U",
            workingDir: "U",
        });
        expect(files.get("deleted.md")).toMatchObject({
            path: "deleted.md",
            vaultPath: `${basePath}/deleted.md`,
            index: " ",
            workingDir: "D",
        });
        expect(status.changed.map((file) => file.path).sort()).toEqual([
            "deleted.md",
            "note.md",
            "untracked.md",
        ]);
        expect(status.staged.map((file) => file.path)).toEqual(["staged.md"]);
    });

    it("reads a file snapshot from a commit without changing the working tree", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        const commit = await repo.head();
        repo.write("note.md", "working tree\n");

        await expect(
            manager.show(commit, `${plugin.settings.basePath}/note.md`)
        ).resolves.toBe("base\n");
        await expect(manager.show(commit, "note.md", false)).resolves.toBe(
            "base\n"
        );
        await expect(repo.statusPorcelain()).resolves.toBe("M note.md");
    });

    it("updates status after staging and unstaging a vault-relative path", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        repo.write("note.md", "changed\n");
        const vaultPath = `${plugin.settings.basePath}/note.md`;

        await manager.stage(vaultPath, true);

        let status = await manager.status();
        expect(status.changed).toEqual([]);
        expect(status.staged).toHaveLength(1);
        expect(status.staged[0]).toMatchObject({
            path: "note.md",
            vaultPath,
            index: "M",
            workingDir: " ",
        });

        await manager.unstage(vaultPath, true);

        status = await manager.status();
        expect(status.staged).toEqual([]);
        expect(status.changed).toHaveLength(1);
        expect(status.changed[0]).toMatchObject({
            path: "note.md",
            vaultPath,
            index: " ",
            workingDir: "M",
        });
    });

    it("commits staged changes without staging unstaged changes", async () => {
        context = await backend.create();
        const { manager, repo } = context;
        repo.write("staged.md", "staged\n");
        repo.write("unstaged.md", "unstaged\n");
        await repo.git.add("staged.md");

        const committedFiles = await manager.commit({
            message: "commit staged",
        });

        expect(committedFiles).toBe(1);
        expect(await repo.headMessage()).toBe("commit staged");
        expect(await repo.show("HEAD:staged.md")).toBe("staged");
        expect(await repo.statusPorcelain()).toBe("?? unstaged.md");
    });

    it("amends the previous commit and returns the committed file count", async () => {
        context = await backend.create();
        const { manager, repo } = context;
        const headBefore = await repo.head();
        repo.write("note.md", "base\namended\n");
        await repo.git.add("note.md");

        const committedFiles = await manager.commit({
            message: "amended base",
            amend: true,
        });

        expect(committedFiles).toBe(1);
        expect(await repo.head()).not.toBe(headBefore);
        expect(await repo.headMessage()).toBe("amended base");
        expect(await repo.unpushedCount()).toBe(1);
        expect(await repo.show("HEAD:note.md")).toBe("base\namended");
        expect(await repo.statusPorcelain()).toBe("");
    });

    it("amends while staging all changes", async () => {
        context = await backend.create();
        const { manager, repo } = context;
        const headBefore = await repo.head();
        repo.write("note.md", "base\namended all\n");

        const committedFiles = await manager.commitAll({
            message: "amended all",
            amend: true,
        });

        expect(committedFiles).toBe(1);
        expect(await repo.head()).not.toBe(headBefore);
        expect(await repo.headMessage()).toBe("amended all");
        expect(await repo.show("HEAD:note.md")).toBe("base\namended all");
        expect(await repo.statusPorcelain()).toBe("");
    });

    it("stages and commits tracked, untracked, and deleted files", async () => {
        context = await backend.create();
        const { manager, repo } = context;
        await repo.writeAndCommit(
            "delete-me.md",
            "delete me\n",
            "add deleted file"
        );
        await repo.git.push(["--quiet"]);
        repo.write("note.md", "base\nchanged\n");
        repo.write("created.md", "created\n");
        repo.remove("delete-me.md");

        const committedFiles = await manager.commitAll({
            message: "commit all",
        });

        expect(committedFiles).toBe(3);
        expect(await repo.headMessage()).toBe("commit all");
        expect(await repo.show("HEAD:note.md")).toBe("base\nchanged");
        expect(await repo.show("HEAD:created.md")).toBe("created");
        expect(await repo.statusPorcelain()).toBe("");
        await expect(repo.show("HEAD:delete-me.md")).rejects.toThrow();
    });

    it("leaves excluded files and folders unstaged when committing all files", async () => {
        context = await backend.create();
        const { manager, repo } = context;
        await repo.writeAndCommit(
            "scripts/tracked.js",
            "base\n",
            "add tracked script"
        );
        await repo.writeAndCommit(
            "scripts/deleted.js",
            "deleted\n",
            "add deleted script"
        );
        repo.write("note.md", "base\nchanged\n");
        repo.write("scripts/tracked.js", "staged\n");
        await manager.stage("scripts/tracked.js", false);
        repo.write("scripts/tracked.js", "unstaged\n");
        repo.remove("scripts/deleted.js");
        repo.write("scripts/new/created.js", "created\n");
        repo.write("scripts-old/kept.js", "kept\n");
        repo.write("drafts/new.md", "new\n");
        repo.write("..drafts/dotted.md", "dotted\n");

        const committedFiles = await manager.commitAll({
            message: "commit all but excluded",
            excludedVaultPaths: [
                manager.getRelativeVaultPath("scripts"),
                manager.getRelativeVaultPath("drafts/new.md"),
                manager.getRelativeVaultPath("..drafts"),
                // Outside the repository, so it can never match.
                "outside",
            ],
        });

        expect(committedFiles).toBe(3);
        expect(await repo.show("HEAD:note.md")).toBe("base\nchanged");
        expect(await repo.show("HEAD:scripts-old/kept.js")).toBe("kept");
        // Manually staged content is committed, newer edits are not.
        expect(await repo.show("HEAD:scripts/tracked.js")).toBe("staged");
        expect(await repo.show("HEAD:scripts/deleted.js")).toBe("deleted");
        // statusPorcelain() trims the leading space of the first entry.
        expect(await repo.statusPorcelain()).toBe(
            [
                "D scripts/deleted.js",
                " M scripts/tracked.js",
                "?? ..drafts/",
                "?? drafts/",
                "?? scripts/new/",
            ].join("\n")
        );
    });

    it("commits only the existing index when an exclusion contains the repository", async () => {
        context = await backend.create();
        const { manager, repo } = context;
        repo.write("note.md", "staged\n");
        await manager.stage("note.md", false);
        repo.write("note.md", "unstaged\n");
        repo.write("created.md", "created\n");

        const committedFiles = await manager.commitAll({
            message: "commit index only",
            excludedVaultPaths: [manager.getRelativeVaultPath("")],
        });

        expect(committedFiles).toBe(1);
        expect(await repo.show("HEAD:note.md")).toBe("staged");
        expect(await repo.statusPorcelain()).toBe(
            ["M note.md", "?? created.md"].join("\n")
        );
    });

    it("normalizes detached HEAD and handles operations without a current branch", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        await repo.raw(["checkout", "--quiet", "--detach", "HEAD"]);

        const branchInfo = await manager.branchInfo();

        expect(branchInfo.current).toBeUndefined();
        expect(branchInfo.tracking).toBeUndefined();
        await expect(manager.canPush()).resolves.toBe(false);
        await expect(manager.pull()).rejects.toThrow(
            "No current branch found. Cannot pull."
        );
        expect(plugin.displayError).not.toHaveBeenCalled();
        await expect(manager.push()).resolves.toEqual({
            status: "blocked",
            reason: "no-branch",
        });
        expect(plugin.displayError).not.toHaveBeenCalled();
    });

    it("normalizes a missing tracking branch and skips pulling", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        await repo.git.checkoutLocalBranch("local-only");

        const branchInfo = await manager.branchInfo();

        expect(branchInfo.current).toBe("local-only");
        expect(branchInfo.tracking).toBeUndefined();
        await expect(manager.canPush()).resolves.toBe(false);
        await expect(manager.pull()).resolves.toEqual({
            status: "skipped",
            reason: "no-upstream",
        });
        expect(plugin.log).toHaveBeenCalledWith(
            "No tracking branch found. Ignoring pull."
        );
    });

    it("returns an explicit result when a pull is up to date", async () => {
        context = await backend.create();
        vi.spyOn(context.manager, "fetch").mockResolvedValue();

        await expect(context.manager.pull()).resolves.toEqual({
            status: "up-to-date",
        });
    });

    it("removes a conflict after staging while keeping the merge active", async () => {
        context = await backend.create(createRepoWithMergeConflict);
        const { manager, repo } = context;
        repo.write("untracked.md", "untracked\n");

        const status = await manager.status();
        expect(status.conflicted).toEqual(["note.md"]);
        expect(status.all.map((file) => file.path)).toContain("note.md");
        expect(status.changed.map((file) => file.path)).not.toContain(
            "note.md"
        );
        expect(status.changed).toContainEqual(
            expect.objectContaining({
                path: "untracked.md",
                index: "U",
                workingDir: "U",
            })
        );
        expect(await manager.isMergeInProgress()).toBe(true);

        repo.write("note.md", "resolved\n");
        await manager.stage("note.md", false);

        expect((await manager.status()).conflicted).toEqual([]);
        expect(await manager.isMergeInProgress()).toBe(true);
    });

    it("creates a two-parent merge commit and clears the merge state", async () => {
        context = await backend.create(createRepoWithMergeConflict);
        const { manager, repo } = context;
        repo.write("note.md", "resolved\n");
        await manager.stage("note.md", false);

        const committedFiles = await manager.commit({
            message: "resolve merge",
        });

        const [commit, ...parents] = (
            await repo.raw(["rev-list", "--parents", "-n", "1", "HEAD"])
        ).split(" ");
        expect(commit).toBe(await repo.head());
        expect(parents).toHaveLength(2);
        expect(await repo.headMessage()).toBe("resolve merge");
        expect(await repo.show("HEAD:note.md")).toBe("resolved");
        expect(await manager.isMergeInProgress()).toBe(false);
        expect(committedFiles).toBe(1);
    });

    it("finishes a merge resolved to ours with no staged changes", async () => {
        context = await backend.create(createRepoWithMergeConflict);
        const { manager, repo } = context;
        repo.write("note.md", "ours\n");
        await manager.stage("note.md", false);

        const status = await manager.status();
        expect(status.conflicted).toEqual([]);
        expect(status.staged).toEqual([]);
        expect(status.changed).toEqual([]);
        expect(await manager.isMergeInProgress()).toBe(true);

        const committedFiles = await manager.commit({
            message: "resolve merge",
        });

        expect(committedFiles).toBe(0);
        expect(
            (await repo.raw(["rev-list", "--parents", "-n", "1", "HEAD"]))
                .split(" ")
                .slice(1)
        ).toHaveLength(2);
        expect(await manager.isMergeInProgress()).toBe(false);
    });

    it("commits an empty resolved merge in smart mode without automatic staging", async () => {
        context = await backend.create(createRepoWithMergeConflict);
        const { manager, plugin, repo } = context;
        repo.write("note.md", "ours\n");
        await manager.stage("note.md", false);
        plugin.state.mergeInProgress = true;
        plugin.settings.autoStageOnEmptyIndex = false;
        plugin.updateCachedStatus = vi.fn(() => manager.status());
        plugin.isAllInitialized = vi.fn().mockResolvedValue(true);
        plugin.tools = {
            hasTooBigFiles: vi.fn().mockResolvedValue(false),
        } as unknown as typeof plugin.tools;
        plugin.displayMessage = vi.fn();

        const result = await new GitActions(plugin).commit({
            fromAuto: false,
            commitMessage: "resolve merge",
            mode: "smart",
        });

        expect(result).toEqual({
            status: "success",
            value: { status: "committed", files: 0 },
        });
        expect(await manager.isMergeInProgress()).toBe(false);
    });

    it("commits all changes without extra working tree walks", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        await repo.writeAndCommit("deleted.md", "deleted\n", "add deleted");
        repo.write("note.md", "modified\n");
        repo.write("untracked.md", "untracked\n");
        repo.remove("deleted.md");
        const extraWalks =
            manager instanceof IsomorphicGit
                ? [
                      vi.spyOn(manager, "getUnstagedFiles"),
                      vi.spyOn(manager, "getStagedFiles"),
                  ]
                : [];
        plugin.updateCachedStatus = vi.fn(() => manager.status());
        plugin.isAllInitialized = vi.fn().mockResolvedValue(true);
        plugin.tools = {
            hasTooBigFiles: vi.fn().mockResolvedValue(false),
        } as unknown as typeof plugin.tools;
        plugin.displayMessage = vi.fn();

        const result = await new GitActions(plugin).commit({
            fromAuto: false,
            commitMessage: "commit all",
            mode: "all",
        });

        expect(result).toEqual({
            status: "success",
            value: { status: "committed", files: 3 },
        });
        for (const walk of extraWalks) {
            expect(walk).not.toHaveBeenCalled();
        }
        expect((await manager.status()).all).toEqual([]);
    });

    it("lists staged files in the commit message", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        await repo.writeAndCommit("deleted.md", "deleted\n", "add deleted");
        repo.write("note.md", "modified\n");
        repo.write("added.md", "added\n");
        repo.write("unstaged.md", "unstaged\n");
        repo.remove("deleted.md");
        await manager.stage("note.md", false);
        await manager.stage("added.md", false);
        await manager.stage("deleted.md", false);
        plugin.settings.listChangedFilesInMessageBody = true;
        const status = vi.spyOn(manager, "status");

        const message = await manager.formatCommitMessage(
            "{{numFiles}} files: {{files}}"
        );

        const [summary, body] = message.split("\n\nAffected files:\n");
        expect(summary).toMatch(/^3 files: /);
        expect(summary).toContain("A added.md");
        expect(summary).toContain("D deleted.md");
        expect(summary).toContain("M note.md");
        expect(body?.split("\n").sort()).toEqual([
            "added.md",
            "deleted.md",
            "note.md",
        ]);
        if (manager instanceof IsomorphicGit) {
            expect(status).not.toHaveBeenCalled();
        }
    });

    it("does not refresh the status between pull and push in commit-and-sync", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        repo.write("note.md", "modified\n");
        const events: string[] = [];
        plugin.settings.pullBeforePush = true;
        plugin.settings.syncMethod = "merge";
        plugin.settings.disablePush = false;
        plugin.updateCachedStatus = vi.fn(() => {
            events.push("status");
            return manager.status();
        });
        plugin.isAllInitialized = vi.fn().mockResolvedValue(true);
        plugin.tools = {
            hasTooBigFiles: vi.fn().mockResolvedValue(false),
        } as unknown as typeof plugin.tools;
        plugin.displayMessage = vi.fn();
        vi.spyOn(manager, "pull").mockImplementation(() => {
            events.push("pull");
            return Promise.resolve({ status: "up-to-date" });
        });
        vi.spyOn(manager, "canPush").mockResolvedValue(true);
        vi.spyOn(manager, "push").mockImplementation(() => {
            events.push("push");
            return Promise.resolve({ status: "pushed", files: 1 });
        });

        const result = await new GitActions(plugin).commitAndSync({
            fromAutoBackup: false,
            commitMessage: "sync",
        });

        expect(result).toMatchObject({
            status: "success",
            value: { status: "synced" },
        });
        expect(events.slice(events.indexOf("pull"))).toEqual(["pull", "push"]);
    });

    it("applies excluded paths to auto commits only", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        repo.write("scripts/run.js", "run\n");
        plugin.settings.autoCommitExcludedPaths =
            manager.getRelativeVaultPath("scripts") + "/\n\n";
        plugin.updateCachedStatus = vi.fn(() => manager.status());
        plugin.isAllInitialized = vi.fn().mockResolvedValue(true);
        plugin.tools = {
            hasTooBigFiles: vi.fn().mockResolvedValue(false),
        } as unknown as typeof plugin.tools;
        plugin.displayMessage = vi.fn();
        const actions = new GitActions(plugin);
        const headBefore = await repo.head();

        const autoResult = await actions.commit({
            fromAuto: true,
            commitMessage: "auto",
            mode: "all",
        });

        expect(autoResult).toEqual({
            status: "success",
            value: { status: "nothing-to-commit", reason: "no-changes" },
        });
        expect(await repo.head()).toBe(headBefore);

        const manualResult = await actions.commit({
            fromAuto: false,
            commitMessage: "manual",
            mode: "all",
        });

        expect(manualResult).toEqual({
            status: "success",
            value: { status: "committed", files: 1 },
        });
        expect(await repo.show("HEAD:scripts/run.js")).toBe("run");
    });

    it("does not commit when the only change is an excluded file in an untracked folder", async () => {
        context = await backend.create();
        const { manager, plugin, repo } = context;
        repo.write("drafts/new.md", "new\n");
        plugin.settings.autoCommitExcludedPaths =
            manager.getRelativeVaultPath("drafts/new.md");
        plugin.updateCachedStatus = vi.fn(() => manager.status());
        plugin.isAllInitialized = vi.fn().mockResolvedValue(true);
        plugin.tools = {
            hasTooBigFiles: vi.fn().mockResolvedValue(false),
        } as unknown as typeof plugin.tools;
        plugin.displayMessage = vi.fn();
        const headBefore = await repo.head();

        const result = await new GitActions(plugin).commit({
            fromAuto: true,
            commitMessage: "auto",
            mode: "all",
        });

        expect(result).toEqual({
            status: "success",
            value: { status: "nothing-to-commit", reason: "no-changes" },
        });
        expect(await repo.head()).toBe(headBefore);
        expect(await repo.statusPorcelain()).toBe("?? drafts/");
    });

    it("counts merge changes when committing all files", async () => {
        context = await backend.create(createRepoWithMergeConflict);
        const { manager, repo } = context;
        repo.write("note.md", "resolved\n");

        const committedFiles = await manager.commitAll({
            message: "resolve merge",
        });

        expect(committedFiles).toBe(1);
        expect(await repo.show("HEAD:note.md")).toBe("resolved");
        expect(await manager.isMergeInProgress()).toBe(false);
    });

    it("normalizes an unmerged-paths commit failure without displaying it", async () => {
        context = await backend.create(createRepoWithMergeConflict);
        const { manager, plugin } = context;

        await expect(
            manager.commit({ message: "still conflicted" })
        ).rejects.toBeInstanceOf(GitConflictError);

        expect(plugin.displayError).not.toHaveBeenCalled();
    });
});
