import path from "path";
import type { GitManager } from "../../src/gitManager/gitManager";
import { createFakePlugin, type FakePlugin } from "./createFakePlugin";
import { createRepoWithOrigin, type TestRepo } from "./gitRepo";
import { createIsomorphicGitManager } from "./isomorphicGit";
import { createSimpleGitManager } from "./simpleGit";

export type GitFixture = () => Promise<TestRepo>;

export interface GitManagerTestHarness {
    manager: GitManager;
    repo: TestRepo;
    plugin: FakePlugin;
    cleanup(): void;
}

export interface GitManagerBackend {
    name: string;
    create(fixture?: GitFixture): Promise<GitManagerTestHarness>;
}

function getVaultOptions(repo: TestRepo): {
    vaultPath: string;
    basePath: string;
} {
    return {
        vaultPath: repo.dir,
        basePath: path
            .relative(repo.dir, repo.repoPath)
            .split(path.sep)
            .join("/"),
    };
}

async function createSimpleGitHarness(
    fixture: GitFixture = createRepoWithOrigin
): Promise<GitManagerTestHarness> {
    const repo = await fixture();
    const testPlugin = createFakePlugin();
    const { manager, plugin } = createSimpleGitManager(
        repo.repoPath,
        repo.git,
        testPlugin,
        getVaultOptions(repo)
    );
    return {
        manager,
        repo,
        plugin,
        cleanup: () => {
            manager.unload();
            repo.cleanup();
        },
    };
}

async function createIsomorphicGitHarness(
    fixture: GitFixture = createRepoWithOrigin
): Promise<GitManagerTestHarness> {
    const repo = await fixture();
    const { manager, plugin } = createIsomorphicGitManager(
        repo.repoPath,
        getVaultOptions(repo)
    );
    return {
        manager,
        repo,
        plugin,
        cleanup: () => {
            manager.unload();
            repo.cleanup();
        },
    };
}

export const gitManagerBackends: GitManagerBackend[] = [
    {
        name: "simple-git",
        create: createSimpleGitHarness,
    },
    {
        name: "isomorphic-git",
        create: createIsomorphicGitHarness,
    },
];
