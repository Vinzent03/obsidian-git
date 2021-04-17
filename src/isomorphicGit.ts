import git, { ReadCommitResult } from 'isomorphic-git';
import http from "isomorphic-git/http/web";
import { GitManager } from "./gitManager";
import ObsidianGit from './main';
import { BranchInfo, DiffResult, FileStatusResult, PluginState, Status } from './types';

export class IsomorphicGit extends GitManager {
    private fs: any;
    private dir: string;
    private readonly FILE = 0;
    private readonly HEAD = 1;
    private readonly WORKDIR = 2;
    private readonly STAGE = 3;
    private readonly indexes = {
        "000": "",
        "003": "AD",
        "020": "??",
        "022": "A",
        "023": "AM",
        "100": "D ",
        "101": " D",
        "103": "MD",
        "110": "D ??",
        "111": "",
        "120": "D ??",
        "121": " M",
        "122": "M ",
        "123": "MM"
    };

    constructor(plugin: ObsidianGit) {
        super(plugin);
        this.fs = (this.app.vault.adapter as any).fs;
        this.dir = decodeURIComponent(this.app.vault.adapter.getResourcePath("").replace("app://local/", ""));
        this.dir = this.dir.substring(0, this.dir.indexOf("?"));
    }

    async status(): Promise<Status> {
        this.plugin.setState(PluginState.status);
        const status = await git.statusMatrix({
            fs: this.fs,
            dir: this.dir,
        });

        const changed: FileStatusResult[] = status.filter(row => row[this.HEAD] !== row[this.WORKDIR]).map(row => this.getFileStatusResult(row));
        const staged = status.filter(row => row[this.STAGE] === 3 || row[this.STAGE] === 2).map(row => row[this.FILE]);

        return {
            changed: changed,
            staged: staged,
        };
    }

    async commitAll(message?: string): Promise<number> {
        this.plugin.setState(PluginState.commit);
        const commitBefore = await this.getCurrentCommit();

        const repo = {
            fs: this.fs,
            dir: this.dir
        };
        const status = await git.statusMatrix(repo);
        await Promise.all(
            status.map(([filepath, , worktreeStatus]) =>
                worktreeStatus ? git.add({ ...repo, filepath }) : git.remove({ ...repo, filepath })
            )
        );
        const formatMessage = message ?? await this.formatCommitMessage();

        await git.commit({
            ...repo,
            message: formatMessage
        });
        const commitAfter = await this.getCurrentCommit();
        this.plugin.lastUpdate = Date.now();
        return await this.getChangedFiles(commitBefore.oid, commitAfter.oid);

    }

    async pull(): Promise<number> {
        this.plugin.setState(PluginState.pull);
        const commitBefore = await this.getCurrentCommit();

        await git.pull({
            fs: this.fs,
            dir: this.dir,
            http: http,
            corsProxy: this.plugin.settings.proxyURL,
            onAuth: () => {
                const username = window.localStorage.getItem(this.plugin.manifest.id + ":username");
                const password = window.localStorage.getItem(this.plugin.manifest.id + ":password");
                return { username: username, password: password };
            }
        });
        this.plugin.lastUpdate = Date.now();

        const commitAfter = await this.getCurrentCommit();

        return await this.getChangedFiles(commitBefore.oid, commitAfter.oid);
    }

    async push(): Promise<number> {
        this.plugin.setState(PluginState.push);
        const branchInfo = await this.branchInfo();
        const changedFiles = await this.getChangedFiles(branchInfo.current, branchInfo.remote);

        await git.push({
            fs: this.fs,
            dir: this.dir,
            http: http,
            corsProxy: this.plugin.settings.proxyURL,
            onAuth: () => {
                const username = window.localStorage.getItem(this.plugin.manifest.id + ":username");
                const password = window.localStorage.getItem(this.plugin.manifest.id + ":password");
                return { username: username, password: password };
            }
        });
        this.plugin.lastUpdate = Date.now();
        return changedFiles;
    }

    async canPush(): Promise<boolean> {
        const branchInfo = await this.branchInfo();
        return await this.getChangedFiles(branchInfo.current, branchInfo.remote) !== 0;
    }

    async checkRequirements(): Promise<"valid" | "missing-repo" | "wrong-settings"> {
        try {
            await git.log({
                fs: this.fs,
                dir: this.dir,
                depth: 1
            });
        } catch (error) {
            if (error.code === "NotFoundError" && error.data.what === "HEAD") {
                return "missing-repo";
            }
        }
        const user = await git.getConfig({ fs: this.fs, dir: this.dir, path: "user.name" });
        const email = await git.getConfig({ fs: this.fs, dir: this.dir, path: "user.email" });
        const remoteURL = await git.getConfig({ fs: this.fs, dir: this.dir, path: "remote.origin.url" });

        if (!user || !email || !remoteURL) {
            return "wrong-settings";
        }

        return "valid";
    }

    async branchInfo(): Promise<BranchInfo> {
        const current = await git.currentBranch({
            fs: this.fs,
            dir: this.dir
        }) || "";

        const branches = await git.listBranches({
            fs: this.fs,
            dir: this.dir,
        });

        const remote = await git.getConfig({
            fs: this.fs,
            dir: this.dir,
            path: `branch.${current}.remote`
        }) ?? "";

        const branch = (await git.getConfig({
            fs: this.fs,
            dir: this.dir,
            path: `branch.${current}.merge`
        }))?.split("refs/heads")[1] ?? "";

        return {
            current: current,
            remote: remote + branch,
            branches: branches
        };
    }

    async checkout(branch: string): Promise<void> {
        return git.checkout({
            fs: this.fs,
            dir: this.dir,
            ref: branch,
        });
    }

    async init(): Promise<void> {
        return git.init({
            fs: this.fs,
            dir: this.dir
        });
    }

    setConfig(path: string, value: any): Promise<void> {
        return git.setConfig({
            fs: this.fs,
            dir: this.dir,
            path: path,
            value: value
        });
    }

    getConfig(path: string): Promise<any> {
        return git.getConfig({
            fs: this.fs,
            dir: this.dir,
            path: path
        });
    }


    private getFileStatusResult(row: [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3]): FileStatusResult {
        const index = (this.indexes as any)[`${row[this.HEAD]}${row[this.WORKDIR]}${row[this.STAGE]}`];

        return { index: index, path: row[this.FILE] };
    }

    private async getCurrentCommit(): Promise<ReadCommitResult> {
        return (await git.log({
            fs: this.fs,
            dir: this.dir,
            depth: 1
        }))[0];
    }

    private async getChangedFiles(commitHash1: string, commitHash2: string): Promise<number> {
        return (await this.diff(commitHash1, commitHash2)).filter(file => file.type !== "equal").length;
    }

    // fixed from https://isomorphic-git.org/docs/en/snippets#git-diff-name-status-commithash1-commithash2
    private async diff(commitHash1: string, commitHash2: string): Promise<DiffResult[]> {
        return git.walk({
            fs: this.fs,
            dir: this.dir,
            trees: [git.TREE({ ref: commitHash1 }), git.TREE({ ref: commitHash2 })],
            map: async (filepath, [A, B]) => {

                // ignore directories
                if (filepath === '.') {
                    return;
                }
                if ((await A?.type()) === 'tree' || (await B?.type()) === 'tree') {
                    return;
                }

                // generate ids
                const Aoid = await A?.oid();
                const Boid = await B?.oid();

                // determine modification type
                let type = 'equal';
                if (Aoid !== Boid) {
                    type = 'modify';
                }
                if (Aoid === undefined) {
                    type = 'remove';
                }
                if (Boid === undefined) {
                    type = 'add';
                }
                if (Aoid === undefined && Boid === undefined) {
                    console.log('Something weird happened:');
                    console.log(A);
                    console.log(B);
                }

                return {
                    path: `/${filepath}`,
                    type: type,
                };
            },
        });
    }
}