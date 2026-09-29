import { mkdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import SplitDiffView, { getSplitDiffTimeout } from "src/ui/diff/splitDiffView";
import { withCleanup } from "../../helpers/cleanup";
import {
    createRepoWithMergeConflict,
    createRepoWithOrigin,
} from "../../helpers/gitRepo";
import { createSimpleGitTestContext } from "../../helpers/simpleGit";

describe("getSplitDiffTimeout", () => {
    it("uses ten times the configured timeout for read-only diffs", () => {
        expect(getSplitDiffTimeout(75, true)).toBe(75);
        expect(getSplitDiffTimeout(75, false)).toBe(750);
    });

    it("falls back to the default timeout for invalid persisted values", () => {
        expect(getSplitDiffTimeout(0, true)).toBe(50);
        expect(getSplitDiffTimeout(-1, true)).toBe(50);
        expect(getSplitDiffTimeout(1.5, false)).toBe(500);
        expect(getSplitDiffTimeout(Number.NaN, true)).toBe(50);
    });
});

describe("SplitDiffView.gitShow", () => {
    it("reads our index version of an unmerged file", async () => {
        const { manager } = withCleanup(
            await createSimpleGitTestContext({
                fixture: createRepoWithMergeConflict,
            })
        );
        const view = Object.assign(Object.create(SplitDiffView.prototype), {
            plugin: { gitManager: manager },
        }) as SplitDiffView;

        await expect(view.gitShow("", "note.md")).resolves.toBe("ours\n");
        await expect(view.gitShow("HEAD", "note.md")).resolves.toBe("ours\n");
    });

    it("uses an empty comparison when our side deleted the file", async () => {
        const { manager } = withCleanup(
            await createSimpleGitTestContext({
                fixture: async () => {
                    const repo = await createRepoWithOrigin();
                    await repo.git.checkoutLocalBranch("other");
                    await repo.writeAndCommit(
                        "note.md",
                        "theirs\n",
                        "other change"
                    );
                    await repo.git.checkout("main");
                    repo.remove("note.md");
                    await repo.git.add("note.md");
                    await repo.git.commit("delete our copy");
                    await repo.git.merge(["other"]).catch(() => undefined);
                    return repo;
                },
            })
        );
        const view = Object.assign(Object.create(SplitDiffView.prototype), {
            plugin: { gitManager: manager },
        }) as SplitDiffView;

        await expect(view.gitShow("", "note.md")).resolves.toBe("");
    });

    it("reads stage 2 when it is the only conflict stage", async () => {
        const { manager, repo } = withCleanup(
            await createSimpleGitTestContext({
                fixture: async () => {
                    const repo = await createRepoWithOrigin();
                    await repo.git.checkoutLocalBranch("other");
                    mkdirSync(path.join(repo.repoPath, "folder"));
                    repo.write("folder/file.md", "theirs\n");
                    await repo.git.add("folder/file.md");
                    await repo.git.commit("add directory");
                    await repo.git.checkout("main");
                    repo.write("folder", "ours\n");
                    await repo.git.add("folder");
                    await repo.git.commit("add file");
                    await repo.git.merge(["other"]).catch(() => undefined);
                    return repo;
                },
            })
        );
        const view = Object.assign(Object.create(SplitDiffView.prototype), {
            plugin: { gitManager: manager },
        }) as SplitDiffView;

        expect(await repo.raw(["ls-files", "-u", "--", "folder~HEAD"])).toMatch(
            / 2\tfolder~HEAD$/
        );
        await expect(view.gitShow("", "folder~HEAD")).resolves.toBe("ours\n");
    });

    it("keeps reading stage 0 for a resolved file", async () => {
        const { manager, repo } = withCleanup(
            await createSimpleGitTestContext()
        );
        repo.write("note.md", "staged\n");
        await repo.git.add("note.md");
        const view = Object.assign(Object.create(SplitDiffView.prototype), {
            plugin: { gitManager: manager },
        }) as SplitDiffView;

        await expect(view.gitShow("", "note.md")).resolves.toBe("staged\n");
    });
});
