import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundle = await build({
    entryPoints: ["src/renameTracker.ts"],
    bundle: true,
    format: "esm",
    logLevel: "silent",
    platform: "node",
    write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(
    bundle.outputFiles[0].text
).toString("base64")}`;
const { RenameTracker, statusMatchesDirectory } = await import(moduleUrl);

const emptyStatus = () => ({
    all: [],
    changed: [],
    staged: [],
    conflicted: [],
});

const file = (path, index, workingDir) => ({
    path,
    vaultPath: `vault/${path}`,
    index,
    workingDir,
});

const status = (...files) => ({
    all: files,
    changed: files.filter((entry) => entry.workingDir !== " "),
    staged: files.filter((entry) => entry.index !== " " && entry.index !== "U"),
    conflicted: [],
});

const context = ({ tracked = ["old.md"], existing = ["new.md"] } = {}) => ({
    pathExists: (path) => Promise.resolve(existing.includes(path)),
    getIndexPaths: () => Promise.resolve(new Set(tracked)),
    getVaultPath: (path) => `vault/${path}`,
});

test("coalesces rename chains and removes a rename that returns to its source", () => {
    const saved = [];
    const tracker = new RenameTracker([], (hints) => saved.push(hints));

    tracker.record("old.md", "middle.md");
    tracker.record("middle.md", "new.md");
    assert.deepEqual(tracker.getHints(), [{ from: "old.md", to: "new.md" }]);
    assert.equal(tracker.getDestination("old.md"), "new.md");

    tracker.record("new.md", "old.md");
    assert.deepEqual(tracker.getHints(), []);
    assert.deepEqual(saved[saved.length - 1], []);
});

test("reconciles an unstaged delete and untracked add as one rename", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const result = await tracker.reconcile(
        status(file("old.md", " ", "D"), file("new.md", "U", "U")),
        context()
    );

    assert.deepEqual(result.all, [
        {
            path: "new.md",
            vaultPath: "vault/new.md",
            from: "old.md",
            index: " ",
            workingDir: "R",
        },
    ]);
    assert.deepEqual(result.changed, result.all);
    assert.deepEqual(result.staged, []);
});

test("reconciles staged delete and add entries as one staged rename", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const result = await tracker.reconcile(
        status(file("old.md", "D", " "), file("new.md", "A", " ")),
        context({ tracked: ["new.md"] })
    );

    assert.equal(result.all.length, 1);
    assert.deepEqual(result.all[0], {
        path: "new.md",
        vaultPath: "vault/new.md",
        from: "old.md",
        index: "R",
        workingDir: " ",
    });
    assert.deepEqual(result.changed, []);
    assert.deepEqual(result.staged, result.all);
});

test("keeps a partially staged rename split by index path", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const originalStatus = status(
        file("old.md", " ", "D"),
        file("new.md", "A", " ")
    );
    const result = await tracker.reconcile(
        originalStatus,
        context({ tracked: ["old.md", "new.md"] })
    );

    assert.deepEqual(result, originalStatus);
    assert.deepEqual(tracker.getHints(), [{ from: "old.md", to: "new.md" }]);
});

test("keeps staged source edits separate from an unstaged rename", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const originalStatus = status(
        file("old.md", "M", "D"),
        file("new.md", "U", "U")
    );
    const result = await tracker.reconcile(originalStatus, context());

    assert.deepEqual(result, originalStatus);
});

test("keeps a staged rename when its destination is deleted", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const result = await tracker.reconcile(
        status(file("old.md", "D", " "), file("new.md", "A", "D")),
        context({ tracked: ["new.md"], existing: [] })
    );

    assert.deepEqual(result.all[0], {
        path: "new.md",
        vaultPath: "vault/new.md",
        from: "old.md",
        index: "R",
        workingDir: "D",
    });
});

test("synthesizes a case-only rename hidden by an ignore-case index", async () => {
    const tracker = new RenameTracker([{ from: "note.md", to: "Note.md" }]);
    const result = await tracker.reconcile(
        emptyStatus(),
        context({ tracked: ["note.md"], existing: ["Note.md"] })
    );

    assert.deepEqual(result.all[0], {
        path: "Note.md",
        vaultPath: "vault/Note.md",
        from: "note.md",
        index: " ",
        workingDir: "R",
    });
});

test("reconstructs a rename when the destination is ignored", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const result = await tracker.reconcile(
        status(file("old.md", " ", "D")),
        context()
    );

    assert.deepEqual(result.all[0], {
        path: "new.md",
        vaultPath: "vault/new.md",
        from: "old.md",
        index: " ",
        workingDir: "R",
    });
});

test("drops stale and untracked rename hints", async () => {
    const saved = [];
    const tracker = new RenameTracker(
        [{ from: "old.md", to: "new.md" }],
        (hints) => saved.push(hints)
    );
    const result = await tracker.reconcile(
        status(file("new.md", "U", "U")),
        context({ tracked: [], existing: ["new.md"] })
    );

    assert.deepEqual(result.all, [file("new.md", "U", "U")]);
    assert.deepEqual(tracker.getHints(), []);
    assert.deepEqual(saved[saved.length - 1], []);
});

test("does not treat a native copy as a rename", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const copied = {
        ...file("new.md", "C", " "),
        from: "old.md",
    };
    const originalStatus = status(copied);
    const result = await tracker.reconcile(originalStatus, context());

    assert.deepEqual(result, originalStatus);
    assert.deepEqual(tracker.getHints(), []);
});

test("preserves a native rename reported by Git", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const renamed = {
        ...file("new.md", "R", "M"),
        from: "old.md",
    };
    const originalStatus = status(renamed);
    const result = await tracker.reconcile(originalStatus, context());

    assert.deepEqual(result, originalStatus);
    assert.deepEqual(tracker.getHints(), [{ from: "old.md", to: "new.md" }]);
});

test("retains the pair when a newly staged file is renamed", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const originalStatus = status(
        file("old.md", "A", "D"),
        file("new.md", "U", "U")
    );
    const result = await tracker.reconcile(
        originalStatus,
        context({ tracked: ["old.md"] })
    );

    assert.deepEqual(result, originalStatus);
    assert.deepEqual(tracker.getHints(), [{ from: "old.md", to: "new.md" }]);
});

test("drops a hint when the source reappears before staging", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const originalStatus = status(file("new.md", "U", "U"));
    const result = await tracker.reconcile(
        originalStatus,
        context({ existing: ["old.md", "new.md"] })
    );

    assert.deepEqual(result, originalStatus);
    assert.deepEqual(tracker.getHints(), []);
});

test("keeps a staged rename split when the source is recreated", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const originalStatus = status(
        file("old.md", "D", "A"),
        file("new.md", "A", " ")
    );
    const result = await tracker.reconcile(
        originalStatus,
        context({ tracked: ["new.md"], existing: ["old.md", "new.md"] })
    );

    assert.deepEqual(result, originalStatus);
    assert.deepEqual(tracker.getHints(), [{ from: "old.md", to: "new.md" }]);
});

test("drops a hint after only the destination was committed", async () => {
    const tracker = new RenameTracker([{ from: "old.md", to: "new.md" }]);
    const originalStatus = status(file("old.md", " ", "D"));
    const result = await tracker.reconcile(
        originalStatus,
        context({ tracked: ["old.md", "new.md"] })
    );

    assert.deepEqual(result, originalStatus);
    assert.deepEqual(tracker.getHints(), []);
});

test("matches either endpoint of a cross-directory rename", () => {
    const renamed = {
        ...file("destination/note.md", "R", " "),
        from: "source/note.md",
    };

    assert.equal(statusMatchesDirectory(renamed, "source"), true);
    assert.equal(statusMatchesDirectory(renamed, "destination"), true);
    assert.equal(statusMatchesDirectory(renamed, "other"), false);
    assert.equal(statusMatchesDirectory(renamed, "./"), true);
});
