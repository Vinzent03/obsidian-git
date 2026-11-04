import { describe, expect, it } from "vitest";
import { ChangeSet } from "@codemirror/state";
import { computeHunks } from "../../../src/editor/signs/diff";

function computeHunksOnly(oldText: string, newText: string) {
    return computeHunks(oldText, newText, undefined, undefined).hunks;
}

describe("computeHunks", () => {
    it("returns no hunks for unchanged text", () => {
        expect(computeHunksOnly("one\ntwo\n", "one\ntwo\n")).toEqual([]);
    });

    it("computes a single-line addition", () => {
        expect(computeHunksOnly("one\nthree\n", "one\ntwo\nthree\n")).toEqual([
            {
                type: "add",
                removed: { start: 1, count: 0, lines: [] },
                added: { start: 2, count: 1, lines: ["two"] },
                vend: 2,
            },
        ]);
    });

    it("computes a single-line deletion", () => {
        expect(computeHunksOnly("one\ntwo\nthree\n", "one\nthree\n")).toEqual([
            {
                type: "delete",
                removed: { start: 2, count: 1, lines: ["two"] },
                added: { start: 1, count: 0, lines: [] },
                vend: 1,
            },
        ]);
    });

    it("computes a single-line change", () => {
        expect(computeHunksOnly("one\ntwo\n", "one\nsecond\n")).toEqual([
            {
                type: "change",
                removed: { start: 2, count: 1, lines: ["two"] },
                added: { start: 2, count: 1, lines: ["second"] },
                vend: 2,
            },
        ]);
    });

    it("computes a multi-line replacement", () => {
        expect(
            computeHunksOnly("one\ntwo\nfour\n", "one\nsecond\nthird\nfour\n")
        ).toEqual([
            {
                type: "change",
                removed: { start: 2, count: 1, lines: ["two"] },
                added: { start: 2, count: 2, lines: ["second", "third"] },
                vend: 3,
            },
        ]);
    });

    it("computes insertions at the beginning and end of a file", () => {
        expect(computeHunksOnly("two\n", "one\ntwo\nthree\n")).toEqual([
            {
                type: "add",
                removed: { start: 0, count: 0, lines: [] },
                added: { start: 1, count: 1, lines: ["one"] },
                vend: 1,
            },
            {
                type: "add",
                removed: { start: 1, count: 0, lines: [] },
                added: { start: 3, count: 1, lines: ["three"] },
                vend: 3,
            },
        ]);
    });

    it("computes deletions at the beginning and end of a file", () => {
        expect(computeHunksOnly("one\ntwo\nthree\n", "two\n")).toEqual([
            {
                type: "delete",
                removed: { start: 1, count: 1, lines: ["one"] },
                added: { start: 0, count: 0, lines: [] },
                vend: 0,
            },
            {
                type: "delete",
                removed: { start: 3, count: 1, lines: ["three"] },
                added: { start: 1, count: 0, lines: [] },
                vend: 1,
            },
        ]);
    });

    it("tracks missing trailing newlines on changed content", () => {
        expect(computeHunksOnly("one\ntwo", "one\nsecond")).toEqual([
            {
                type: "change",
                removed: {
                    start: 2,
                    count: 1,
                    lines: ["two"],
                    no_nl_at_eof: true,
                },
                added: {
                    start: 2,
                    count: 1,
                    lines: ["second"],
                    no_nl_at_eof: true,
                },
                vend: 2,
            },
        ]);
    });

    it("can update previous chunks with a ChangeDesc", () => {
        const oldText = "one\ntwo\n";
        const firstNewText = "one\nsecond\n";
        const first = computeHunks(oldText, firstNewText, undefined, undefined);
        const change = ChangeSet.of(
            [{ from: 4, to: 10, insert: "third\n" }],
            firstNewText.length
        );
        const incremental = computeHunks(
            oldText,
            "one\nthird\n",
            first.chunks,
            change.desc
        );
        const full = computeHunks(
            oldText,
            "one\nthird\n",
            undefined,
            undefined
        );

        expect(incremental.hunks).toEqual(full.hunks);
    });
});
