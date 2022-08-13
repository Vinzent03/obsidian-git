import git, { AuthCallback, Errors, GitHttpRequest, GitHttpResponse, GitProgressEvent, HttpClient } from "isomorphic-git";
import { Notice, requestUrl } from 'obsidian';
import { GitManager } from "./gitManager";
import ObsidianGit from './main';
import { MyAdapter } from './myAdapter';
import { BranchInfo, FileStatusResult, PluginState, Status } from "./types";


export class IsomorphicGit extends GitManager {
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
    private readonly fs = new MyAdapter(this.app.vault);

    constructor(plugin: ObsidianGit) {
        super(plugin);
    }

    getRepo(): {
        fs: MyAdapter,
        dir: string,
        onAuth: AuthCallback,
        http: HttpClient,
    } {
        return {
            fs: this.fs,
            dir: this.plugin.settings.basePath,
            onAuth: () => {
                return {
                    username: this.plugin.settings.username,
                    password: localStorage.getItem(this.plugin.manifest.id + ":password")
                };
            },
            http: {
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

                    const res = await requestUrl({ url, method, headers, body, throw: false });
                    return {
                        url,
                        method,
                        headers: res.headers,
                        body: [new Uint8Array(res.arrayBuffer)],
                        statusCode: res.status,
                        statusMessage: res.text,
                    };


                }
            },
        };
    }

    async status(): Promise<Status> {
        try {
            this.plugin.setState(PluginState.status);
            const status = (await git.statusMatrix(this.getRepo())).map(row => this.getFileStatusResult(row));

            const changed = status.filter(fileStatus => fileStatus.working_dir !== " ");
            const staged = status.filter(fileStatus => fileStatus.index !== " " && fileStatus.index !== "U");
            // TODO: How to determine merge conflicts with isomorphic-git?
            const conflicted: string[] = [];
            return { changed, staged, conflicted };
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    };

    async commitAll(message?: string): Promise<number> {
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
            const formatMessage = await this.formatCommitMessage(message);
            const hadConflict = localStorage.getItem(this.plugin.manifest.id + ":conflict") === "true";
            let parent: string[] = undefined;

            if (hadConflict) {
                const branchInfo = await this.branchInfo();
                parent = [branchInfo.current, branchInfo.tracking];
            }

            await git.commit({
                ...this.getRepo(),
                message: formatMessage,
                parent: parent,
            });
            localStorage.setItem(this.plugin.manifest.id + ":conflict", "false");

            return numChangedFiles;
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async stage(filepath: string): Promise<void> {
        try {
            this.plugin.setState(PluginState.add);
            if (await this.app.vault.adapter.exists(filepath)) {
                await git.add({ ...this.getRepo(), filepath: filepath });
            } else {
                await git.remove({ ...this.getRepo(), filepath: filepath });
            }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async stageAll(): Promise<void> {
        try {
            const status = await git.statusMatrix(this.getRepo());
            await Promise.all(
                status.map(([filepath, , worktreeStatus]) =>
                    worktreeStatus ? git.add({ ...this.getRepo(), filepath }) : git.remove({ ...this.getRepo(), filepath })
                ));

        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async unstage(filepath: string): Promise<void> {
        try {
            this.plugin.setState(PluginState.add);
            await git.resetIndex({ ...this.getRepo(), filepath: filepath });
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
            await git.checkout({ ...this.getRepo(), filepaths: [filepath], force: true });
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
        try {
            this.plugin.setState(PluginState.pull);

            const localCommit = await git.resolveRef({ ...this.getRepo(), ref: "HEAD" });
            await this.fetch();
            const branchInfo = await this.branchInfo();

            await git.merge({
                ...this.getRepo(),
                ours: localCommit,
                theirs: branchInfo.tracking,
                abortOnConflict: false,
            });
            const upstreamCommit = await git.resolveRef({ ...this.getRepo(), ref: "HEAD" });
            this.plugin.lastUpdate = Date.now();
            return await this.getFileChangesCount(localCommit, upstreamCommit);
        } catch (error) {
            if (error instanceof Errors.MergeConflictError) {
                this.plugin.handleConflict(error.data.filepaths.map((file) => this.getVaultPath(file)));
                console.log(error.data);
            }

            this.plugin.displayError(error);
            throw error;
        }
    }

    async push(): Promise<number> {
        const progressNotice = new Notice("Initializing push", this.noticeLength);
        if (! await this.canPush()) {
            return 0;
        }
        try {
            this.plugin.setState(PluginState.status);
            const status = await this.branchInfo();
            const trackingBranch = status.tracking;
            const currentBranch = status.current;
            const numChangedFiles = await this.getFileChangesCount(currentBranch, trackingBranch);

            this.plugin.setState(PluginState.push);

            await git.push({
                ...this.getRepo(),
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
        const status = await this.branchInfo();
        const trackingBranch = status.tracking;
        const currentBranch = status.current;

        const current = await git.resolveRef({ ...this.getRepo(), ref: currentBranch });
        const tracking = await git.resolveRef({ ...this.getRepo(), ref: trackingBranch });

        return current != tracking;
    }

    async checkRequirements(): Promise<'valid' | 'missing-repo'> {

        const headExists = await this.plugin.app.vault.adapter.exists(`${this.getRepo().dir}/.git/HEAD`);

        return headExists ? 'valid' : 'missing-repo';
    }

    async branchInfo(): Promise<BranchInfo> {
        try {
            const current = await git.currentBranch(this.getRepo()) || "";

            const branches = await git.listBranches(this.getRepo());

            const remote = await git.getConfig({
                ...this.getRepo(),
                path: `branch.${current}.remote`
            }) ?? "origin";

            const trackingBranch = (await git.getConfig({
                ...this.getRepo(),
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

    async getCurrentRemote(): Promise<string> {
        const current = await git.currentBranch(this.getRepo()) || "";


        const remote = await git.getConfig({
            ...this.getRepo(),
            path: `branch.${current}.remote`
        }) ?? "origin";
        return remote;

    }

    async checkout(branch: string): Promise<void> {
        try {
            return git.checkout({
                ...this.getRepo(),
                ref: branch,
            });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async init(): Promise<void> {
        try {
            await git.init(this.getRepo());
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async clone(url: string, dir: string): Promise<void> {
        const progressNotice = new Notice("Initializing clone", this.noticeLength);
        try {
            await git.clone({
                ...this.getRepo(),
                dir: dir,
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
                ...this.getRepo(),
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
                ...this.getRepo(),
                path: path
            });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    };

    async fetch(remote?: string): Promise<void> {
        const progressNotice = new Notice("Initializing fetch", this.noticeLength);

        try {
            const args: any = {
                ...this.getRepo(),
                onProgress: (progress: GitProgressEvent) => {
                    (progressNotice as any).noticeEl.innerText = this.getProgressText("Fetching", progress);
                },
                remote: remote ?? await this.getCurrentRemote()
            };

            await git.fetch(args);
            progressNotice.hide();
        } catch (error) {
            this.plugin.displayError(error);
            progressNotice.hide();
            throw error;
        }
    }

    async setRemote(name: string, url: string): Promise<void> {
        try {
            await git.addRemote({ ...this.getRepo(), remote: name, url: url });
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async getRemoteBranches(remote: string): Promise<string[]> {
        let remoteBranches = [];
        remoteBranches.push(...await git.listBranches({ ...this.getRepo(), remote: remote }));

        remoteBranches.remove("HEAD");

        //Align with simple-git
        remoteBranches = remoteBranches.map((e) => `${remote}/${e}`);
        return remoteBranches;
    }

    async getRemotes(): Promise<string[]> {
        return (await git.listRemotes({ ...this.getRepo() })).map(remoteUrl => remoteUrl.remote);
    }

    async removeRemote(remoteName: string): Promise<void> {
        await git.deleteRemote({ ...this.getRepo(), remote: remoteName });
    }

    async getRemoteUrl(remote: string): Promise<string> {
        return (await git.listRemotes({ ...this.getRepo() })).filter((item) => item.remote == remote)[0].url;
    }

    updateBasePath(basePath: string): void {
        this.getRepo().dir = basePath;
    }

    async updateUpstreamBranch(remoteBranch: string): Promise<void> {
        const [remote, branch] = remoteBranch.split("/");
        const branchInfo = await this.branchInfo();

        await git.setConfig({
            ...this.getRepo(),
            path: `branch.${branchInfo.current}.merge`,
            value: `refs/heads/${branch}`
        });
        await git.setConfig({
            ...this.getRepo(),
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
            ...this.getRepo(),
            trees: [git.TREE({ ref: commitHash1 }), git.TREE({ ref: commitHash2 })],
            map: async function (filepath, [A, B]) {
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
