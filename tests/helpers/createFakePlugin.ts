import { vi } from "vitest";
import type ObsidianGit from "../../src/main";

export type FakePlugin = ObsidianGit & {
    app: {
        workspace: {
            trigger: ReturnType<typeof vi.fn>;
        };
    };
    setPluginState: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    displayError: ReturnType<typeof vi.fn>;
};

export function createFakePlugin(): FakePlugin {
    return {
        app: {
            workspace: {
                trigger: vi.fn(),
            },
        },
        settings: {},
        localStorage: {},
        setPluginState: vi.fn(),
        log: vi.fn(),
        displayError: vi.fn(),
    } as unknown as FakePlugin;
}
