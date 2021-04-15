import git, { ReadCommitResult } from 'isomorphic-git';
import http from "isomorphic-git/http/web";
import { GitManager } from "./gitManager";
import ObsidianGit from './main';
import { Author, DiffResult, FileStatusResult, Status } from './types';

export class IsomorphicGit extends GitManager {
    private fs: any;
    private dir: string;
    author: Author;
    proxy: string;
    repoUrl: string;
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

    constructor(plugin: ObsidianGit, author: Author, proxy: string, repoUrl: string) {
        super(plugin);
        this.fs = (this.app.vault.adapter as any).fs;
        this.author = author;
        this.proxy = proxy;
        this.repoUrl = repoUrl;
        this.dir = decodeURIComponent(this.app.vault.adapter.getResourcePath("").replace("app://local/", ""));
        this.dir = this.dir.substring(0, this.dir.indexOf("?"));
    }

    async status(): Promise<Status> {
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

    async commit(message?: string): Promise<void> {
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
            author: this.author,
            message: formatMessage
        });
    }

    async pull(): Promise<number> {
        const commitBefore = await this.getCurrentCommit();

        await git.pull({
            fs: this.fs,
            dir: this.dir,
            http: http,
            author: this.author,
            corsProxy: this.proxy,
            url: this.repoUrl,
            onAuth: () => {
                const username = window.localStorage.getItem(this.plugin.manifest.id + ":username");
                const password = window.localStorage.getItem(this.plugin.manifest.id + ":password");
                return { username: username, password: password };
            }
        });

        const commitAfter = await this.getCurrentCommit();

        const diff = await this.diff(commitBefore.oid, commitAfter.oid);

        const changedFiles = diff.filter(file => file.type !== "equal");
        return changedFiles.length;
    }

    async push(): Promise<number> {
        const diff = await this.diff("master", "origin/master"); //TODO configurable
        await git.push({
            fs: this.fs,
            dir: this.dir,
            http: http,
            corsProxy: this.proxy,
            url: this.repoUrl,
            onAuth: () => {
                const username = window.localStorage.getItem(this.plugin.manifest.id + ":username");
                const password = window.localStorage.getItem(this.plugin.manifest.id + ":password");
                return { username: username, password: password };
            }
        });


        const changedFiles = diff.filter(file => file.type !== "equal");
        return changedFiles.length;
    }

    async canPush(): Promise<boolean> {
        return (await this.diff("master", "origin/master")).length !== 0; //TODO configurable
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

    // https://isomorphic-git.org/docs/en/snippets#git-diff-name-status-commithash1-commithash2
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
                if ((await A.type()) === 'tree' || (await B.type()) === 'tree') {
                    return;
                }

                // generate ids
                const Aoid = await A.oid();
                const Boid = await B.oid();

                // determine modification type
                let type = 'equal';
                if (Aoid !== Boid) {
                    type = 'modify';
                }
                if (Aoid === undefined) {
                    type = 'add';
                }
                if (Boid === undefined) {
                    type = 'remove';
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