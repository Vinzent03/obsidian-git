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

        this.setGitInstance();

    }

    private async setGitInstance() {
        if (this.isGitInstalled()) {
            const adapter = this.app.vault.adapter as FileSystemAdapter;
            const path = adapter.getBasePath();
            this.git = simpleGit({
                baseDir: path,
                binary: this.plugin.settings.gitPath || undefined,
                config: ["core.quotepath=off"]
            });
            this.git.cwd(await this.git.revparse("--show-toplevel"));
        }
    }

    async status(): Promise<{
        changed: FileStatusResult[];
        staged: FileStatusResult[];
        conflicted: string[];
    }> {
        this.plugin.setState(PluginState.status);
        const status = await this.git.status((err) => this.onError(err));

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
            await this.git.subModule(["foreach", "--recursive", `git add -A && if [ ! -z "$(git status --porcelain)" ]; then git commit -m "${message ?? await this.formatCommitMessage()}"; fi`], (err) => this.onError(err));
        }
        this.plugin.setState(PluginState.add);

        await this.git.add("./*", (err) => this.onError(err));

        this.plugin.setState(PluginState.commit);

        return (await this.git.commit(await this.formatCommitMessage(message), (err) => this.onError(err))).summary.changes;
    }

    async commit(message?: string): Promise<number> {
        this.plugin.setState(PluginState.commit);

        const res = (await this.git.commit(await this.formatCommitMessage(message), (err) => this.onError(err))).summary.changes;
        this.plugin.setState(PluginState.idle);
        return res;

    }

    async stage(filepath: string): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.add(["--", filepath], (err) => this.onError(err));
        this.plugin.setState(PluginState.idle);
    }

    async stageAll(): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.add(
            "./*", (err) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async unstageAll(): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.reset(
            ["--", "./*"], (err) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async unstage(filepath: string): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.reset(
            ["--", filepath], (err) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);

    }

    async discard(filepath: string): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.checkout(
            ["--", filepath], (err) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async pull(): Promise<number> {
        this.plugin.setState(PluginState.pull);
        if (this.plugin.settings.updateSubmodules)
            await this.git.subModule(["update", "--remote", "--merge", "--recursive"], (err) => this.onError(err));

        const branchInfo = await this.branchInfo();
        const localCommit = await this.git.revparse([branchInfo.current], (err) => this.onError(err));

        await this.git.fetch((err) => this.onError(err));
        const upstreamCommit = await this.git.revparse([branchInfo.tracking], (err) => this.onError(err));

        if (localCommit !== upstreamCommit) {
            if (this.plugin.settings.syncMethod === 'merge' || this.plugin.settings.syncMethod === 'rebase') {
                try {
                    switch (this.plugin.settings.syncMethod) {
                        case 'merge':
                            await this.git.merge([branchInfo.tracking]);
                            break;
                        case 'rebase':
                            await this.git.rebase([branchInfo.tracking]);

                    }
                } catch (err) {
                    this.plugin.displayError(`Pull failed (${this.plugin.settings.syncMethod}): ${err.message}`);
                    const status = await this.status();
                    if (status.conflicted.length > 0) {
                        this.plugin.handleConflict(status.conflicted);
                    }
                    return;
                }

            } else if (this.plugin.settings.syncMethod === 'reset') {
                try {
                    await this.git.raw(['update-ref', `refs/heads/${branchInfo.current}`, upstreamCommit], (err) => this.onError(err));
                    await this.unstageAll();
                } catch (err) {
                    this.plugin.displayError(`Sync failed (${this.plugin.settings.syncMethod}): ${err.message}`);
                }
            }

            const filesChanged = await this.git.diff([`${localCommit}..${upstreamCommit}`, '--name-only']);
            return filesChanged.split(/\r\n|\r|\n/).filter((value) => value.length > 0).length;
        } else {
            return 0;
        }
    }

    async push(): Promise<number> {
        this.plugin.setState(PluginState.status);
        const status = await this.git.status();
        const trackingBranch = status.tracking;
        const currentBranch = status.current;
        const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch])).changed;

        this.plugin.setState(PluginState.push);
        if (this.plugin.settings.updateSubmodules) {
            await this.git.env({ ...process.env, "OBSIDIAN_GIT": 1 }).subModule(["foreach", "--recursive", `tracking=$(git for-each-ref --format='%(upstream:short)' "$(git symbolic-ref -q HEAD)"); echo $tracking; if [ ! -z "$(git diff --shortstat $tracking)" ]; then git push; fi`], (err) => this.onError(err));

        }
        await this.git.env({ ...process.env, "OBSIDIAN_GIT": 1 }).push((err) => this.onError(err));

        return remoteChangedFiles;
    }


    async canPush(): Promise<boolean> {
        // allow pushing in submodules even if the root has no changes.
        if (this.plugin.settings.updateSubmodules === true) {
            return true;
        }
        const status = await this.git.status((err) => this.onError(err));
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
        const status = await this.git.status((err) => this.onError(err));
        const branches = await this.git.branch(["--no-color"], (err) => this.onError(err));

        return {
            current: status.current,
            tracking: status.tracking,
            branches: branches.all,
        };
    }

    async checkout(branch: string): Promise<void> {
        await this.git.checkout(branch, (err) => this.onError(err));
    }

    async init(): Promise<void> {
        await this.git.init(false, (err) => this.onError(err));
    }

    async clone(url: string, dir: string): Promise<void> {
        await this.git.clone(url, path.join((this.app.vault.adapter as FileSystemAdapter).getBasePath(), dir), [], (err) => this.onError(err));
    }

    async setConfig(path: string, value: any): Promise<void> {
        await this.git.addConfig(path, value, (err) => this.onError(err));
    }

    async getConfig(path: string): Promise<any> {
        const config = await this.git.listConfig((err) => this.onError(err));
        return config.all[path];
    }

    async fetch(remote?: string): Promise<void> {
        await this.git.fetch(remote != undefined ? [remote] : [], (err) => this.onError(err));
    }

    async setRemote(name: string, url: string): Promise<void> {
        if ((await this.getRemotes()).includes(name))
            await this.git.remote(["set-url", name, url], (err) => this.onError(err));

        else {
            await this.git.remote(["add", name, url], (err) => this.onError(err));
        }
    }

    async getRemoteBranches(remote: string): Promise<string[]> {
        const res = await this.git.branch(["-r", "--list", `${remote}*`], (err) => this.onError(err));
        const list = [];
        for (var item in res.branches) {
            list.push(res.branches[item].name);
        }
        return list;
    }

    async getRemotes() {
        const res = await this.git.remote([], (err) => this.onError(err));
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
        await this.git.push(["--set-upstream", ...remoteBranch.split("/")], (err) => this.onError(err));

    }

    updateGitPath(gitPath: string) {
        this.setGitInstance();
    }

    async getDiffString(filePath: string): Promise<string> {
        return (await this.git.diff([filePath]));

    }

    private isGitInstalled(): boolean {
        // https://github.com/steveukx/git-js/issues/402
        const command = spawnSync(this.plugin.settings.gitPath || 'git', ['--version'], {
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
            this.plugin.setState(PluginState.idle);
        }
    }
}
