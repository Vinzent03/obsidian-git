import { vi } from "vitest";
import type ObsidianGit from "../../src/main";
import type { ObsidianGitSettings } from "../../src/types";
import { FsVaultAdapter } from "./fsVaultAdapter";

export type WasmGitFakePlugin = ObsidianGit & {
    app: ObsidianGit["app"] & {
        workspace: { trigger: ReturnType<typeof vi.fn> };
    };
    setPluginState: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    displayError: ReturnType<typeof vi.fn>;
    handleConflict: ReturnType<typeof vi.fn>;
    /** In-memory backing store of the localStorage fake. */
    storage: Map<string, string>;
};

/**
 * Builds a plugin fake with everything the wasm-git engine touches: an
 * fs-backed vault adapter, settings, and an in-memory localStorage
 * (credentials, conflict flag).
 */
export function createWasmGitPlugin(args: {
    adapter: FsVaultAdapter;
    settings?: Partial<ObsidianGitSettings>;
    username?: string;
    password?: string;
}): WasmGitFakePlugin {
    const storage = new Map<string, string>();
    if (args.username) storage.set("username", args.username);
    if (args.password) storage.set("password", args.password);

    const plugin = {
        app: {
            vault: {
                adapter: args.adapter,
                configDir: ".obsidian",
                getAbstractFileByPath: () => null,
            },
            workspace: {
                trigger: vi.fn(),
            },
        },
        settings: {
            basePath: "",
            gitDir: "",
            disablePopups: true,
            disablePopupsForNoChanges: true,
            mergeStrategy: "none",
            commitDateFormat: "YYYY-MM-DD HH:mm:ss",
            listChangedFilesInMessageBody: false,
            ...args.settings,
        },
        localStorage: {
            getUsername: () => storage.get("username") ?? null,
            setUsername: (value: string) => storage.set("username", value),
            getPassword: () => storage.get("password") ?? null,
            setPassword: (value: string) => storage.set("password", value),
            getHostname: () => storage.get("hostname") ?? null,
            getConflict: () => storage.get("conflict") === "true",
            setConflict: (value: boolean) =>
                storage.set("conflict", String(value)),
        },
        storage,
        setPluginState: vi.fn(),
        log: vi.fn(),
        displayError: vi.fn(),
        handleConflict: vi.fn(),
    } as unknown as WasmGitFakePlugin;
    return plugin;
}
