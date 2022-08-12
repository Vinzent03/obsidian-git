// TODO: Use different FS for mobile, maybe custom one?
import git, { AuthCallback, GitHttpRequest, GitHttpResponse, GitProgressEvent, HttpClient } from "isomorphic-git";
import { Notice, requestUrl } from 'obsidian';


import { GitManager } from "./gitManager";
import ObsidianGit from './main';
import { MyAdapter } from './myAdapter';
import { Author, BranchInfo, FileStatusResult, PluginState, Status } from "./types";

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
    private repo: {
        fs: MyAdapter,
        dir: string,
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
            dir: plugin.settings.basePath,
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
            const staged = status.filter(fileStatus => fileStatus.index !== " " && fileStatus.index !== "U");
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
            const numChangedFiles = status.staged.length;
            const formatMessage = message ?? await this.formatCommitMessage(this.plugin.settings.commitMessage);
            await git.commit({
                ...this.repo,
                message: formatMessage,
                author: this.getAuthor()
            });
            return numChangedFiles;
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    getAuthor(): Author {
        return {
            name: this.plugin.settings.username,
            email: this.plugin.settings.email
        };
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
            await git.checkout({ ...this.repo, filepaths: [filepath], force: true });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    getProgressText(action: string, event: GitProgressEvent): string {
        let out = `${action} progress:`;
        if (event.phase) {
            out = `${out} ${event.phase}:`;
        }
        if (event.loaded) {
            out = `${out} ${event.loaded}`;
            if (event.total) {
                out = `${out} of ${event.total}`;
            }
        }
        return out;
    }

    async pull(): Promise<number> {
        const progressNotice = new Notice("Initializing pull", this.noticeLength);

        try {
            this.plugin.setState(PluginState.pull);

            const localCommit = await git.resolveRef({ ...this.repo, ref: "HEAD" });

            //TODO: Split into fetch and merge to have more control over merge conflicts
            await git.pull({
                ...this.repo,
                author: this.getAuthor(),
                onProgress: (progress) => {
                    (progressNotice as any).noticeEl.innerText = this.getProgressText("Pulling", progress);
                },
            });
            progressNotice.hide();
            const upstreamCommit = await git.resolveRef({ ...this.repo, ref: "HEAD" });
            this.plugin.lastUpdate = Date.now();
            return await this.getFileChangesCount(localCommit, upstreamCommit);
        } catch (error) {
            progressNotice.hide();
            this.plugin.displayError(error);
            throw error;
        }
    }

    async push(): Promise<number> {
        const progressNotice = new Notice("Initializing push", this.noticeLength);

        try {
            this.plugin.setState(PluginState.status);
            const status = await this.branchInfo();
            const trackingBranch = status.tracking;
            const currentBranch = status.current;
            const numChangedFiles = await this.getFileChangesCount(currentBranch, trackingBranch);

            this.plugin.setState(PluginState.push);

            await git.push({
                ...this.repo,
                onProgress: (progress) => {
                    (progressNotice as any).noticeEl.innerText = this.getProgressText("Pushing", progress);
                }
            });
            progressNotice.hide();
            return numChangedFiles;
        } catch (error) {
            progressNotice.hide();
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
        const progressNotice = new Notice("Initializing clone", this.noticeLength);
        try {
            await git.clone({
                ...this.repo,
                url: url,
                onProgress: (progress) => {
                    (progressNotice as any).noticeEl.innerText = this.getProgressText("Cloning", progress);
                }
            });
            progressNotice.hide();
        } catch (error) {
            progressNotice.hide();
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
            const args: any = {
                ...this.repo
            };
            if (remote) {
                args.remote = remote;
            }
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
        let remoteBranches = [];
        remoteBranches.push(...await git.listBranches({ ...this.repo, remote: remote }));

        remoteBranches.remove("HEAD");

        //Align with simple-git
        remoteBranches = remoteBranches.map((e) => `${remote}/${e}`);
        return remoteBranches;
    }

    async getRemotes(): Promise<string[]> {
        return (await git.listRemotes({ ...this.repo })).map(remoteUrl => remoteUrl.remote);
    }

    async removeRemote(remoteName: string): Promise<void> {
        await git.deleteRemote({ ...this.repo, remote: remoteName });
    }

    async getRemoteUrl(remote: string): Promise<string> {
        return (await git.listRemotes({ ...this.repo })).filter((item) => item.remote == remote)[0].url;
    }

    updateBasePath(basePath: string): void {
        this.repo.dir = basePath;
    }

    async updateUpstreamBranch(remoteBranch: string): Promise<void> {
        const [remote, branch] = remoteBranch.split("/");
        const branchInfo = await this.branchInfo();

        await git.setConfig({
            ...this.repo,
            path: `branch.${branchInfo.current}.merge`,
            value: `refs/heads/${branch}`
        });
        await git.setConfig({
            ...this.repo,
            path: `branch.${branch}.remote`,
            value: remote
        });
    }

    updateGitPath(gitPath: string): void {
        // isomorphic-git library has its own git client
        return;
    }

    async getFileChangesCount(commitHash1: string, commitHash2: string): Promise<number> {
        const res = await git.walk({
            ...this.repo,
            trees: [git.TREE({ ref: commitHash1 }), git.TREE({ ref: commitHash2 })],
            map: async function (filepath, [A, B]) {
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
                if (type === 'equal') {
                    return;
                }
                return {
                    path: `/${filepath}`,
                    type: type,
                };
            },
        });
        return res.length;
    }

    async getDiffString(filePath: string): Promise<string> {
        throw new Error("Method not implemented.");
    };

    private getFileStatusResult(row: [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3]): FileStatusResult {

        const status = (this.status_mapping as any)[`${row[this.HEAD]}${row[this.WORKDIR]}${row[this.STAGE]}`];
        // status will always be two characters
        return {
            index: status[0] == "?" ? "U" : status[0],
            working_dir: status[1] == "?" ? "U" : status[1],
            path: row[this.FILE],
            vault_path: this.getVaultPath(row[this.FILE])
        };

    };
}

// All because we can't use (for await)...

// Convert a value to an Async Iterator
// This will be easier with async generator functions.
function fromValue(value: any) {
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

function getIterator(iterable: any) {
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

async function forAwait(iterable: any, cb: any) {
    const iter = getIterator(iterable);
    while (true) {
        const { value, done } = await iter.next();
        if (value) await cb(value);
        if (done) break;
    }
    if (iter.return) iter.return();
}

async function collect(iterable: any): Promise<Uint8Array> {
    let size = 0;
    const buffers: Uint8Array[] = [];
    // This will be easier once `for await ... of` loops are available.
    await forAwait(iterable, (value: any) => {
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
