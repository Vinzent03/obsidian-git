import { existsSync } from "fs";
import path from "path";
import type { SimpleGit as SimpleGitClient } from "simple-git";
import { SimpleGit } from "../../src/gitManager/simpleGit";
import { createFakePlugin, type FakePlugin } from "./createFakePlugin";

export type SimpleGitTestContext = {
    manager: SimpleGit;
    plugin: FakePlugin;
};

export function createSimpleGitManager(
    repoPath: string,
    gitClient: SimpleGitClient,
    plugin: FakePlugin = createFakePlugin(),
    options: { vaultPath?: string; basePath?: string } = {}
): SimpleGitTestContext {
    const vaultPath = options.vaultPath ?? repoPath;
    plugin.settings.basePath = options.basePath ?? "";
    (
        plugin.app as unknown as {
            vault: {
                adapter: {
                    getBasePath(): string;
                    exists(filePath: string): Promise<boolean>;
                };
            };
        }
    ).vault = {
        adapter: {
            getBasePath: () => vaultPath,
            exists: (filePath: string) =>
                Promise.resolve(
                    existsSync(
                        path.isAbsolute(filePath)
                            ? filePath
                            : path.join(vaultPath, filePath)
                    )
                ),
        },
    };

    const manager = new SimpleGit(plugin);
    manager.git = gitClient;
    manager.absoluteRepoPath = repoPath;
    plugin.gitManager = manager;
    return { manager, plugin };
}
