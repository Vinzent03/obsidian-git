import path from "path";
import { truncateSync } from "fs";
import { Platform } from "obsidian";
import { afterEach, describe, expect, it } from "vitest";
import Tools from "../src/tools";
import { withCleanup } from "./helpers/cleanup";
import { createSimpleGitTestContext } from "./helpers/simpleGit";
import { createIsomorphicGitManager } from "./helpers/isomorphicGit";

describe("Tools.hasTooBigFiles", () => {
    afterEach(() => {
        Platform.isDesktopApp = true;
    });

    async function createContext() {
        return withCleanup(
            await createSimpleGitTestContext({
                getVaultOptions: (repo) => {
                    repo.write("obsidian/vault/note.md", "vault note\n");
                    return {
                        vaultPath: path.join(repo.repoPath, "obsidian/vault"),
                    };
                },
                configurePlugin: (plugin) => {
                    plugin.settings.limitToVault = false;
                    // Exercise filesystem metadata lookup without a TFile cache.
                    plugin.app.vault.getAbstractFileByPath = () => null;
                },
            })
        );
    }

    it("checks files inside a nested vault with a GitHub remote", async () => {
        const { repo, manager, plugin } = await createContext();
        // Only the URL is used; the test never contacts GitHub.
        await repo.git.remote([
            "set-url",
            "origin",
            "https://github.com/example/repo.git",
        ]);
        const status = await manager.status();
        expect(status.changed).toContainEqual(
            expect.objectContaining({ vaultPath: "note.md" })
        );

        await expect(
            new Tools(plugin).hasTooBigFiles(
                status.changed.filter((file) => file.vaultPath === "note.md")
            )
        ).resolves.toBe(false);
    });

    it("does not abort the GitHub size check for changes outside a nested vault (#1241)", async () => {
        const { repo, manager, plugin } = await createContext();
        await repo.writeAndCommit("vimwiki/index.wiki", "base\n", "add wiki");
        repo.write("vimwiki/index.wiki", "changed\n");
        await repo.git.remote([
            "set-url",
            "origin",
            "https://github.com/example/repo.git",
        ]);
        const status = await manager.status();
        expect(status.changed).toContainEqual(
            expect.objectContaining({
                path: "vimwiki/index.wiki",
                vaultPath: "../../vimwiki/index.wiki",
            })
        );

        await expect(
            new Tools(plugin).hasTooBigFiles(status.changed)
        ).resolves.toBe(false);
    });

    it.each([false, true])(
        "checks oversized desktop files outside the vault (LFS: %s)",
        async (lfs) => {
            const { repo, plugin } = await createContext();
            repo.write("vimwiki/index.wiki", "");
            truncateSync(
                path.join(repo.repoPath, "vimwiki/index.wiki"),
                100000000
            );
            if (lfs) repo.write(".gitattributes", "*.wiki filter=lfs\n");
            await repo.git.remote([
                "set-url",
                "origin",
                "https://github.com/example/repo.git",
            ]);

            await expect(
                new Tools(plugin).hasTooBigFiles([
                    {
                        path: "vimwiki/index.wiki",
                        vaultPath: "../../vimwiki/index.wiki",
                    },
                ])
            ).resolves.toBe(!lfs);
            expect(plugin.displayError).toHaveBeenCalledTimes(lfs ? 0 : 1);
        }
    );

    it("allows deleted desktop files outside the vault", async () => {
        const { repo, manager, plugin } = await createContext();
        await repo.writeAndCommit("vimwiki/index.wiki", "base\n", "add wiki");
        repo.remove("vimwiki/index.wiki");
        await repo.git.remote([
            "set-url",
            "origin",
            "https://github.com/example/repo.git",
        ]);

        await expect(
            new Tools(plugin).hasTooBigFiles((await manager.status()).changed)
        ).resolves.toBe(false);
    });

    it.each([10, 100000000])(
        "uses the mobile adapter for an uncached file of %s bytes",
        async (size) => {
            const { repo } = await createContext();
            repo.write(".obsidian/config.json", "");
            truncateSync(
                path.join(repo.repoPath, ".obsidian/config.json"),
                size
            );
            await repo.git.remote([
                "set-url",
                "origin",
                "https://github.com/example/repo.git",
            ]);
            const { plugin } = createIsomorphicGitManager(repo.repoPath);
            Platform.isDesktopApp = false;

            await expect(
                new Tools(plugin).hasTooBigFiles([
                    {
                        path: ".obsidian/config.json",
                        vaultPath: ".obsidian/config.json",
                    },
                ])
            ).resolves.toBe(size >= 100000000);
        }
    );
});
