import { describe, expect, it } from "vitest";
import { merge3 } from "../../../src/gitManager/wasmGit/rebase";

describe("merge3", () => {
    it("takes theirs when ours equals the base", () => {
        expect(merge3("base\n", "base\n", "theirs\n")).toEqual({
            content: "theirs\n",
            conflicted: false,
        });
    });

    it("takes ours when theirs equals the base", () => {
        expect(merge3("base\n", "ours\n", "base\n")).toEqual({
            content: "ours\n",
            conflicted: false,
        });
    });

    it("applies non-overlapping line edits from both sides", () => {
        const base = "one\ntwo\nthree\n";
        const ours = "ONE\ntwo\nthree\n";
        const theirs = "one\ntwo\nTHREE\n";
        expect(merge3(base, ours, theirs)).toEqual({
            content: "ONE\ntwo\nTHREE\n",
            conflicted: false,
        });
    });

    it("emits conflict markers for overlapping edits", () => {
        const result = merge3("same\n", "ours\n", "theirs\n");
        expect(result.conflicted).toBe(true);
        expect(result.content).toContain("<<<<<<< HEAD");
        expect(result.content).toContain("ours");
        expect(result.content).toContain("theirs");
        expect(result.content).toContain(">>>>>>> incoming");
    });
});
