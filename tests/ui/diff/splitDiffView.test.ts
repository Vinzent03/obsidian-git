import { mkdirSync } from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";

import SplitDiffView, { getSplitDiffTimeout } from "src/ui/diff/splitDiffView";
import type { DiffViewState } from "src/types";
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

function editorWithText(text: string) {
    return {
        state: {
            doc: { toString: () => text, length: text.length },
            update: vi.fn(() => ({})),
        },
        dispatch: vi.fn(),
    };
}

/**
 * Creates a view in a vault whose repository lives in the `repo` subfolder,
 * without running the constructor that registers workspace events.
 */
function createView(state: Partial<DiffViewState>) {
    const view = Object.create(SplitDiffView.prototype) as SplitDiffView;
    const read = vi.fn().mockResolvedValue("content");
    Object.assign(view, {
        refreshing: false,
        state: { aRef: "HEAD", aFile: "note.md", bFile: "note.md", ...state },
        mergeView: { a: editorWithText("a"), b: editorWithText("content") },
        app: { vault: { adapter: { read } } },
        plugin: {
            gitManager: {
                getRelativeVaultPath: (path: string) => `repo/${path}`,
            },
        },
    });
    return { view, read };
}

describe("SplitDiffView", () => {
    it("matches the working tree file by its vault path", () => {
        const { view } = createView({ bRef: undefined });

        expect(view.isWorkingTreeBFile("repo/note.md")).toBe(true);
        expect(view.isWorkingTreeBFile("note.md")).toBe(false);
    });

    it("doesn't match files when b shows a git ref", () => {
        const { view } = createView({ bRef: "" });

        expect(view.isWorkingTreeBFile("repo/note.md")).toBe(false);
    });

    it("reads the working tree file by its vault path", async () => {
        const { view, read } = createView({ bRef: undefined });

        await view.updateModifiableEditor();

        expect(read).toHaveBeenCalledWith("repo/note.md");
    });

    it("keeps refreshing after reading the working tree file failed", async () => {
        const { view, read } = createView({ bRef: undefined });
        read.mockRejectedValueOnce(new Error("read failed"));

        await expect(view.updateModifiableEditor()).rejects.toThrow(
            "read failed"
        );

        expect(view.refreshing).toBe(false);
        await view.updateModifiableEditor();
        expect(read).toHaveBeenCalledTimes(2);
    });

    it("keeps refreshing after git show failed", async () => {
        const { view } = createView({ bRef: "" });
        const gitShow = vi
            .spyOn(view, "gitShow")
            .mockRejectedValueOnce(new Error("show failed"))
            .mockResolvedValue("a");

        await expect(view.updateRefEditors()).rejects.toThrow("show failed");

        expect(view.refreshing).toBe(false);
        await view.updateRefEditors();
        expect(gitShow).toHaveBeenCalledTimes(3);
    });
});
