import type { SimpleGit as SimpleGitClient } from "simple-git";
import { SimpleGit } from "../../src/gitManager/simpleGit";
import { createFakePlugin, type FakePlugin } from "./createFakePlugin";
import { createRepoWithOrigin, type TestRepo } from "./gitRepo";
import { createFileSystemAdapter } from "./fileSystemAdapter";

export type GitFixture = () => Promise<TestRepo>;

export type SimpleGitTestContext = {
    manager: SimpleGit;
    repo: TestRepo;
    plugin: FakePlugin;
    cleanup(): void;
};

export type SimpleGitTestOptions = {
    fixture?: GitFixture;
    plugin?: FakePlugin;
    configurePlugin?: (plugin: FakePlugin) => void;
    gitClient?: SimpleGitClient | ((repo: TestRepo) => SimpleGitClient);
    getVaultOptions?: (repo: TestRepo) => {
        vaultPath?: string;
        basePath?: string;
    };
};

function configurePlugin(
    repoPath: string,
    plugin: FakePlugin,
    options: { vaultPath?: string; basePath?: string }
): void {
    const vaultPath = options.vaultPath ?? repoPath;
    plugin.settings = {
        ...plugin.settings,
        basePath: options.basePath ?? "",
        gitDir: "",
    };
    plugin.localStorage = {
        ...plugin.localStorage,
        getGitPath: () => null,
        getPATHPaths: () => [],
        // Supplying an askpass command keeps setGitInstance focused on client
        // initialization instead of starting the plugin's long-lived watcher.
        getEnvVars: () => ["SSH_ASKPASS=obsidian-git-test-askpass"],
    } as unknown as FakePlugin["localStorage"];
    (
        plugin.app as unknown as {
            vault: {
                getAbstractFileByPath(): null;
                configDir: string;
                adapter: {
                    getBasePath(): string;
                    exists(filePath: string): Promise<boolean>;
                };
            };
        }
    ).vault = {
        getAbstractFileByPath: () => null,
        configDir: ".obsidian",
        adapter: createFileSystemAdapter(vaultPath),
    };
}

export async function createSimpleGitTestContext(
    options: SimpleGitTestOptions = {}
): Promise<SimpleGitTestContext> {
    const repo = await (options.fixture ?? createRepoWithOrigin)();
    try {
        const plugin = options.plugin ?? createFakePlugin();
        configurePlugin(
            repo.repoPath,
            plugin,
            options.getVaultOptions?.(repo) ?? {}
        );
        options.configurePlugin?.(plugin);

        const manager = new SimpleGit(plugin);
        const configuredClient =
            typeof options.gitClient === "function"
                ? options.gitClient(repo)
                : options.gitClient;
        if (configuredClient) {
            manager.git = configuredClient;
            manager.absoluteRepoPath = repo.repoPath;
        } else {
            await manager.setGitInstance();
        }
        plugin.gitManager = manager;

        return {
            manager,
            repo,
            plugin,
            cleanup: () => {
                manager.unload();
                repo.cleanup();
            },
        };
    } catch (error) {
        repo.cleanup();
        throw error;
    }
}
