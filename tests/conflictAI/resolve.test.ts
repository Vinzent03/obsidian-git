import { describe, expect, it } from "vitest";
import {
    isValidResolution,
    parseConflicts,
    parseReply,
    resolveTrivial,
    reviewFlags,
} from "../../src/conflictAI/resolve";

const conflict = (
    ours: string,
    theirs: string,
    before = "A\n",
    after = "Z\n"
) =>
    `${before}<<<<<<< HEAD\n${ours}=======\n${theirs}>>>>>>> origin/main\n${after}`;

describe("parseConflicts", () => {
    it("splits text and blocks", () => {
        const parsed = parseConflicts(conflict("x\n", "y\n"));
        expect(parsed).toEqual({
            segments: ["A\n", "Z\n"],
            blocks: [{ ours: "x\n", theirs: "y\n" }],
        });
    });

    it("handles diff3 base sections", () => {
        const text =
            "<<<<<<< HEAD\nx\n||||||| base\nb\n=======\ny\n>>>>>>> o\n";
        expect(parseConflicts(text)?.blocks).toEqual([
            { ours: "x\n", theirs: "y\n" },
        ]);
    });

    it("rejects unterminated or marker-free text", () => {
        expect(parseConflicts("plain\n")).toBeNull();
        expect(parseConflicts("<<<<<<< HEAD\nx\n=======\ny\n")).toBeNull();
    });
});

describe("isValidResolution", () => {
    const parsed = parseConflicts(conflict("x\n", "y\n"))!;

    it("accepts a resolution that keeps the surrounding text", () => {
        expect(isValidResolution(parsed, "A\nx\ny\nZ\n")).toBe(true);
    });

    it("rejects leftover markers, changed or dropped surrounding text", () => {
        expect(isValidResolution(parsed, conflict("x\n", "y\n"))).toBe(false);
        expect(isValidResolution(parsed, "A\nx\nY\n")).toBe(false);
        expect(isValidResolution(parsed, "x\nZ\n")).toBe(false);
        expect(isValidResolution(parsed, "A\nx\n")).toBe(false);
    });
});

describe("resolveTrivial", () => {
    it("resolves whitespace-only conflicts without a model", () => {
        const parsed = parseConflicts(conflict("a  b\n", "a b\n"))!;
        expect(resolveTrivial(parsed)).toBe("A\na b\nZ\n");
    });

    it("leaves real conflicts alone", () => {
        expect(
            resolveTrivial(parseConflicts(conflict("x\n", "y\n"))!)
        ).toBeNull();
    });
});

describe("reviewFlags", () => {
    const flagsFor = (ours: string, theirs: string, resolved = "A\nZ\n") =>
        reviewFlags(parseConflicts(conflict(ours, theirs))!, {
            resolved,
            confidence: "high",
        });

    it("does not flag a routine merge", () => {
        expect(
            flagsFor(
                "new line\n",
                "other line\n",
                "A\nnew line\nother line\nZ\n"
            )
        ).toEqual([]);
    });

    it("flags both sides changing numbers, links or headings", () => {
        expect(
            flagsFor("total: 10\n", "total: 12\n", "A\ntotal: 12\nZ\n")
        ).toContain("both sides changed numbers or dates");
        expect(flagsFor("[[a]]\n", "[[b]]\n", "A\n[[b]]\nZ\n")).toContain(
            "both sides changed wikilinks"
        );
    });

    it("flags dropped content and low confidence", () => {
        const side = Array.from({ length: 8 }, (_, i) => `line ${i}\n`).join(
            ""
        );
        const parsed = parseConflicts(conflict(side, "other\n"))!;
        const flags = reviewFlags(parsed, {
            resolved: "A\nZ\n",
            confidence: "low",
        });
        expect(flags).toContain("dropped 9 of 9 conflicting lines");
        expect(flags).toContain("model confidence: low");
    });

    it("flags frontmatter conflicts", () => {
        const text =
            "---\ntags: a\n<<<<<<< HEAD\nx: 1\n=======\nx: 2\n>>>>>>> o\n---\nbody\n";
        const flags = reviewFlags(parseConflicts(text)!, {
            resolved: "---\ntags: a\nx: 2\n---\nbody\n",
            confidence: "high",
        });
        expect(flags).toContain(
            "conflict in the note's properties (frontmatter)"
        );
    });
});

describe("parseReply", () => {
    it("reads the tagged reply", () => {
        const reply =
            "<summary>kept both</summary>\n<confidence>high</confidence>\n<resolved>\nA\nx\n</resolved>";
        expect(parseReply(reply)).toEqual({
            resolved: "A\nx",
            confidence: "high",
            summary: "kept both",
        });
    });

    it("rejects replies without a resolved block and defaults to low confidence", () => {
        expect(parseReply("sorry")).toBeNull();
        expect(parseReply("<resolved>\nx\n</resolved>")?.confidence).toBe(
            "low"
        );
    });
});
