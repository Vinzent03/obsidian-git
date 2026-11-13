import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type ObsidianGit from "../src/main";
import Tools from "../src/tools";

function createPlugin(options: {
    files?: Record<string, TFile>;
    stat?: (path: string) => Promise<{ size: number }>;
}) {
    const stat = vi.fn(options.stat ?? (() => Promise.resolve({ size: 1 })));
    const plugin = {
        app: {
            vault: {
                getAbstractFileByPath: (path: string) =>
                    options.files?.[path] ?? null,
                adapter: { stat },
            },
        },
        gitManager: {
            branchInfo: vi
                .fn()
                .mockResolvedValue({ tracking: "origin/master" }),
            getRemoteUrl: vi
                .fn()
                .mockResolvedValue("https://github.com/Henglie/example.git"),
        },
        displayError: vi.fn(),
    };
    return { plugin, stat };
}

describe("Tools.hasTooBigFiles", () => {
    it.each([
        "../vimwiki/index.wiki",
        "/tmp/vimwiki/index.wiki",
        "C:\\vimwiki\\index.wiki",
        "notes/../../vimwiki/index.wiki",
    ])(
        "ignores files outside the vault without asking the adapter for their size: %s",
        async (vaultPath) => {
            const { plugin, stat } = createPlugin({
                stat: () =>
                    Promise.reject(
                        new Error(`Path "${vaultPath}" is outside the vault.`)
                    ),
            });
            const tools = new Tools(plugin as unknown as ObsidianGit);

            await expect(
                tools.hasTooBigFiles([
                    { vaultPath, path: "vimwiki/index.wiki" },
                ])
            ).resolves.toBe(false);

            expect(stat).not.toHaveBeenCalled();
            expect(plugin.displayError).not.toHaveBeenCalled();
        }
    );

    it("still aborts when an inside-vault file is not in the file index and exceeds the GitHub limit", async () => {
        const { plugin, stat } = createPlugin({
            stat: () => Promise.resolve({ size: 100000000 }),
        });
        const tools = new Tools(plugin as unknown as ObsidianGit);

        await expect(
            tools.hasTooBigFiles([
                { vaultPath: "note.md", path: "vault/note.md" },
            ])
        ).resolves.toBe(true);

        expect(stat).toHaveBeenCalledWith("note.md");
        expect(plugin.displayError).toHaveBeenCalledOnce();
    });

    it("still aborts when an indexed inside-vault file exceeds the GitHub limit", async () => {
        const file = new (TFile as unknown as new (path: string) => TFile)(
            "note.md"
        );
        file.stat.size = 100000000;
        const { plugin } = createPlugin({ files: { "note.md": file } });
        const tools = new Tools(plugin as unknown as ObsidianGit);

        await expect(
            tools.hasTooBigFiles([
                { vaultPath: "note.md", path: "vault/note.md" },
            ])
        ).resolves.toBe(true);

        expect(plugin.displayError).toHaveBeenCalledOnce();
    });
});
