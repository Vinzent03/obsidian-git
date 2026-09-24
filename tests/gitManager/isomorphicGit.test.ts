import { readFile, stat } from "fs/promises";
import path from "path";
import git, { Errors } from "isomorphic-git";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withCleanup } from "../helpers/cleanup";
import {
    createRepoWithMergeConflict,
    createRepoWithOrigin,
} from "../helpers/gitRepo";
import { createIsomorphicGitManager } from "../helpers/isomorphicGit";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("IsomorphicGit merge state", () => {
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

    it("refreshes conflict handling from an unmerged-paths commit error", async () => {
        const repo = withCleanup(await createRepoWithMergeConflict());
        const { manager, updateCachedStatus } = createIsomorphicGitManager(
            repo.repoPath
        );

        await expect(
            manager.commit({ message: "still conflicted" })
        ).rejects.toBeInstanceOf(Errors.UnmergedPathsError);

        expect(updateCachedStatus).toHaveBeenCalledWith();
        expect(await manager.isMergeInProgress()).toBe(true);
    });

    it("writes canonical merge metadata when an isomorphic merge conflicts", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const { manager, updateCachedStatus } = createIsomorphicGitManager(
            repo.repoPath
        );
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

        await expect(manager.pull()).rejects.toBeInstanceOf(
            Errors.MergeConflictError
        );

        await expect(
            readFile(path.join(repo.repoPath, ".git", "ORIG_HEAD"), "utf8")
        ).resolves.toBe(`${"a".repeat(40)}\n`);
        await expect(
            readFile(path.join(repo.repoPath, ".git", "MERGE_HEAD"), "utf8")
        ).resolves.toBe(`${"b".repeat(40)}\n`);
        await expect(
            readFile(path.join(repo.repoPath, ".git", "MERGE_MSG"), "utf8")
        ).resolves.toBe("Merge branch 'origin/main' into main\n");
        expect(updateCachedStatus).toHaveBeenCalledWith();
    });
});
