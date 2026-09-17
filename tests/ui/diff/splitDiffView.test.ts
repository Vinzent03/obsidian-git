import { describe, expect, it } from "vitest";

import { getSplitDiffTimeout } from "src/ui/diff/splitDiffView";

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
