import { describe, expect, it } from "vitest";
import { parseConflictBlocks } from "../../../src/editor/conflicts/model";

function lines(...values: string[]): string {
    return values.join("\n") + "\n";
}

describe("parseConflictBlocks", () => {
    it("returns no blocks when there are no markers", () => {
        expect(parseConflictBlocks(lines("one", "two"))).toEqual([]);
    });

    it("parses a single two-way conflict", () => {
        const text = lines(
            "before",
            "<<<<<<< HEAD",
            "ours",
            "=======",
            "theirs",
            ">>>>>>> origin/master",
            "after"
        );

        const blocks = parseConflictBlocks(text);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]!.ours).toBe("ours\n");
        expect(blocks[0]!.theirs).toBe("theirs\n");
        expect(text.slice(blocks[0]!.from, blocks[0]!.to)).toBe(
            lines(
                "<<<<<<< HEAD",
                "ours",
                "=======",
                "theirs",
                ">>>>>>> origin/master"
            )
        );
        expect(blocks[0]!.markers).toHaveLength(3);
        expect(
            text.slice(blocks[0]!.markers[0]!.from, blocks[0]!.markers[0]!.to)
        ).toBe("<<<<<<< HEAD");
        expect(
            text.slice(blocks[0]!.markers[1]!.from, blocks[0]!.markers[1]!.to)
        ).toBe("=======");
        expect(
            text.slice(blocks[0]!.markers[2]!.from, blocks[0]!.markers[2]!.to)
        ).toBe(">>>>>>> origin/master");
        expect(
            text.slice(blocks[0]!.oursRange.from, blocks[0]!.oursRange.to)
        ).toBe("ours\n");
        expect(blocks[0]!.baseRange).toBeUndefined();
        expect(
            text.slice(blocks[0]!.theirsRange.from, blocks[0]!.theirsRange.to)
        ).toBe("theirs\n");
    });

    it("parses multiple conflicts", () => {
        const text = lines(
            "<<<<<<< HEAD",
            "a-local",
            "=======",
            "a-remote",
            ">>>>>>> origin/master",
            "middle",
            "<<<<<<< HEAD",
            "b-local",
            "=======",
            "b-remote",
            ">>>>>>> origin/master"
        );

        const blocks = parseConflictBlocks(text);
        expect(blocks).toHaveLength(2);
        expect(blocks[0]!.ours).toBe("a-local\n");
        expect(blocks[1]!.theirs).toBe("b-remote\n");
    });

    it("parses a diff3 conflict with a base section", () => {
        const text = lines(
            "<<<<<<< HEAD",
            "ours",
            "||||||| merged common ancestors",
            "base",
            "=======",
            "theirs",
            ">>>>>>> origin/master"
        );

        const blocks = parseConflictBlocks(text);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]!.ours).toBe("ours\n");
        expect(blocks[0]!.theirs).toBe("theirs\n");
        expect(blocks[0]!.markers).toHaveLength(4);
        expect(
            text.slice(blocks[0]!.markers[1]!.from, blocks[0]!.markers[1]!.to)
        ).toBe("||||||| merged common ancestors");
        expect(
            text.slice(blocks[0]!.baseRange!.from, blocks[0]!.baseRange!.to)
        ).toBe("base\n");
    });
});
