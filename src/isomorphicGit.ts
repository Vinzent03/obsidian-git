// TODO: Use different FS for mobile, maybe custom one?
import git from "isomorphic-git";
// TODO: Use Obsidian's HTTP to bypass CORS
import http from "isomorphic-git/http/web";
import { Notice, request } from 'obsidian';


import ObsidianGit from './main';
import { GitManager } from "./gitManager";
import { MyAdapter } from './myAdapter';
import { BranchInfo, FileStatusResult, PluginState, Status } from "./types";

// TODO: Set to idle, what's a nice way to do this...
// TODO: Nicer way to display error... I'm doing it multiple times if I call other
// helpers...
// TODO: Is there a style setup, like ESLint or Prettier?

// const myHTTP = {
//     async request({
//         url,
//         method,
//         headers,
//         body,
//     }: { url: string, method?: string, headers?: object, body: any, }) {
//         console.log("In request(): ", { url, method, headers, body })
//         if (method == undefined) {
//             method = "GET";
//         }
//         console.log("In request(), after fixing: ", { url, method, headers, body })


//         const res = await request({ url, method, headers, body })
//         console.log("HEY HERE's RES: ", res)

//         return {
//             url,
//             method,
//             headers,
//             body: res,
//             statusCode: 200,
//             statusMessage: "No idea if it succeeded..."
//         }

//     }
// }

const myHTTP = {
    async request({
        url,
        method,
        headers,
        body,
    }) {
        console.log("again")
        console.log({ url, method, headers, body })
        const res = await http.request({ url, method, headers, body })
        // return res
        console.log("ORIGINAL BODY: ", body)
        console.log("RETURNED BODY: ", res.body)
        console.log("STATUS MESSAGE: ", res.statusMessage)
        return { url, method, headers, body: res.body, statusCode: 200, statusMessage: "OK" }
    }
}
export class IsomorphicGit extends GitManager {
    private repo: {
        fs: MyAdapter,
        dir: string
    }
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
            onAuth: () => ({ username: "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" })
        };
    }

    async status(): Promise<Status> {
        try {
            this.plugin.setState(PluginState.status)
            const status = (await git.statusMatrix(this.repo)).map(row => this.getFileStatusResult(row));

            const changed = status.filter(fileStatus => fileStatus.working_dir !== " ")
            const staged = status.filter(fileStatus => fileStatus.index !== " " && fileStatus.index !== "?")
            // TODO: How to determine merge conflicts with isomorphic-git?
            const conflicted: FileStatusResult[] = []
            return { changed, staged, conflicted }
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    };

    async commitAll(message?: string): Promise<number> {
        // TODO: Submodules support
        try {
            await this.stageAll()
            return this.commit(message)
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async commit(message?: string): Promise<number> {
        try {
            this.plugin.setState(PluginState.commit)
            const status = await this.status()
            console.log("This is status: ", status)
            const numChangedFiles = status.changed.length
            const formatMessage = message ?? await this.formatCommitMessage();
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
            await git.add({ ...this.repo, filepath: filepath })
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
            this.plugin.setState(PluginState.add)
            await git.resetIndex({ ...this.repo, filepath: filepath })
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async unstageAll(): Promise<void> {
        try {
            // Unstage all files
            await this.unstage(".")
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async discard(filepath: string): Promise<void> {
        try {
            this.plugin.setState(PluginState.add)
            await git.checkout({ ...this.repo, filepaths: [filepath] })
        } catch (error) {
            this.plugin.displayError(error)
            throw error
        }
    }

    async pull(): Promise<void> {
        try {
            this.plugin.setState(PluginState.pull)
            // TODO: Submodules
            const progressNotice = new Notice("Initializing clone", this.noticeLength);
            await git.pull({
                ...this.repo, http: myHTTP,
                headers: this.getAuth(),
                onProgress: (progress) => {
                    (progressNotice as any).noticeEl.innerText = `Cloning progress: ${progress.phase}: ${progress.loaded} of ${progress.total}`;
                }
            })
            progressNotice.hide()
            this.plugin.lastUpdate = Date.now()
        } catch (error) {
            this.plugin.displayError(error)
            throw error
        }
    }

    async push(): Promise<number> {
        try {
            this.plugin.setState(PluginState.status)
            const status = await this.status()
            const numChangedFiles = status.changed.length
            console.log("Changed files: ", status.changed)

            this.plugin.setState(PluginState.push)
            // TODO: Submodules support
            // TODO: Maybe an onProgress here too?
            await git.push({
                ...this.repo, http: myHTTP,
                headers: this.getAuth(),
                force: true
            })
            return numChangedFiles
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
            await git.listBranches(this.repo)
        } catch (error) {
            return "missing-repo"
        }
        return "valid"
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
                ...this.repo, http: myHTTP,
                headers: this.getAuth(),
                url: url
            })
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
                ...this.repo, http: myHTTP,
                headers: this.getAuth(),
            }
            if (remote) { args.remoteRef = remote }
            await git.fetch(args);
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async setRemote(name: string, url: string): Promise<void> {
        try {
            await git.addRemote({ ...this.repo, remote: name, url: url })
        } catch (error) {
            this.plugin.displayError(error);
            throw error;
        }
    }

    async getRemoteBranches(remote: string): Promise<string[]> {
        const remotes = this.getRemotes();
        const remoteBranches = [];
        for (var remote_ in remotes) {
            remoteBranches.push(...await git.listBranches({ ...this.repo, remote: remote_ }))
        }
        return remoteBranches.filter(branch => branch.includes(remote))
    }

    async getRemotes(): Promise<string[]> {
        return (await git.listRemotes({ ...this.repo })).map(remoteUrl => remoteUrl.remote)
    }

    async removeRemote(remoteName: string): Promise<void> {
        await git.deleteRemote({ ...this.repo, remote: remoteName })
    }

    async updateUpstreamBranch(remoteBranch: string): Promise<void> {
        const [remote, branch] = remoteBranch.split("/")
        await git.push({
            ...this.repo, http: myHTTP,
            headers: this.getAuth(),
            remote: remote, remoteRef: branch
        })
    }

    updateGitPath(gitPath: string): void {
        // isomorphic-git library has its own git client
        return
    }

    private getFileStatusResult(row: [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3]): FileStatusResult {
        try {
            const status = (this.status_mapping as any)[`${row[this.HEAD]}${row[this.WORKDIR]}${row[this.STAGE]}`];
            // status will always be two characters
            return { index: status[0], working_dir: status[1], path: row[this.FILE] };
        } catch (error) {
            console.log("Status: ", String(status))
            console.log("row: ", row)
        }
    };

    private getAuth() {
        // const username = window.localStorage.getItem(this.plugin.manifest.id + ":username");
        // const password = window.localStorage.getItem(this.plugin.manifest.id + ":password");
        const username = "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"
        const auth = "Basic " + btoa(username);
        return {
            Authorization: auth,
            accept: "application/x-git-upload-pack-result",
            "content-type": "application/x-git-upload-pack-request"
        }
    }
}