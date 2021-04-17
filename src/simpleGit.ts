import { spawnSync } from "child_process";
import { FileSystemAdapter, Notice } from "obsidian";
import simpleGit, * as simple from "simple-git";
import { GitManager } from "./gitManager";
import ObsidianGit from "./main";
import { BranchInfo, FileStatusResult, PluginState } from "./types";

export class SimpleGit extends GitManager {
    git: simple.SimpleGit;
    constructor(plugin: ObsidianGit) {
        super(plugin);

        const adapter = this.app.vault.adapter as FileSystemAdapter;
        const path = adapter.getBasePath();

        if (this.isGitInstalled()) {
            this.git = simpleGit(path);
        }
    }

    async status(): Promise<{
        changed: FileStatusResult[];
        staged: string[];
        conflicted: string[];
    }> {
        this.plugin.setState(PluginState.status);
        const status = await this.git.status();
        return {
            changed: status.files,
            staged: status.staged,
            conflicted: status.conflicted,
        };
    }

    async commitAll(message?: string): Promise<number> {
        this.plugin.setState(PluginState.add);
        await this.git.add(
            "./*",
            (err: Error | null) =>
                err && this.plugin.displayError(`Cannot add files: ${err.message}`)
        );
        this.plugin.setState(PluginState.commit);

        return (await this.git.commit(message ?? await this.formatCommitMessage())).summary.changes;
    }

    async pull(): Promise<number> {
        this.plugin.setState(PluginState.pull);
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
        this.plugin.setState(PluginState.push);
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

    async checkRequirements(): Promise<"valid" | "missing-repo" | "missing-git" | "wrong-settings"> {
        if (!this.isGitInstalled()) {
            return "missing-git";
        }
        if (!(await this.git.checkIsRepo())) {
            return "missing-repo";
        }
        const config = (await this.git.listConfig()).all;
        const user = config["user.name"];
        const email = config["user.email"];
        const remoteURL = config["remote.origin.url"];

        if (!user || !email || !remoteURL) {
            return "wrong-settings";
        }

        return "valid";
    }

    async branchInfo(): Promise<BranchInfo> {
        const status = await this.git.status();
        const branches = await this.git.branchLocal();

        return {
            current: status.current,
            remote: status.tracking,
            branches: branches.all
        };
    };

    async checkout(branch: string): Promise<void> {
        await this.git.checkout(branch, async (err: Error) => {
            if (err) {
                new Notice(err.message);
            }
        });
    };

    async init(): Promise<void> {
        await this.git.init(false);
    };

    async setConfig(path: string, value: any): Promise<void> {
        await this.git.addConfig(path, value);
    };

    async getConfig(path: string): Promise<any> {
        const config = await this.git.listConfig();
        return config.all[path];
    }
    private isGitInstalled(): boolean {
        // https://github.com/steveukx/git-js/issues/402
        const command = spawnSync('git', ['--version'], {
            stdio: 'ignore'
        });

        if (command.error) {
            console.error(command.error);
            return false;
        }
        return true;
    }
}