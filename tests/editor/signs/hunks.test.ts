import { describe, expect, it, vi } from "vitest";
import { Hunks, type Hunk } from "../../../src/editor/signs/hunks";

function hunk(
    oldStart: number,
    oldCount: number,
    newStart: number,
    newCount: number,
    removedLines: string[] = [],
    addedLines: string[] = []
): Hunk {
    const result = Hunks.createHunk(oldStart, oldCount, newStart, newCount);
    result.removed.lines = removedLines;
    result.added.lines = addedLines;
    return result;
}

describe("Hunks.createHunk", () => {
    it("creates add, delete, and change hunks", () => {
        expect(Hunks.createHunk(1, 0, 1, 2)).toMatchObject({
            type: "add",
            head: "@@ -1 +1,2 @@",
            vend: 2,
            removed: { start: 1, count: 0 },
            added: { start: 1, count: 2 },
        });

        expect(Hunks.createHunk(3, 2, 2, 0)).toMatchObject({
            type: "delete",
            head: "@@ -3,2 +2 @@",
            vend: 2,
            removed: { start: 3, count: 2 },
            added: { start: 2, count: 0 },
        });

        expect(Hunks.createHunk(4, 1, 4, 1)).toMatchObject({
            type: "change",
            head: "@@ -4,1 +4,1 @@",
            vend: 4,
        });
    });
});

describe("Hunks.parseDiffLine", () => {
    it("parses explicit and implicit counts", () => {
        expect(Hunks.parseDiffLine("@@ -2,3 +5,4 @@")).toMatchObject({
            head: "@@ -2,3 +5,4 @@",
            removed: { start: 2, count: 3 },
            added: { start: 5, count: 4 },
        });

        expect(Hunks.parseDiffLine("@@ -2 +5 @@")).toMatchObject({
            head: "@@ -2 +5 @@",
            removed: { start: 2, count: 1 },
            added: { start: 5, count: 1 },
        });

        expect(Hunks.parseDiffLine("@@ -2 +5,4 @@")).toMatchObject({
            head: "@@ -2 +5,4 @@",
            removed: { start: 2, count: 1 },
            added: { start: 5, count: 4 },
        });

        expect(Hunks.parseDiffLine("@@ -2,3 +5 @@")).toMatchObject({
            head: "@@ -2,3 +5 @@",
            removed: { start: 2, count: 3 },
            added: { start: 5, count: 1 },
        });
    });
});

describe("Hunks.calcSigns", () => {
    it("creates signs for added lines", () => {
        expect(Hunks.calcSigns(undefined, hunk(1, 0, 1, 2), undefined)).toEqual(
            [
                { type: "add", count: 2, lnum: 1 },
                { type: "add", count: undefined, lnum: 2 },
            ]
        );
    });

    it("marks a delete at the start as a topdelete", () => {
        expect(Hunks.calcSigns(undefined, hunk(1, 2, 0, 0), undefined)).toEqual(
            [{ type: "topdelete", count: 2, lnum: 1 }]
        );
    });

    it("marks the last changed line as changedelete when more lines were removed", () => {
        expect(Hunks.calcSigns(undefined, hunk(4, 3, 4, 1), undefined)).toEqual(
            [{ type: "changedelete", count: 3, lnum: 4 }]
        );
    });

    it("adds trailing add signs when more lines were added than removed", () => {
        expect(Hunks.calcSigns(undefined, hunk(4, 1, 4, 3), undefined)).toEqual(
            [
                { type: "change", count: 1, lnum: 4 },
                { type: "add", count: undefined, lnum: 4 },
                { type: "add", count: undefined, lnum: 5 },
                { type: "add", count: 2, lnum: 6 },
            ]
        );
    });

    it("respects visible line bounds", () => {
        expect(
            Hunks.calcSigns(undefined, hunk(1, 0, 1, 4), undefined, 2, 3)
        ).toEqual([
            { type: "add", count: undefined, lnum: 2 },
            { type: "add", count: undefined, lnum: 3 },
        ]);
    });

    it("uses untracked signs for untracked add hunks", () => {
        expect(
            Hunks.calcSigns(
                undefined,
                hunk(1, 0, 1, 2),
                undefined,
                1,
                Infinity,
                true
            )
        ).toEqual([
            { type: "untracked", count: 2, lnum: 1 },
            { type: "untracked", count: undefined, lnum: 2 },
        ]);
    });

    it("rejects untracked non-add hunks", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(
            Hunks.calcSigns(
                undefined,
                hunk(1, 1, 1, 1),
                undefined,
                1,
                Infinity,
                true
            )
        ).toEqual([]);
        expect(error).toHaveBeenCalledOnce();
        error.mockRestore();
    });
});

describe("Hunks.createPatch", () => {
    it("creates a patch for an added line", () => {
        const patch = Hunks.createPatch(
            "note.md",
            [hunk(1, 0, 2, 1, [], ["added"])],
            "100644"
        );

        expect(patch).toEqual([
            "diff --git a/note.md b/note.md",
            "index 000000..000000 100644",
            "--- a/note.md",
            "+++ b/note.md",
            "@@ -2,0 +2,1 @@",
            "+added",
        ]);
    });

    it("creates a patch for changed lines", () => {
        const patch = Hunks.createPatch(
            "note.md",
            [hunk(2, 1, 2, 2, ["old"], ["new", "next"])],
            "100644"
        );

        expect(patch.slice(4)).toEqual([
            "@@ -2,1 +2,2 @@",
            "-old",
            "+new",
            "+next",
        ]);
    });

    it("can invert a patch", () => {
        const patch = Hunks.createPatch(
            "note.md",
            [hunk(2, 1, 2, 2, ["old"], ["new", "next"])],
            "100644",
            true
        );

        expect(patch.slice(4)).toEqual([
            "@@ -2,2 +2,1 @@",
            "-new",
            "-next",
            "+old",
        ]);
    });

    it("preserves no-newline markers", () => {
        const noNewline = hunk(1, 1, 1, 1, ["old"], ["new"]);
        noNewline.removed.no_nl_at_eof = true;
        noNewline.added.no_nl_at_eof = true;

        expect(
            Hunks.createPatch("note.md", [noNewline], "100644").slice(4)
        ).toEqual([
            "@@ -1,1 +1,1 @@",
            "-old",
            "\\ No newline at end of file",
            "+new",
            "\\ No newline at end of file",
        ]);
    });
});

describe("Hunks lookup helpers", () => {
    const hunks = [hunk(1, 0, 2, 2), hunk(8, 1, 9, 1), hunk(12, 2, 11, 0)];

    it("finds hunks by line", () => {
        expect(Hunks.findHunk(2, hunks)).toEqual([hunks[0], 0]);
        expect(Hunks.findHunk(9, hunks)).toEqual([hunks[1], 1]);
        expect(Hunks.findHunk(20, hunks)).toEqual([undefined, undefined]);
    });

    it("finds a top-delete hunk at line 1", () => {
        const topDelete = hunk(1, 1, 0, 0);
        expect(Hunks.findHunk(1, [topDelete])).toEqual([topDelete, 0]);
    });

    it("finds nearest hunks", () => {
        expect(Hunks.findNearestHunk(1, hunks, "first")).toBe(0);
        expect(Hunks.findNearestHunk(1, hunks, "last")).toBe(2);
        expect(Hunks.findNearestHunk(1, hunks, "next")).toBe(0);
        expect(Hunks.findNearestHunk(4, hunks, "next")).toBe(1);
        expect(Hunks.findNearestHunk(20, hunks, "next")).toBeUndefined();
        expect(Hunks.findNearestHunk(20, hunks, "next", true)).toBe(0);
        expect(Hunks.findNearestHunk(20, hunks, "prev")).toBe(2);
        expect(Hunks.findNearestHunk(8, hunks, "prev")).toBe(0);
        expect(Hunks.findNearestHunk(1, hunks, "prev", true)).toBe(2);
    });
});

describe("Hunks.createPartialHunk", () => {
    it("returns undefined when the selection does not intersect any hunk", () => {
        expect(
            Hunks.createPartialHunk([hunk(1, 0, 4, 1)], 1, 2)
        ).toBeUndefined();
    });

    it("creates a partial hunk for a selection inside an add hunk", () => {
        expect(Hunks.createPartialHunk([hunk(3, 0, 4, 3)], 5, 6)).toMatchObject(
            {
                type: "add",
                removed: { start: 3, count: 0 },
                added: { start: 5, count: 2 },
            }
        );
    });

    it("adjusts the preimage start for selections after previous added lines", () => {
        const partial = Hunks.createPartialHunk(
            [hunk(1, 0, 2, 2), hunk(8, 1, 9, 1)],
            9,
            9
        );

        expect(partial).toMatchObject({
            type: "change",
            removed: { start: 7, count: 1 },
            added: { start: 9, count: 1 },
        });
    });

    it("shifts the preimage start when the selected range has no preimage lines", () => {
        const partial = Hunks.createPartialHunk([hunk(1, 0, 2, 2)], 2, 3);

        expect(partial).toMatchObject({
            type: "add",
            removed: { start: 1, count: 0 },
            added: { start: 2, count: 2 },
        });
    });
});

describe("Hunks static utility methods", () => {
    it("formats patch lines with optional carriage-return stripping", () => {
        const target = hunk(1, 1, 1, 1, ["old\r"], ["new\r"]);

        expect(Hunks.patchLines(target)).toEqual(["-old\r", "+new\r"]);
        expect(Hunks.patchLines(target, true)).toEqual(["-old", "+new"]);
    });

    it("summarizes add, change, and delete hunks", () => {
        expect(
            Hunks.getSummary([
                hunk(1, 0, 1, 2),
                hunk(5, 3, 5, 1),
                hunk(9, 2, 8, 0),
            ])
        ).toEqual({ added: 2, changed: 1, removed: 4 });
    });

    it("compares hunk heads", () => {
        expect(Hunks.compareHeads(undefined, undefined)).toBe(false);
        expect(Hunks.compareHeads(undefined, [])).toBe(true);
        expect(Hunks.compareHeads([hunk(1, 0, 1, 1)], [hunk(1, 0, 1, 1)])).toBe(
            false
        );
        expect(Hunks.compareHeads([hunk(1, 0, 1, 1)], [hunk(2, 0, 2, 1)])).toBe(
            true
        );
    });
});
