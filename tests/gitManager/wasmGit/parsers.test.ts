import { describe, expect, it } from "vitest";
import {
    applyUnifiedPatch,
    extractFileDiff,
    extractPatchPath,
    parseBlame,
    parseCommitObject,
    parseForEachRef,
    parseGitDate,
    parseLog,
    parseLsRemote,
    parseNameStatus,
    parseRemoteVerbose,
    parseStatus,
    removeConfigKey,
    resolveConflictMarkers,
    splitCommandLine,
} from "../../../src/gitManager/wasmGit/parsers";

describe("parseStatus", () => {
    it("parses branch, staged, modified, and untracked entries", () => {
        const output = [
            "## main",
            "A  staged.md",
            " M changed.md",
            "?? untracked.md",
            "D  deleted.md",
        ].join("\n");

        const status = parseStatus(output);

        expect(status.branch).toBe("main");
        expect(status.files).toEqual([
            { index: "A", workingDir: " ", path: "staged.md", from: undefined },
            {
                index: " ",
                workingDir: "M",
                path: "changed.md",
                from: undefined,
            },
            {
                index: "?",
                workingDir: "?",
                path: "untracked.md",
                from: undefined,
            },
            {
                index: "D",
                workingDir: " ",
                path: "deleted.md",
                from: undefined,
            },
        ]);
        expect(status.conflicted).toEqual([]);
    });

    it("parses the lg2 ahead/behind summary line", () => {
        const status = parseStatus(
            "## main\n# Your branch is ahead by 2, behind by 1 commits.\n"
        );
        expect(status.ahead).toBe(2);
        expect(status.behind).toBe(1);
    });

    it("treats an unborn HEAD as no branch", () => {
        const status = parseStatus("## HEAD (no branch)\n?? a.md\n");
        expect(status.branch).toBeUndefined();
    });

    it("collects conflict entries and normalizes them to UU", () => {
        const output = [
            "## main",
            "conflict: a:note.md o:note.md t:note.md",
            "M  note.md",
        ].join("\n");

        const status = parseStatus(output);

        expect(status.conflicted).toEqual(["note.md"]);
        expect(status.files).toEqual([
            { index: "U", workingDir: "U", path: "note.md", from: undefined },
        ]);
    });

    it("uses the first non-NULL side of a conflict entry", () => {
        const status = parseStatus(
            "## main\nconflict: a:NULL o:NULL t:their.md\n"
        );
        expect(status.conflicted).toEqual(["their.md"]);
    });

    it("splits rename entries into from and to", () => {
        const status = parseStatus("## main\nR  old.md new.md\n");
        expect(status.files).toEqual([
            { index: "R", workingDir: " ", path: "new.md", from: "old.md" },
        ]);
    });
});

describe("parseNameStatus", () => {
    it("maps status letters to change types", () => {
        const entries = parseNameStatus("M\tchanged.md\nA\tnew.md\nD\tgone.md");
        expect(entries).toEqual([
            { type: "M", path: "changed.md" },
            { type: "A", path: "new.md" },
            { type: "D", path: "gone.md" },
        ]);
    });
});

describe("parseLog", () => {
    it("parses commits with subject and body paragraphs", () => {
        const output = [
            "commit 1111111111111111111111111111111111111111",
            "Author: Alice <alice@example.com>",
            "Date:   Wed Aug 19 17:01:39 2026 +0000",
            "",
            "    subject line",
            "",
            "    body paragraph one",
            "",
            "commit 2222222222222222222222222222222222222222",
            "Author: Bob <bob@example.com>",
            "Date:   Tue Aug 18 08:00:00 2026 +0200",
            "",
            "    second commit",
        ].join("\n");

        const entries = parseLog(output);

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({
            hash: "1111111111111111111111111111111111111111",
            authorName: "Alice",
            authorEmail: "alice@example.com",
            message: "subject line",
            body: "body paragraph one",
        });
        expect(entries[0]!.date.toISOString()).toBe("2026-08-19T17:01:39.000Z");
        expect(entries[1]).toMatchObject({
            hash: "2222222222222222222222222222222222222222",
            message: "second commit",
            body: "",
        });
        expect(entries[1]!.date.toISOString()).toBe("2026-08-18T06:00:00.000Z");
    });

    it("records parents of merge commits", () => {
        const output = [
            "commit 3333333333333333333333333333333333333333",
            "Merge: 1111111 2222222",
            "Author: Alice <alice@example.com>",
            "Date:   Wed Aug 19 17:01:39 2026 +0000",
            "",
            "    merge branch",
        ].join("\n");

        const entries = parseLog(output);
        expect(entries[0]!.merge).toEqual(["1111111", "2222222"]);
    });
});

describe("parseGitDate", () => {
    it("applies the timezone offset", () => {
        expect(
            parseGitDate("Wed Aug 19 10:30:00 2026 -0500")!.toISOString()
        ).toBe("2026-08-19T15:30:00.000Z");
    });

    it("returns undefined for unparsable input", () => {
        expect(parseGitDate("not a date")).toBeUndefined();
    });
});

describe("parseForEachRef", () => {
    it("parses oid, type, and refname", () => {
        const oid = "a".repeat(40);
        const refs = parseForEachRef(`${oid} commit\trefs/heads/main\n`);
        expect(refs).toEqual([
            { oid, type: "commit", refName: "refs/heads/main" },
        ]);
    });
});

describe("parseLsRemote", () => {
    it("parses oid and refname", () => {
        const oid = "b".repeat(40);
        expect(parseLsRemote(`${oid}\trefs/heads/main`)).toEqual([
            { oid, refName: "refs/heads/main" },
        ]);
    });
});

describe("parseRemoteVerbose", () => {
    it("dedupes fetch and push lines per remote", () => {
        const output = [
            "origin\thttps://example.com/repo.git (fetch)",
            "origin\thttps://example.com/repo.git (push)",
            "backup\thttps://example.com/backup.git (fetch)",
        ].join("\n");

        const remotes = parseRemoteVerbose(output);
        expect([...remotes.entries()]).toEqual([
            ["origin", "https://example.com/repo.git"],
            ["backup", "https://example.com/backup.git"],
        ]);
    });
});

describe("parseBlame", () => {
    it("parses hash, signature, line number, and content", () => {
        const output = [
            "12345678 ( Alice <alice@example.com>       1) first line",
            "9abcdef0 ( Bob Builder <bob@example.com>   2) second line",
        ].join("\n");

        expect(parseBlame(output)).toEqual([
            {
                hash: "12345678",
                name: "Alice",
                email: "alice@example.com",
                line: 1,
                content: "first line",
            },
            {
                hash: "9abcdef0",
                name: "Bob Builder",
                email: "bob@example.com",
                line: 2,
                content: "second line",
            },
        ]);
    });
});

describe("parseCommitObject", () => {
    it("parses tree, parents, signatures, and message", () => {
        const tree = "c".repeat(40);
        const parent = "d".repeat(40);
        const output = [
            `tree ${tree}`,
            `parent ${parent}`,
            "author Alice <alice@example.com> 1755622899 +0200",
            "committer Bob <bob@example.com> 1755622900 +0000",
            "",
            "subject",
            "",
            "body",
        ].join("\n");

        const commit = parseCommitObject(output)!;
        expect(commit.tree).toBe(tree);
        expect(commit.parents).toEqual([parent]);
        expect(commit.author).toEqual({
            name: "Alice",
            email: "alice@example.com",
            epochSeconds: 1755622899,
            tz: "+0200",
        });
        expect(commit.committer.name).toBe("Bob");
        expect(commit.message).toBe("subject\n\nbody");
    });

    it("returns undefined for non-commit content", () => {
        expect(parseCommitObject("not a commit")).toBeUndefined();
    });
});

describe("extractFileDiff", () => {
    const patch = [
        "diff --git a/a.md b/a.md",
        "--- a/a.md",
        "+++ b/a.md",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        "diff --git a/b.md b/b.md",
        "--- a/b.md",
        "+++ b/b.md",
        "@@ -1 +1 @@",
        "-foo",
        "+bar",
    ].join("\n");

    it("extracts a file section from the middle of a patch", () => {
        const diff = extractFileDiff(patch, "a.md")!;
        expect(diff).toContain("+new");
        expect(diff).not.toContain("+bar");
    });

    it("extracts the last file section", () => {
        const diff = extractFileDiff(patch, "b.md")!;
        expect(diff).toContain("+bar");
        expect(diff).not.toContain("+new");
    });

    it("returns undefined when the file is not in the patch", () => {
        expect(extractFileDiff(patch, "missing.md")).toBeUndefined();
    });
});

describe("resolveConflictMarkers", () => {
    const conflicted = [
        "before",
        "<<<<<<< HEAD",
        "local line",
        "=======",
        "remote line",
        ">>>>>>> origin/main",
        "after",
    ].join("\n");

    it("keeps our side for the ours strategy", () => {
        expect(resolveConflictMarkers(conflicted, "ours")).toBe(
            "before\nlocal line\nafter"
        );
    });

    it("keeps their side for the theirs strategy", () => {
        expect(resolveConflictMarkers(conflicted, "theirs")).toBe(
            "before\nremote line\nafter"
        );
    });

    it("handles diff3-style conflicts with a base section", () => {
        const diff3 = [
            "<<<<<<< HEAD",
            "local",
            "||||||| base",
            "original",
            "=======",
            "remote",
            ">>>>>>> origin/main",
        ].join("\n");
        expect(resolveConflictMarkers(diff3, "theirs")).toBe("remote");
        expect(resolveConflictMarkers(diff3, "ours")).toBe("local");
    });

    it("returns undefined without conflict markers", () => {
        expect(resolveConflictMarkers("plain file", "ours")).toBeUndefined();
    });

    it("returns undefined for incomplete marker blocks", () => {
        expect(
            resolveConflictMarkers("<<<<<<< HEAD\nlocal", "ours")
        ).toBeUndefined();
    });
});

describe("removeConfigKey", () => {
    const config = [
        "[core]",
        "\tbare = false",
        '[branch "main"]',
        "\tremote = origin",
        "\tmerge = refs/heads/main",
        "[user]",
        "\tname = Alice",
    ].join("\n");

    it("removes a key from a subsection", () => {
        const result = removeConfigKey(config, "branch.main.merge");
        expect(result).not.toContain("merge = refs/heads/main");
        expect(result).toContain("remote = origin");
        expect(result).toContain("name = Alice");
    });

    it("removes a key from a plain section", () => {
        const result = removeConfigKey(config, "user.name");
        expect(result).not.toContain("name = Alice");
        expect(result).toContain("bare = false");
    });

    it("does not remove same-named keys of other sections", () => {
        const content = '[branch "a"]\n\tmerge = x\n[branch "b"]\n\tmerge = y';
        const result = removeConfigKey(content, "branch.a.merge");
        expect(result).not.toContain("merge = x");
        expect(result).toContain("merge = y");
    });
});

describe("splitCommandLine", () => {
    it("splits on whitespace", () => {
        expect(splitCommandLine("log --follow file.md")).toEqual([
            "log",
            "--follow",
            "file.md",
        ]);
    });

    it("honors quotes", () => {
        expect(splitCommandLine("commit -m \"a message\" 'x y'")).toEqual([
            "commit",
            "-m",
            "a message",
            "x y",
        ]);
    });

    it("keeps empty quoted arguments", () => {
        expect(splitCommandLine('tag ""')).toEqual(["tag", ""]);
    });

    it("returns an empty list for blank input", () => {
        expect(splitCommandLine("   ")).toEqual([]);
    });
});

describe("applyUnifiedPatch", () => {
    it("splices added and removed lines at the hunk start", () => {
        const source = "base\n";
        const patch = [
            "--- a/note.md",
            "+++ b/note.md",
            "@@ -1,1 +1,2 @@",
            "-base",
            "+base",
            "+working",
            "",
        ].join("\n");
        expect(applyUnifiedPatch(source, patch)).toBe("base\nworking\n");
    });

    it("extracts the +++ b/ path", () => {
        expect(
            extractPatchPath("diff --git a/x b/x\n+++ b/folder/note.md\n")
        ).toBe("folder/note.md");
    });
});
