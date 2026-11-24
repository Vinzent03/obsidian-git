import { describe, expect, it } from "vitest";
import { replaceGlobEscapes } from "../src/autoCommitGlobs";
import { withCleanup } from "./helpers/cleanup";
import { createEmptyRepo } from "./helpers/gitRepo";

describe("replaceGlobEscapes", () => {
    it("rewrites escaped wildcards as bracket expressions", () => {
        expect(replaceGlobEscapes("a\\*b\\?c")).toBe("a[*]b[?]c");
        expect(replaceGlobEscapes("\\[x\\]")).toBe("[[]x]");
    });

    it("drops escapes before other characters", () => {
        expect(replaceGlobEscapes("\\(escaped\\).md")).toBe("(escaped).md");
        expect(replaceGlobEscapes("dir\\/note.md")).toBe("dir/note.md");
        expect(replaceGlobEscapes("\\!a")).toBe("!a");
    });

    it("keeps escaped and trailing backslashes", () => {
        expect(replaceGlobEscapes("a\\\\b")).toBe("a\\\\b");
        expect(replaceGlobEscapes("trailing\\")).toBe("trailing\\");
    });

    it("leaves globs without escapes unchanged", () => {
        for (const glob of [
            "(a).md",
            "notes/(draft)/*.md",
            "**/*.md",
            "[]a]/*.md",
            "[!(]x",
            "[[:alpha:]]*.md",
            "[a",
        ]) {
            expect(replaceGlobEscapes(glob)).toBe(glob);
        }
    });

    it("reorders bracket expressions so they need no escapes", () => {
        expect(replaceGlobEscapes("a[\\]x]")).toBe("a[]x]");
        expect(replaceGlobEscapes("[x\\-y]")).toBe("[xy-]");
        expect(replaceGlobEscapes("[\\!\\-]")).toBe("[-!]");
        expect(replaceGlobEscapes("[!\\!]")).toBe("[!!]");
        expect(replaceGlobEscapes("[\\]]")).toBe("]");
        expect(replaceGlobEscapes("[\\*]")).toBe("[*]");
        expect(replaceGlobEscapes("[[:digit:]\\]]")).toBe("[][:digit:]]");
        expect(replaceGlobEscapes("[\\a-c]")).toBe("[a-c]");
    });

    it("leaves bracket expressions it cannot rewrite unchanged", () => {
        expect(replaceGlobEscapes("[a-\\]]")).toBe("[a-\\]]");
        // "[!^]" would be a negation.
        expect(replaceGlobEscapes("[\\!\\^]")).toBe("[\\!\\^]");
    });

    // Run the rewritten globs through Git, which also checks Git for Windows
    // accepts them, and compare with the original globs where Git can.
    it.each([
        ["\\(draft\\).md", ["(draft).md"]],
        ["dir\\/note.md", ["dir/note.md"]],
        ["a[\\]]b.md", ["a]b.md"]],
        ["a[\\-]b.md", ["a-b.md"]],
        ["a[!\\]]b.md", ["a!b.md", "a-b.md", "a^b.md"]],
        ["a[\\!\\-]b.md", ["a!b.md", "a-b.md"]],
        ["x\\[y].md", ["x[y].md"]],
    ])("matches the same files as %s", async (glob, expected) => {
        const repo = withCleanup(await createEmptyRepo());
        for (const file of [
            "(draft).md",
            "a!b.md",
            "a-b.md",
            "a]b.md",
            "a^b.md",
            "abc.md",
            "dir/note.md",
            "x[y].md",
        ]) {
            repo.write(file, "content\n");
        }
        await repo.raw(["add", "-A"]);
        const matches = async (pattern: string) =>
            (await repo.raw(["ls-files", "-z", "--", `:(glob)${pattern}`]))
                .split("\0")
                .filter(Boolean)
                .sort();

        await expect(matches(replaceGlobEscapes(glob))).resolves.toEqual(
            expected
        );
        if (process.platform !== "win32") {
            await expect(matches(glob)).resolves.toEqual(expected);
        }
    });
});
