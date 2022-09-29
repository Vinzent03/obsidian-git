import { spawnSync } from "child_process";
import { FileSystemAdapter, normalizePath, Notice } from "obsidian";
import * as path from "path";
import { sep } from "path";
import * as simple from "simple-git";
import simpleGit, { DefaultLogFields } from "simple-git";
import { GitManager } from "./gitManager";
import ObsidianGit from "./main";
import { BranchInfo, FileStatusResult, PluginState, Status } from "./types";

export class SimpleGit extends GitManager {
    git: simple.SimpleGit;
    constructor(plugin: ObsidianGit) {
        super(plugin);
    }

    async setGitInstance(ignoreError = false): Promise<void> {
        if (this.isGitInstalled()) {
            const adapter = this.app.vault.adapter as FileSystemAdapter;
            const path = adapter.getBasePath();
            let basePath = path;
            // Because the basePath setting is a relative path, a leading `/` must
            // be appended before concatenating with the path.
            if (this.plugin.settings.basePath) {
                const exists = await adapter.exists(normalizePath(this.plugin.settings.basePath));
                if (exists) {
                    basePath = path + sep + this.plugin.settings.basePath;
                } else if (!ignoreError) {
                    new Notice("ObsidianGit: Base path does not exist");
                }
            }

            this.git = simpleGit({
                baseDir: basePath,
                binary: this.plugin.localStorage.getGitPath() || undefined,
                config: ["core.quotepath=off"]
            });
            this.git.cwd(await this.git.revparse("--show-toplevel"));
        }
    }

    async status(): Promise<Status> {
        this.plugin.setState(PluginState.status);
        const status = await this.git.status((err) => this.onError(err));
        this.plugin.setState(PluginState.idle);
        return {
            changed: status.files.filter((e) => e.working_dir !== " ").map((e) => {
                const res = this.formatPath(e);

                return <FileStatusResult>{
                    path: res.path,
                    from: res.from,
                    working_dir: e.working_dir === "?" ? "U" : e.working_dir,
                    vault_path: this.getVaultPath(res.path),
                };
            }),
            staged: status.files.filter((e) => e.index !== " " && e.index != "?").map((e) => {
                const res = this.formatPath(e, e.index === "R");
                return <FileStatusResult>{
                    path: res.path,
                    from: res.from,
                    index: e.index,
                    vault_path: this.getVaultPath(res.path),
                };
            }),
            conflicted: status.conflicted.map((path) => this.formatPath({ path }).path),
        };
    }

    //Remove wrong `"` like "My file.md"
    formatPath(path: { from?: string, path: string; }, renamed = false): { path: string, from?: string; } {
        function format(path?: string): string | undefined {
            if (path == undefined) return undefined;

            if (path.startsWith('"') && path.endsWith('"')) {
                return path.substring(1, path.length - 1);
            } else {
                return path;
            }
        }
        if (renamed) {
            return {
                from: format(path.from),
                path: format(path.path)!,
            };
        } else {
            return {
                path: format(path.path)!
            };
        }
    }

    async commitAll({ message }: { message: string; }): Promise<number> {
        if (this.plugin.settings.updateSubmodules) {
            this.plugin.setState(PluginState.commit);
            await new Promise<void>(async (resolve, reject) => {

                this.git.outputHandler(async (cmd, stdout, stderr, args) => {

                    // Do not run this handler on other commands
                    if (!(args.contains("submodule") && args.contains("foreach"))) return;

                    let body = "";
                    const root = (this.app.vault.adapter as FileSystemAdapter).getBasePath() + (this.plugin.settings.basePath ? "/" + this.plugin.settings.basePath : "");
                    stdout.on('data', (chunk) => {
                        body += chunk.toString('utf8');
                    });
                    stdout.on('end', async () => {
                        const submods = body.split('\n');

                        // Remove words like `Entering` in front of each line and filter empty lines
                        const strippedSubmods = submods.map(i => {
                            const submod = i.match(/'([^']*)'/);
                            if (submod != undefined) {
                                return root + "/" + submod[1] + sep;
                            }
                        });

                        strippedSubmods.reverse();
                        for (const item of strippedSubmods) {
                            // Catch empty lines
                            if (item != undefined) {
                                await this.git.cwd({ path: item, root: false }).add("-A", (err) => this.onError(err));
                                await this.git.cwd({ path: item, root: false }).commit(await this.formatCommitMessage(message), (err) => this.onError(err));
                            }
                        }
                        resolve();
                    });
                });


                await this.git.subModule(["foreach", "--recursive", '']);
                this.git.outputHandler(() => { });
            });

        }
        this.plugin.setState(PluginState.add);

        await this.git.add("-A", (err) => this.onError(err));

        this.plugin.setState(PluginState.commit);

        return (await this.git.commit(await this.formatCommitMessage(message), (err) => this.onError(err))).summary.changes;
    }

    async commit(message: string): Promise<number> {
        this.plugin.setState(PluginState.commit);

        const res = (await this.git.commit(await this.formatCommitMessage(message), (err) => this.onError(err))).summary.changes;
        this.plugin.setState(PluginState.idle);
        return res;

    }

    async stage(path: string, relativeToVault: boolean): Promise<void> {
        this.plugin.setState(PluginState.add);

        path = this.getPath(path, relativeToVault);
        await this.git.add(["--", path], (err) => this.onError(err));

        this.plugin.setState(PluginState.idle);
    }

    async stageAll({ dir }: { dir?: string; }): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.add(
            dir ?? "-A", (err) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async unstageAll(): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.reset([], (err) => this.onError(err));
        this.plugin.setState(PluginState.idle);
    }

    async unstage(path: string, relativeToVault: boolean): Promise<void> {
        this.plugin.setState(PluginState.add);

        path = this.getPath(path, relativeToVault);
        await this.git.reset(["--", path], (err) => this.onError(err));

        this.plugin.setState(PluginState.idle);
    }

    async discard(filepath: string): Promise<void> {
        this.plugin.setState(PluginState.add);
        await this.git.checkout(
            ["--", filepath], (err) => this.onError(err)
        );
        this.plugin.setState(PluginState.idle);
    }

    async pull(): Promise<FileStatusResult[] | undefined> {
        this.plugin.setState(PluginState.pull);
        if (this.plugin.settings.updateSubmodules)
            await this.git.subModule(["update", "--remote", "--merge", "--recursive"], (err) => this.onError(err));

        const branchInfo = await this.branchInfo();
        const localCommit = await this.git.revparse([branchInfo.current!], (err) => this.onError(err));

        await this.git.fetch((err) => this.onError(err));
        const upstreamCommit = await this.git.revparse([branchInfo.tracking!], (err) => this.onError(err));

        if (localCommit !== upstreamCommit) {
            if (this.plugin.settings.syncMethod === 'merge' || this.plugin.settings.syncMethod === 'rebase') {
                try {
                    switch (this.plugin.settings.syncMethod) {
                        case 'merge':
                            await this.git.merge([branchInfo.tracking!]);
                            break;
                        case 'rebase':
                            await this.git.rebase([branchInfo.tracking!]);

                    }
                } catch (err) {
                    this.plugin.displayError(`Pull failed (${this.plugin.settings.syncMethod}): ${err.message}`);
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
            const afterMergeCommit = await this.git.revparse([branchInfo.current!], (err) => this.onError(err));

            const filesChanged = await this.git.diff([`${localCommit}..${afterMergeCommit}`, '--name-only']);

            return filesChanged.split(/\r\n|\r|\n/).filter((value) => value.length > 0).map((e) => {
                return <FileStatusResult>{
                    path: e,
                    working_dir: 'P',
                    vault_path: this.getVaultPath(e),
                };
            });
        } else {
            return [];
        }
    }

    async push(): Promise<number> {
        this.plugin.setState(PluginState.status);
        const status = await this.git.status();
        const trackingBranch = status.tracking!;
        const currentBranch = status.current!;
        const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch, "--"], (err) => this.onError(err))).changed;

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
        const trackingBranch = status.tracking!;
        const currentBranch = status.current!;
        const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch, "--"])).changed;

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
            current: status.current || undefined,
            tracking: status.tracking || undefined,
            branches: branches.all,
        };
    }

    async getRemoteUrl(remote: string): Promise<string | undefined> {
        return await this.git.remote(["get-url", remote], (err, url) => this.onError(err)) || undefined;
    }


    // https://github.com/kometenstaub/obsidian-version-history-diff/issues/3
    async log(file: string, relativeToVault = true): Promise<ReadonlyArray<DefaultLogFields>> {
        const path = this.getPath(file, relativeToVault);

        const res = await this.git.log({ file: path, }, (err) => this.onError(err));
        return res.all;
    }

    async show(commitHash: string, file: string, relativeToVault = true): Promise<string> {
        const path = this.getPath(file, relativeToVault);

        return this.git.show([commitHash + ":" + path], (err) => this.onError(err));
    }

    async checkout(branch: string): Promise<void> {
        await this.git.checkout(branch, (err) => this.onError(err));
    }

    async createBranch(branch: string): Promise<void> {
        await this.git.checkout(["-b", branch], (err) => this.onError(err));
    }

    async deleteBranch(branch: string, force: boolean): Promise<void> {
        await this.git.branch([force ? "-D" : "-d", branch], (err) => this.onError(err));
    }

    async branchIsMerged(branch: string): Promise<boolean> {
        const notMergedBranches = await this.git.branch(["--no-merged"], (err) => this.onError(err));
        return !notMergedBranches.all.contains(branch);
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
        console.log(remote);
        console.log(res);

        const list = [];
        for (const item in res.branches) {
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
        try {
            // git 1.8+
            await this.git.branch(['--set-upstream-to', remoteBranch]);
        } catch (e) {
            console.error(e);
            try {
                // git 1.7 - 1.8
                await this.git.branch(['--set-upstream', remoteBranch]);
            } catch (e) {
                console.error(e);
                // fallback
                await this.git.push(["--set-upstream", ...remoteBranch.split("/")], (err) => this.onError(err));
            }
        }

    }

    updateGitPath(gitPath: string) {
        this.setGitInstance();
    }

    updateBasePath(basePath: string) {
        this.setGitInstance(true);
    }

    async getDiffString(filePath: string, stagedChanges = false): Promise<string> {
        if (stagedChanges)
            return (await this.git.diff(["--cached", "--", filePath]));
        else
            return (await this.git.diff(["--", filePath]));
    }

    async diff(file: string, commit1: string, commit2: string): Promise<string> {
        return (await this.git.diff([`${commit1}..${commit2}`, "--", file]));
    }

    private isGitInstalled(): boolean {
        // https://github.com/steveukx/git-js/issues/402
        const command = spawnSync(this.plugin.localStorage.getGitPath() || 'git', ['--version'], {
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
            const networkFailure = error.message.contains("Could not resolve host") || error.message.match(/ssh: connect to host .*? port .*?: Operation timed out/);
            if (!networkFailure) {
                this.plugin.displayError(error.message);
                this.plugin.setState(PluginState.idle);
            } else if (!this.plugin.offlineMode) {
                this.plugin.displayError("Git: Going into offline mode. Future network errors will no longer be displayed.", 2000);
            }

            if (networkFailure) {
                this.plugin.offlineMode = true;
                this.plugin.setState(PluginState.idle);
            }
        }
    }
}
