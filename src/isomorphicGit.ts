// TODO: Use different FS for mobile, maybe custom one?
import git, { AuthCallback, GitHttpRequest, GitHttpResponse, HttpClient } from "isomorphic-git";
import { Notice, requestUrl } from 'obsidian';


import { GitManager } from "./gitManager";
import ObsidianGit from './main';
import { MyAdapter } from './myAdapter';
import { BranchInfo, FileStatusResult, PluginState, Status } from "./types";

// TODO: Set to idle, what's a nice way to do this...
// TODO: Nicer way to display error... I'm doing it multiple times if I call other
// helpers...
// TODO: Is there a style setup, like ESLint or Prettier?


const myHTTP = {
    async request({
        url,
        method,
        headers,
        body,
    }: GitHttpRequest): Promise<GitHttpResponse> {
        // We can't stream yet, so collect body and set it to the ArrayBuffer
        // because that's what requestUrl expects
        if (body) {
            body = await collect(body);
            body = body.buffer;
        }

        const res = await requestUrl({ url, method, headers, body });

        return {
            url,
            method,
            headers: res.headers,
            body: [new Uint8Array(res.arrayBuffer)],
            statusCode: res.status,
            statusMessage: res.text,
        };
    }
};

export class IsomorphicGit extends GitManager {
    updateBasePath(basePath: string): void {
        throw new Error("Method not implemented.");
    }
    diff(file: string, commit1: string, commit2: string): Promise<string> {
        throw new Error("Method not implemented.");
    }
    log(file: string): Promise<string[]> {
        throw new Error("Method not implemented.");
    }
    show(commitHash: string, file: string): Promise<string> {
        throw new Error("Method not implemented.");
    }
    private repo: {
        fs: MyAdapter,
        dir: string,
        author: object,
        onAuth: AuthCallback,
        http: HttpClient,
    };
    private readonly FILE = 0;
    private readonly HEAD = 1;
    private readonly WORKDIR = 2;
    private readonly STAGE = 3;
    // Mapping from statusMatrix to git status codes based off git status --short
    // See: https://isomorphic-git.org/docs/en/statusMatrix
    private readonly status_mapping = {
        "000": "  ",
        "003": "AD",
        "020": "??",
        "022": "A ",
        "023": "AM",
        "100": "D ",
        "101": " D",
        "103": "MD",
        "110": "DA", // Technically, two files: first one is deleted "D " and second one is untracked "??"
        "111": "  ",
        "120": "DA", // Same as "110"
        "121": " M",
        "122": "M ",
        "123": "MM"
    };
    private readonly noticeLength = 999_999;

    constructor(plugin: ObsidianGit) {
        super(plugin);

        this.repo = {
            fs: new MyAdapter(this.app.vault),
            dir: "",
            author: {
                name: this.plugin.settings.username,
            },
            onAuth: () => ({
                username: this.plugin.settings.username,
                password: this.plugin.settings.password
            }),
            http: myHTTP,
        };
    }

    async status(): Promise<Status> {
        try {
            this.plugin.setState(PluginState.status);
            const status = (await git.statusMatrix(this.repo)).map(row => this.getFileStatusResult(row));

            const changed = status.filter(fileStatus => fileStatus.working_dir !== " ");
            const staged = status.filter(fileStatus => fileStatus.index !== " " && fileStatus.index !== "?");
            // TODO: How to determine merge conflicts with isomorphic-git?
            const conflicted: FileStatusResult[] = [];
            return { changed, staged, conflicted };
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    };

    async commitAll(message?: string): Promise<number> {
        // TODO: Submodules support
        try {
            await this.stageAll();
            return this.commit(message);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async commit(message?: string): Promise<number> {
        try {
            this.plugin.setState(PluginState.commit);
            const status = await this.status();
            console.log("This is status: ", status);
            const numChangedFiles = status.changed.length;
            const formatMessage = message ?? await this.formatCommitMessage(this.plugin.settings.commitMessage);
            await git.commit({ ...this.repo, message: formatMessage });
            return numChangedFiles;
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async stage(filepath: string): Promise<void> {
        try {
            this.plugin.setState(PluginState.add);
            await git.add({ ...this.repo, filepath: filepath });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async stageAll(): Promise<void> {
        try {
            // Add all files while respecting .gitignore
            await this.stage(".");
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async unstage(filepath: string): Promise<void> {
        try {
            this.plugin.setState(PluginState.add);
            await git.resetIndex({ ...this.repo, filepath: filepath });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async unstageAll(): Promise<void> {
        try {
            const changed = this.plugin.cachedStatus.staged;
            for (const file of changed) {
                await this.unstage(file.path);
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async discard(filepath: string): Promise<void> {
        try {
            this.plugin.setState(PluginState.add);
            await git.checkout({ ...this.repo, filepaths: [filepath] });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async pull(): Promise<number> {
        try {
            this.plugin.setState(PluginState.pull);
            // TODO: Submodules
            const progressNotice = new Notice("Initializing clone", this.noticeLength);
            await git.pull({
                ...this.repo,
                onProgress: (progress) => {
                    (progressNotice as any).noticeEl.innerText = `Pulling progress: ${progress.phase}: ${progress.loaded} of ${progress.total}`;
                }
            });
            progressNotice.hide();
            this.plugin.lastUpdate = Date.now();
            // TODO: Not a native command in isomorphic-git to get number of
            // changed files, but we could do a diff between latest commit
            // before and after pull using this snippet: 
            // https://isomorphic-git.org/docs/en/snippets#git-diff---name-status-commithash1-commithash2
            return 1;
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async push(): Promise<number> {
        try {
            this.plugin.setState(PluginState.status);
            const status = await this.status();
            const numChangedFiles = status.changed.length;
            console.log("Changed files: ", status.changed);

            this.plugin.setState(PluginState.push);
            // TODO: Submodules support
            // TODO: Maybe an onProgress here too?
            await git.push({
                ...this.repo,
                force: true
            });
            return numChangedFiles;
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async canPush(): Promise<boolean> {
        // TODO: Submodules support
        return true;
    }

    async checkRequirements(): Promise<'valid' | 'missing-repo' | 'missing-git'> {
        // TODO: I think the user doesn't have to install git themselves with
        // isomorphic-git so remove "missing-git"?
        try {
            await git.listBranches(this.repo);
        } catch (error) {
            return "missing-repo";
        }
        return "valid";
    }

    async branchInfo(): Promise<BranchInfo> {
        try {
            const current = await git.currentBranch(this.repo) || "";

            const branches = await git.listBranches(this.repo);

            const remote = await git.getConfig({
                ...this.repo,
                path: `branch.${current}.remote`
            }) ?? "origin";

            const trackingBranch = (await git.getConfig({
                ...this.repo,
                path: `branch.${current}.merge`
            }))?.split("refs/heads")[1];


            let tracking = trackingBranch ? remote + trackingBranch : undefined;

            return {
                current: current,
                tracking: tracking,
                branches: branches,
            };
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async checkout(branch: string): Promise<void> {
        try {
            return git.checkout({
                ...this.repo,
                ref: branch,
            });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async init(): Promise<void> {
        try {
            await git.init(this.repo);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async clone(url: string, dir: string): Promise<void> {
        try {
            // TODO: onProgress
            await git.clone({
                ...this.repo,
                url: url
            });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async setConfig(path: string, value: any): Promise<void> {
        try {
            return git.setConfig({
                ...this.repo,
                path: path,
                value: value
            });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    };

    async getConfig(path: string): Promise<any> {
        try {
            return git.getConfig({
                ...this.repo,
                path: path
            });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    };

    async fetch(remote?: string): Promise<void> {
        // TODO: onProgress
        try {
            const args = {
                ...this.repo
            };
            if (remote) { args.remoteRef = remote; }
            await git.fetch(args);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async setRemote(name: string, url: string): Promise<void> {
        try {
            await git.addRemote({ ...this.repo, remote: name, url: url });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async getRemoteBranches(remote: string): Promise<string[]> {
        const remotes = this.getRemotes();
        const remoteBranches = [];
        for (var remote_ in remotes) {
            remoteBranches.push(...await git.listBranches({ ...this.repo, remote: remote_ }));
        }
        return remoteBranches.filter(branch => branch.includes(remote));
    }

    async getRemotes(): Promise<string[]> {
        return (await git.listRemotes({ ...this.repo })).map(remoteUrl => remoteUrl.remote);
    }

    async removeRemote(remoteName: string): Promise<void> {
        await git.deleteRemote({ ...this.repo, remote: remoteName });
    }

    async updateUpstreamBranch(remoteBranch: string): Promise<void> {
        const [remote, branch] = remoteBranch.split("/");
        await git.push({
            ...this.repo,
            remote: remote, remoteRef: branch
        });
    }

    updateGitPath(gitPath: string): void {
        // isomorphic-git library has its own git client
        return;
    }

    async getDiffString(filePath: string): Promise<string> {
        throw "Not Implemented!";
    }

    private getFileStatusResult(row: [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3]): FileStatusResult {
        try {
            const status = (this.status_mapping as any)[`${row[this.HEAD]}${row[this.WORKDIR]}${row[this.STAGE]}`];
            // status will always be two characters
            return {
                index: status[0],
                working_dir: status[1],
                path: row[this.FILE],
                vault_path: this.getVaultPath(row[this.FILE])
            };
        } catch (error) {
            console.log("Status: ", String(status));
            console.log("row: ", row);
        }
    };
}

// All because we can't use (for await)...

// Convert a value to an Async Iterator
// This will be easier with async generator functions.
function fromValue(value) {
    let queue = [value];
    return {
        next() {
            return Promise.resolve({ done: queue.length === 0, value: queue.pop() });
        },
        return() {
            queue = [];
            return {};
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}

function getIterator(iterable) {
    if (iterable[Symbol.asyncIterator]) {
        return iterable[Symbol.asyncIterator]();
    }
    if (iterable[Symbol.iterator]) {
        return iterable[Symbol.iterator]();
    }
    if (iterable.next) {
        return iterable;
    }
    return fromValue(iterable);
}

async function forAwait(iterable, cb) {
    const iter = getIterator(iterable);
    while (true) {
        const { value, done } = await iter.next();
        if (value) await cb(value);
        if (done) break;
    }
    if (iter.return) iter.return();
}

async function collect(iterable: AsyncIterator<Uint8Array>) {
    let size = 0;
    const buffers = [];
    // This will be easier once `for await ... of` loops are available.
    await forAwait(iterable, value => {
        buffers.push(value);
        size += value.byteLength;
    });
    const result = new Uint8Array(size);
    let nextIndex = 0;
    for (const buffer of buffers) {
        result.set(buffer, nextIndex);
        nextIndex += buffer.byteLength;
    }
    return result;
}
