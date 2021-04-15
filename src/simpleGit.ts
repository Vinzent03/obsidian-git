import { FileSystemAdapter } from "obsidian";
import simpleGit, * as simple from "simple-git";
import { GitManager } from "./gitManager";
import ObsidianGit from "./main";
import { Status } from "./types";

export class SimpleGit extends GitManager {
    git: simple.SimpleGit;
    constructor(plugin: ObsidianGit) {
        super(plugin);

        const adapter = this.app.vault.adapter as FileSystemAdapter;
        const path = adapter.getBasePath();

        this.git = simpleGit(path);
    }

    async status(): Promise<Status> {
        const status = await this.git.status();
        return {
            changed: status.files,
            staged: status.staged
        };
    }

    async commit(message?: string): Promise<void> {
        this.git.commit(message ?? await this.formatCommitMessage());
    }

    async pull(): Promise<number> {
        const pullResult = await this.git.pull(["--no-rebase"],
            async (err: Error | null) => {
                if (err) {
                    this.plugin.displayError(`Pull failed ${err.message}`);
                    const status = await this.git.status();
                    if (status.conflicted.length > 0) {
                        this.plugin.handleConflict(status.conflicted);
                    }
                }
            }
        );

        return pullResult.files.length;
    }

    async push(): Promise<number> {
        const status = await this.git.status();
        const trackingBranch = status.tracking;
        const currentBranch = status.current;
        const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch])).changed;

        await this.git.push(
            (err: Error | null) => {
                err && this.plugin.displayError(`Push failed ${err.message}`);
            }
        );

        return remoteChangedFiles;
    }


    async canPush(): Promise<boolean> {
        const status = await this.git.status();
        const trackingBranch = status.tracking;
        const currentBranch = status.current;
        const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch])).changed;

        return remoteChangedFiles !== 0;
    }
}