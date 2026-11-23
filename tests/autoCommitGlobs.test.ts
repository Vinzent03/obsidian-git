import { describe, expect, it } from "vitest";
import { windowsGitGlob } from "../src/autoCommitGlobs";

describe("windowsGitGlob", () => {
    it("rewrites backslash escapes as bracket expressions", () => {
        expect(windowsGitGlob("\\(escaped\\).md")).toBe("[(]escaped[)].md");
        expect(windowsGitGlob("a\\*b\\?c")).toBe("a[*]b[?]c");
        expect(windowsGitGlob("\\[x\\]")).toBe("[[]x[]]");
    });

    it("leaves globs without escapes unchanged", () => {
        for (const glob of ["(a).md", "notes/(draft)/*.md", "**/*.md"]) {
            expect(windowsGitGlob(glob)).toBe(glob);
        }
    });

    it("leaves bracket expressions and a trailing backslash unchanged", () => {
        expect(windowsGitGlob("[]a]/*.md")).toBe("[]a]/*.md");
        expect(windowsGitGlob("[!(]x\\(")).toBe("[!(]x[(]");
        expect(windowsGitGlob("trailing\\")).toBe("trailing\\");
    });
});
