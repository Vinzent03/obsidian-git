import { spawnSync } from "child_process";
import { FileSystemAdapter } from "obsidian";
import * as path from "path";
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
            this.git = simpleGit({
                baseDir: path,
                binary: this.plugin.settings.gitPath || undefined,
            });
        }
    }

    async status(): Promise<{
        changed: FileStatusResult[];
        staged: FileStatusResult[];
        conflicted: string[];
    }> {
        this.plugin.setState(PluginState.status);
        const status = await this.git.status();

        this.plugin.setState(PluginState.idle);
        return {
            changed: status.files.filter((e) => e.working_dir !== " ").map((e) => {
                const res = this.formatPath(e.path);
                e.path = res.path;
                e.from = res.from;
                e.working_dir = e.working_dir === "?" ? "U" : e.working_dir;
                return e;
            }),
            staged: status.files.filter((e) => e.index !== " " && e.index != "?").map((e) => {
                const res = this.formatPath(e.path, e.index === "R");
                e.path = res.path;
                e.from = res.from;
                return e;
            }),
            conflicted: status.conflicted.map((e) => this.formatPath(e).path),
        };
    }

    //Remove wrong `"` like "My file.md"
    formatPath(path: string, renamed: boolean = false): { path: string, from?: string; } {
        function format(path: string): string {

            if (path.startsWith('"') && path.endsWith('"')) {
                return path.substring(1, path.length - 1);
            } else {
                return path;
            }
        }
        if (renamed) {
            const paths = path.split(" -> ").map((e) => format(e));

            return {
                from: paths[0],
                path: paths[1],
            };
        } else {
            return {
                path: format(path)
            };
        }
    }

    async commitAll(message?: string): Promise<number> {
        if (this.plugin.settings.updateSubmodules) {
            this.plugin.setState(PluginState.commit);
            await this.git.subModule(["foreach", "--recursive", `git add -A && if [ ! -z "$(git status --porcelain)" ]; then git commit -m "${message ?? await this.formatCommitMessage()}"; fi`], (err: any) => this.onError(err));
        }
        this.plugin.setState(PluginState.add);
        await this.git.add(
            "./*", (err: any) => this.onError(err)
        );
        this.plugin.setState(PluginState.commit);

        return (await this.git.commit(await this.formatCommitMessage(message))).summary.changes;
    }

    async commit(message?: string): Promise<number> {
        this.plugin.setState(PluginState.commit);

        const res = (await this.git.commit(await this.formatCommitMessage(message))).summary.changes;
        this.plugin.setState(PluginState.idle);
        return res;

    }

    async stage(filepath: string): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.add(
            filepath, (err: any) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async stageAll(): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.add(
            "./*", (err: any) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async unstageAll(): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.reset(
            ["--", "./*"], (err: any) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async unstage(filepath: string): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.reset(
            ["--", filepath], (err: any) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);

    }

    async discard(filepath: string): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.checkout(
            ["--", filepath], (err: any) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async pull(): Promise<number> {
        this.plugin.setState(PluginState.pull);
        if (this.plugin.settings.updateSubmodules)
            await this.git.subModule(["update", "--remote", "--merge", "--recursive"], (err: any) => this.onError(err));

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
        this.plugin.setState(PluginState.status);
        const status = await this.git.status();
        const trackingBranch = status.tracking;
        const currentBranch = status.current;
        const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch])).changed;

        this.plugin.setState(PluginState.push);
        if (this.plugin.settings.updateSubmodules) {
            await this.git.env({ ...process.env, "OBSIDIAN_GIT": 1 }).subModule(["foreach", "--recursive", `tracking=$(git for-each-ref --format='%(upstream:short)' "$(git symbolic-ref -q HEAD)"); echo $tracking; if [ ! -z "$(git diff --shortstat $tracking)" ]; then git push; fi`], (err: any) => this.onError(err));

        }
        await this.git.env({ ...process.env, "OBSIDIAN_GIT": 1 }).push((err: any) => this.onError(err));

        return remoteChangedFiles;
    }


    async canPush(): Promise<boolean> {
        // allow pushing in submodules even if the root has no changes.
        if (this.plugin.settings.updateSubmodules === true) {
            return true;
        }
        const status = await this.git.status((err: any) => this.onError(err));
        const trackingBranch = status.tracking;
        const currentBranch = status.current;
        const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch])).changed;

        return remoteChangedFiles !== 0;
    }

    async checkRequirements(): Promise<"valid" | "missing-repo" | "missing-git"> {
        if (!this.isGitInstalled()) {
            return "missing-git";
        }
        if (!(await this.git.checkIsRepo())) {
            return "missing-repo";
        }
        return "valid";
    }

    async branchInfo(): Promise<BranchInfo> {
        const status = await this.git.status((err: any) => this.onError(err));
        const branches = await this.git.branch(["--no-color"], (err: any) => this.onError(err));

        return {
            current: status.current,
            tracking: status.tracking,
            branches: branches.all,
        };
    }

    async checkout(branch: string): Promise<void> {
        await this.git.checkout(branch, (err: any) => this.onError(err));
    }

    async init(): Promise<void> {
        await this.git.init(false, (err: any) => this.onError(err));
    }

    async clone(url: string, dir: string): Promise<void> {
        await this.git.clone(url, path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), dir), [], (err: any) => this.onError(err));
    }

    async setConfig(path: string, value: any): Promise<void> {
        await this.git.addConfig(path, value, (err: any) => this.onError(err));
    }

    async getConfig(path: string): Promise<any> {
        const config = await this.git.listConfig((err: any) => this.onError(err));
        return config.all[path];
    }

    async fetch(remote?: string): Promise<void> {
        await this.git.fetch(remote != undefined ? [remote] : [], (err: any) => this.onError(err));
    }

    async setRemote(name: string, url: string): Promise<void> {
        if ((await this.getRemotes()).includes(name))
            await this.git.remote(["set-url", name, url], (err: any) => this.onError(err));

        else {
            await this.git.remote(["add", name, url], (err: any) => this.onError(err));
        }
    }

    async getRemoteBranches(remote: string): Promise<string[]> {
        const res = await this.git.branch(["-r", "--list", `${remote}*`], (err: any) => this.onError(err));
        const list = [];
        for (var item in res.branches) {
            list.push(res.branches[item].name);
        }
        return list;
    }

    async getRemotes() {
        const res = await this.git.remote([], (err: any) => this.onError(err));
        if (res) {
            return res.trim().split("\n");
        } else {
            return [];
        }
    }

    async removeRemote(remoteName: string) {
        await this.git.removeRemote(remoteName);
    }

    async updateUpstreamBranch(remoteBranch: string) {
        await this.git.push(["--set-upstream", ...remoteBranch.split("/")], (err: any) => this.onError(err));

    }

    updateGitPath(gitPath: string) {
        return this.git.customBinary(gitPath);
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

    private onError(error: Error | null) {
        if (error) {
            this.plugin.displayError(error.message);
        }
    }
}