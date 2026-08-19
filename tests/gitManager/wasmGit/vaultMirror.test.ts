import { mkdirSync, utimesSync, writeFileSync } from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { WasmGitHttpBridge } from "../../../src/gitManager/wasmGit/httpBridge";
import { Lg2 } from "../../../src/gitManager/wasmGit/lg2";
import { VaultMirror } from "../../../src/gitManager/wasmGit/vaultMirror";
import { withCleanup } from "../../helpers/cleanup";
import { FsVaultAdapter } from "../../helpers/fsVaultAdapter";
import {
    cleanupTempDirectory,
    createTempDirectory,
} from "../../helpers/gitRepo";

const lg2 = new Lg2(new WasmGitHttpBridge());

beforeAll(async () => {
    await lg2.init();
});

let mirrorCounter = 0;

function createMirrorFixture(vaultRoot = "") {
    const dir = createTempDirectory("obsidian-git-mirror-test-");
    const adapter = new FsVaultAdapter(dir);
    const memRoot = `/mirror-test-${mirrorCounter++}`;
    const mirror = new VaultMirror(adapter, lg2.fs, vaultRoot, memRoot);
    withCleanup({ cleanup: () => cleanupTempDirectory(dir) });
    return { dir, adapter, memRoot, mirror };
}

describe("VaultMirror.syncIn", () => {
    it("copies files and directories into the memory filesystem", async () => {
        const { dir, memRoot, mirror } = createMirrorFixture();
        writeFileSync(path.join(dir, "root.md"), "root content");
        mkdirSync(path.join(dir, "sub/deep"), { recursive: true });
        writeFileSync(path.join(dir, "sub/deep/nested.md"), "nested");

        await mirror.syncIn();

        expect(
            lg2.fs.readFile(`${memRoot}/root.md`, { encoding: "utf8" })
        ).toBe("root content");
        expect(
            lg2.fs.readFile(`${memRoot}/sub/deep/nested.md`, {
                encoding: "utf8",
            })
        ).toBe("nested");
    });

    it("preserves vault mtimes in the memory filesystem", async () => {
        const { dir, memRoot, mirror } = createMirrorFixture();
        writeFileSync(path.join(dir, "note.md"), "content");
        const mtime = new Date("2024-05-06T07:08:09Z");
        utimesSync(path.join(dir, "note.md"), mtime, mtime);

        await mirror.syncIn();

        expect(lg2.fs.stat(`${memRoot}/note.md`).mtime.getTime()).toBe(
            mtime.getTime()
        );
    });

    it("removes files from memory that were deleted in the vault", async () => {
        const { dir, adapter, memRoot, mirror } = createMirrorFixture();
        writeFileSync(path.join(dir, "temp.md"), "temp");
        await mirror.syncIn();
        expect(lg2.fs.analyzePath(`${memRoot}/temp.md`).exists).toBe(true);

        await adapter.remove("temp.md");
        await mirror.syncIn();

        expect(lg2.fs.analyzePath(`${memRoot}/temp.md`).exists).toBe(false);
    });

    it("drops stray memory files that never existed in the vault", async () => {
        const { memRoot, mirror } = createMirrorFixture();
        await mirror.syncIn();
        lg2.fs.writeFile(`${memRoot}/stray.md`, "stray");

        await mirror.syncIn();

        expect(lg2.fs.analyzePath(`${memRoot}/stray.md`).exists).toBe(false);
    });

    it("only mirrors the configured vault subdirectory", async () => {
        const { dir, memRoot, mirror } = createMirrorFixture("vault-sub");
        mkdirSync(path.join(dir, "vault-sub"), { recursive: true });
        writeFileSync(path.join(dir, "outside.md"), "outside");
        writeFileSync(path.join(dir, "vault-sub/inside.md"), "inside");

        await mirror.syncIn();

        expect(lg2.fs.analyzePath(`${memRoot}/inside.md`).exists).toBe(true);
        expect(lg2.fs.analyzePath(`${memRoot}/outside.md`).exists).toBe(false);
    });

    it("honors the exclude filter", async () => {
        const dir = createTempDirectory("obsidian-git-mirror-test-");
        withCleanup({ cleanup: () => cleanupTempDirectory(dir) });
        const adapter = new FsVaultAdapter(dir);
        const memRoot = `/mirror-test-${mirrorCounter++}`;
        const mirror = new VaultMirror(
            adapter,
            lg2.fs,
            "",
            memRoot,
            (relativePath) =>
                relativePath === ".git" || relativePath.startsWith(".git/")
        );
        mkdirSync(path.join(dir, ".git"), { recursive: true });
        writeFileSync(path.join(dir, ".git/HEAD"), "ref: refs/heads/main");
        writeFileSync(path.join(dir, "note.md"), "note");

        await mirror.syncIn();

        expect(lg2.fs.analyzePath(`${memRoot}/note.md`).exists).toBe(true);
        expect(lg2.fs.analyzePath(`${memRoot}/.git`).exists).toBe(false);
    });
});

describe("VaultMirror.syncOut", () => {
    it("writes files created in memory back to the vault", async () => {
        const { adapter, memRoot, mirror } = createMirrorFixture();
        await mirror.syncIn();
        lg2.fs.writeFile(`${memRoot}/created.md`, "from git");

        await mirror.syncOut();

        expect(await adapter.read("created.md")).toBe("from git");
    });

    it("creates missing vault directories for nested files", async () => {
        const { adapter, memRoot, mirror } = createMirrorFixture();
        await mirror.syncIn();
        lg2.fs.mkdir(`${memRoot}/a`);
        lg2.fs.mkdir(`${memRoot}/a/b`);
        lg2.fs.writeFile(`${memRoot}/a/b/deep.md`, "deep");

        await mirror.syncOut();

        expect(await adapter.read("a/b/deep.md")).toBe("deep");
    });

    it("deletes vault files removed by git and prunes empty directories", async () => {
        const { dir, adapter, memRoot, mirror } = createMirrorFixture();
        mkdirSync(path.join(dir, "only"), { recursive: true });
        writeFileSync(path.join(dir, "only/file.md"), "content");
        await mirror.syncIn();

        lg2.fs.unlink(`${memRoot}/only/file.md`);
        lg2.fs.rmdir(`${memRoot}/only`);
        await mirror.syncOut();

        expect(await adapter.exists("only/file.md")).toBe(false);
        expect(await adapter.exists("only")).toBe(false);
    });

    it("does not rewrite unchanged files", async () => {
        const { dir, adapter, memRoot, mirror } = createMirrorFixture();
        writeFileSync(path.join(dir, "stable.md"), "stable");
        await mirror.syncIn();
        await mirror.syncOut();
        const statBefore = await adapter.stat("stable.md");

        lg2.fs.writeFile(`${memRoot}/other.md`, "new");
        await new Promise((resolve) => setTimeout(resolve, 20));
        await mirror.syncOut();

        const statAfter = await adapter.stat("stable.md");
        expect(statAfter!.mtime).toBe(statBefore!.mtime);
    });

    it("round-trips changes in both directions", async () => {
        const { dir, adapter, memRoot, mirror } = createMirrorFixture();
        writeFileSync(path.join(dir, "note.md"), "v1");
        await mirror.syncIn();

        lg2.fs.writeFile(`${memRoot}/note.md`, "v2");
        await mirror.syncOut();
        expect(await adapter.read("note.md")).toBe("v2");

        await adapter.write("note.md", "v3");
        // Ensure the mtime differs even on coarse filesystem clocks.
        const future = new Date(Date.now() + 5000);
        utimesSync(path.join(dir, "note.md"), future, future);
        await mirror.syncIn();
        expect(
            lg2.fs.readFile(`${memRoot}/note.md`, { encoding: "utf8" })
        ).toBe("v3");
    });
});
