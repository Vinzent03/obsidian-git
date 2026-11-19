import { Chunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
    hunksFromChunks,
    mapOldLineToNewLine,
    parseDiffHunks,
    sourceLineForDiffSide,
} from "src/ui/diff/sourceLine";

const contextDiff = [
    "--- a/note.md",
    "+++ b/note.md",
    "@@ -1,6 +1,7 @@",
    " a",
    " b",
    "-c",
    "+C",
    "+extra",
    " d",
    " e",
    " f",
    "@@ -10,2 +11,2 @@",
    "-x",
    "+y",
    " z",
].join("\n");

describe("parseDiffHunks", () => {
    it("only records changed lines and skips context", () => {
        expect(parseDiffHunks(contextDiff)).toEqual([
            { oldStart: 3, oldLines: 1, newStart: 3, newLines: 2 },
            { oldStart: 10, oldLines: 1, newStart: 11, newLines: 1 },
        ]);
    });

    it("keeps the line before pure insertions and deletions", () => {
        const diff = [
            "@@ -2,0 +3,2 @@",
            "+x",
            "+y",
            "@@ -6,2 +7,0 @@",
            "-a",
            "-b",
        ].join("\n");

        expect(parseDiffHunks(diff)).toEqual([
            { oldStart: 2, oldLines: 0, newStart: 3, newLines: 2 },
            { oldStart: 6, oldLines: 2, newStart: 7, newLines: 0 },
        ]);
    });
});

describe("mapOldLineToNewLine", () => {
    const hunks = parseDiffHunks(contextDiff);

    it("maps unchanged lines around a change", () => {
        expect(mapOldLineToNewLine(1, hunks)).toBe(1);
        expect(mapOldLineToNewLine(2, hunks)).toBe(2);
        expect(mapOldLineToNewLine(4, hunks)).toBe(5);
        expect(mapOldLineToNewLine(6, hunks)).toBe(7);
        expect(mapOldLineToNewLine(11, hunks)).toBe(12);
    });

    it("maps lines inside a change to the matching new line", () => {
        expect(mapOldLineToNewLine(3, hunks)).toBe(3);
        expect(mapOldLineToNewLine(10, hunks)).toBe(11);
    });

    it("maps a deleted line to the nearest following line", () => {
        const deletion = [
            { oldStart: 3, oldLines: 2, newStart: 2, newLines: 0 },
        ];

        expect(mapOldLineToNewLine(3, deletion)).toBe(3);
        expect(mapOldLineToNewLine(4, deletion)).toBe(3);
    });

    it("clamps a deletion at the end of the file to the last line", () => {
        expect(
            mapOldLineToNewLine(
                3,
                [{ oldStart: 3, oldLines: 2, newStart: 2, newLines: 0 }],
                2
            )
        ).toBe(2);
    });

    it("shifts lines after an insertion", () => {
        const insertion = [
            { oldStart: 2, oldLines: 0, newStart: 3, newLines: 2 },
        ];

        expect(mapOldLineToNewLine(1, insertion)).toBe(1);
        expect(mapOldLineToNewLine(2, insertion)).toBe(2);
        expect(mapOldLineToNewLine(3, insertion)).toBe(5);
    });
});

describe("sourceLineForDiffSide", () => {
    it("keeps working copy lines and maps old side lines", () => {
        const hunks = parseDiffHunks(contextDiff);

        expect(sourceLineForDiffSide("b", 4, hunks, 100)).toBe(4);
        expect(sourceLineForDiffSide("a", 4, hunks, 100)).toBe(5);
    });
});

describe("hunksFromChunks", () => {
    function chunks(textA: string, textB: string) {
        const aDoc = Text.of(textA.split("\n"));
        const bDoc = Text.of(textB.split("\n"));
        return {
            aDoc,
            bDoc,
            hunks: hunksFromChunks(Chunk.build(aDoc, bDoc), aDoc, bDoc),
        };
    }

    it("maps an old line after an insertion", () => {
        const result = chunks("a\nb\nc\n", "a\nx\nb\nc\n");

        expect(result.hunks).toEqual([
            { oldStart: 1, oldLines: 0, newStart: 2, newLines: 1 },
        ]);
        expect(mapOldLineToNewLine(2, result.hunks, result.bDoc.lines)).toBe(3);
    });

    it("maps a deleted line to the nearest following line", () => {
        const result = chunks("a\nb\nc\nd\n", "a\nd\n");

        expect(result.hunks).toEqual([
            { oldStart: 2, oldLines: 2, newStart: 1, newLines: 0 },
        ]);
        expect(mapOldLineToNewLine(3, result.hunks, result.bDoc.lines)).toBe(2);
    });

    it("maps a changed line to its replacement", () => {
        const result = chunks("a\nb\nc\n", "a\nB\nc\n");

        expect(result.hunks).toEqual([
            { oldStart: 2, oldLines: 1, newStart: 2, newLines: 1 },
        ]);
        expect(mapOldLineToNewLine(2, result.hunks, result.bDoc.lines)).toBe(2);
    });
});
