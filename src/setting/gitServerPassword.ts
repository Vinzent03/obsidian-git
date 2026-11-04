import type ObsidianGit from "../main";

const DEFAULT_SECRET_ID = "obsidian-git-password";

/** Manages the mobile Git credential and its former vault-local value. */
export class GitServerPassword {
    constructor(private readonly plugin: ObsidianGit) {}

    get(): string | null {
        const id = this.plugin.settings.gitServerPasswordSecret;
        return id ? this.plugin.app.secretStorage.getSecret(id) : null;
    }

    async set(value: string): Promise<void> {
        let id = this.plugin.settings.gitServerPasswordSecret;
        if (!id) {
            id = DEFAULT_SECRET_ID;
            for (
                let suffix = 2;
                this.plugin.app.secretStorage.getSecret(id) !== null;
                suffix++
            ) {
                id = `${DEFAULT_SECRET_ID}-${suffix}`;
            }
        }

        this.plugin.app.secretStorage.setSecret(id, value);
        if (this.plugin.settings.gitServerPasswordSecret !== id) {
            this.plugin.settings.gitServerPasswordSecret = id;
            try {
                await this.plugin.saveSettings();
            } catch (error) {
                this.plugin.settings.gitServerPasswordSecret = "";
                throw error;
            }
        }
    }

    async migrateLegacy(): Promise<void> {
        const legacy = this.plugin.localStorage.getLegacyPassword();
        if (legacy === null) return;

        // A selected, available secret takes precedence over a stale legacy value.
        if (legacy && this.get() === null) await this.set(legacy);
        this.plugin.localStorage.clearLegacyPassword();
    }
}
