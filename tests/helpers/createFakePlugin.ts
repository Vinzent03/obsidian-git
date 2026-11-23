import { vi } from "vitest";
import type ObsidianGit from "../../src/main";
import { GitOperation } from "../../src/types";
import { RepoFileSystem } from "../../src/repoFileSystem";

export type FakePlugin = ObsidianGit & {
    app: {
        workspace: {
            trigger: ReturnType<typeof vi.fn>;
        };
    };
    setPluginState: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    displayError: ReturnType<typeof vi.fn>;
};

export function createFakePlugin(): FakePlugin {
    const plugin = {
        app: {
            workspace: {
                trigger: vi.fn(),
            },
        },
        settings: {},
        localStorage: {},
        state: {
            offlineMode: false,
            mergeInProgress: false,
            rebaseInProgress: false,
            operation: GitOperation.idle,
        },
        setPluginState: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
        displayError: vi.fn(),
    } as unknown as FakePlugin;
    plugin.fileSystem = new RepoFileSystem(plugin.app);
    return plugin;
}
