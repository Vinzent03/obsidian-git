import path from "path";
import { describe, expect, it } from "vitest";
import { withCleanup } from "./cleanup";
import { createFileSystemAdapter } from "./fileSystemAdapter";
import { createRepoWithOrigin } from "./gitRepo";

describe("filesystem-backed vault adapter", () => {
    it("reads real file metadata and returns null for missing files", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        const adapter = createFileSystemAdapter(repo.repoPath);

        await expect(adapter.stat("note.md")).resolves.toMatchObject({
            type: "file",
            size: Buffer.byteLength("base\n"),
        });
        await expect(adapter.exists("note.md")).resolves.toBe(true);
        await expect(adapter.stat("missing.md")).resolves.toBeNull();
        await expect(adapter.exists("missing.md")).resolves.toBe(false);
    });

    it("rejects escaping paths for stat and exists, even if the target is missing", async () => {
        const repo = withCleanup(await createRepoWithOrigin());
        repo.write("obsidian/vault/note.md", "vault\n");
        const adapter = createFileSystemAdapter(
            path.join(repo.repoPath, "obsidian/vault")
        );

        for (const filePath of [
            "..",
            "../../note.md",
            "../../missing.md",
            "subfolder/../../../note.md",
            path.join(repo.repoPath, "note.md"),
        ]) {
            const message = `Path "${filePath}" is outside the vault.`;
            await expect(adapter.stat(filePath)).rejects.toThrow(message);
            await expect(adapter.exists(filePath)).rejects.toThrow(message);
        }
    });
});
