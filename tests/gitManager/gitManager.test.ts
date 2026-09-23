import { afterEach, describe, expect, it } from "vitest";
import type { FileStatusResult } from "../../src/types";
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

        await manager.commit({ message: "commit staged" });

        expect(await repo.headMessage()).toBe("commit staged");
        expect(await repo.show("HEAD:staged.md")).toBe("staged");
        expect(await repo.statusPorcelain()).toBe("?? unstaged.md");
    });

    it("removes a conflict after staging while keeping the merge active", async () => {
        context = await backend.create(createRepoWithMergeConflict);
        const { manager, repo } = context;

        expect((await manager.status()).conflicted).toEqual(["note.md"]);
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

        await manager.commit({ message: "resolve merge" });

        const [commit, ...parents] = (
            await repo.raw(["rev-list", "--parents", "-n", "1", "HEAD"])
        ).split(" ");
        expect(commit).toBe(await repo.head());
        expect(parents).toHaveLength(2);
        expect(await repo.headMessage()).toBe("resolve merge");
        expect(await repo.show("HEAD:note.md")).toBe("resolved");
        expect(await manager.isMergeInProgress()).toBe(false);
    });
});
