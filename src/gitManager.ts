import { App } from "obsidian";
import ObsidianGit from "./main";
import { BranchInfo, FileStatusResult, Status, TreeItem, UnstagedFile } from "./types";


export abstract class GitManager {
    readonly plugin: ObsidianGit;
    readonly app: App;
    constructor(plugin: ObsidianGit) {
        this.plugin = plugin;
        this.app = plugin.app;
    }

    abstract status(): Promise<Status>;

    abstract commitAll(_: { message: string, status?: Status, unstagedFiles?: UnstagedFile[]; }): Promise<number | undefined>;

    abstract commit(message?: string): Promise<number | undefined>;

    abstract stageAll(_: { dir?: string, status?: Status; }): Promise<void>;

    abstract unstageAll(_: { dir?: string, status?: Status; }): Promise<void>;

    abstract stage(filepath: string, relativeToVault: boolean): Promise<void>;

    abstract unstage(filepath: string, relativeToVault: boolean): Promise<void>;

    abstract discard(filepath: string): Promise<void>;

    abstract pull(): Promise<FileStatusResult[] | undefined>;

    abstract push(): Promise<number>;

    abstract canPush(): Promise<boolean>;

    abstract checkRequirements(): Promise<"valid" | "missing-repo" | "missing-git">;

    abstract branchInfo(): Promise<BranchInfo>;

    abstract checkout(branch: string): Promise<void>;

    abstract createBranch(branch: string): Promise<void>;

    abstract deleteBranch(branch: string, force: boolean): Promise<void>;

    abstract branchIsMerged(branch: string): Promise<boolean>;

    abstract init(): Promise<void>;

    abstract clone(url: string, dir: string): Promise<void>;

    abstract setConfig(path: string, value: string | number | boolean): Promise<void>;

    abstract getConfig(path: string): Promise<any>;

    abstract fetch(remote?: string): Promise<void>;

    abstract setRemote(name: string, url: string): Promise<void>;

    abstract getRemotes(): Promise<string[]>;

    abstract getRemoteUrl(remote: string): Promise<string | undefined>;

    abstract getRemoteBranches(remote: string): Promise<string[]>;

    abstract removeRemote(remoteName: string): Promise<void>;

    abstract updateUpstreamBranch(remoteBranch: string): Promise<void>;

    abstract updateGitPath(gitPath: string): void;

    abstract updateBasePath(basePath: string): void;

    abstract getDiffString(filePath: string, stagedChanges: boolean): Promise<string>;


    getVaultPath(path: string): string {
        if (this.plugin.settings.basePath) {
            return this.plugin.settings.basePath + "/" + path;
        } else {
            return path;
        }
    }

    getPath(path: string, relativeToVault: boolean): string {
        return (relativeToVault && this.plugin.settings.basePath.length > 0) ? path.substring(this.plugin.settings.basePath.length + 1) : path;
    }

    private _getTreeStructure(children: FileStatusResult[], beginLength = 0): TreeItem[] {
        const list: TreeItem[] = [];
        children = [...children];
        while (children.length > 0) {
            const first = children.first()!;
            const restPath = first.path.substring(beginLength);
            if (restPath.contains("/")) {
                const title = restPath.substring(0, restPath.indexOf("/"));
                const childrenWithSameTitle = children.filter((item) => {
                    return item.path.substring(beginLength).startsWith(title + "/");
                });
                childrenWithSameTitle.forEach((item) => children.remove(item));
                list.push({
                    title: title,
                    path: first.path.substring(0, restPath.indexOf("/") + beginLength),
                    children: this._getTreeStructure(childrenWithSameTitle, (beginLength > 0 ? (beginLength + title.length) : title.length) + 1)
                });
            } else {
                list.push({ title: restPath, statusResult: first, path: first.path });
                children.remove(first);
            }
        }
        return list;
    }

    /*
    * Sorts the children and simplifies the title
    * If a node only contains another subdirectory, that subdirectory is moved up one level and integrated into the parent node
    */
    private simplify(tree: TreeItem[]): TreeItem[] {
        for (const node of tree) {
            const singleChild = node.children?.length == 1;
            const singleChildIsDir = node.children?.first()?.statusResult == undefined;
            if (node.children != undefined && singleChild && singleChildIsDir) {
                node.title += "/" + node.children.first()!.title;
                node.path = node.children.first()!.path;
                node.children = node.children.first()!.children;
            } else if (node.children != undefined) {
                this.simplify(node.children);
            }
            node.children?.sort((a, b) => {
                const dirCompare = (b.statusResult == undefined ? 1 : 0) - (a.statusResult == undefined ? 1 : 0);
                if (dirCompare != 0) {
                    return dirCompare;
                } else {
                    return a.title.localeCompare(b.title);
                }
            });
        }
        return tree.sort((a, b) => {
            const dirCompare = (b.statusResult == undefined ? 1 : 0) - (a.statusResult == undefined ? 1 : 0);
            if (dirCompare != 0) {
                return dirCompare;
            } else {
                return a.title.localeCompare(b.title);
            }
        });
    }

    getTreeStructure(children: FileStatusResult[]): TreeItem[] {
        const tree = this._getTreeStructure(children);

        const res = this.simplify(tree);
        return res;
    }

    async formatCommitMessage(template: string): Promise<string> {
        let status: Status | undefined;
        if (template.includes("{{numFiles}}")) {
            status = await this.status();
            const numFiles = status.staged.length;
            template = template.replace("{{numFiles}}", String(numFiles));
        }
        if (template.includes("{{hostname}}")) {
            const hostname = this.plugin.localStorage.getHostname() || "";
            template = template.replace("{{hostname}}", hostname);
        }

        if (template.includes("{{files}}")) {
            status = status ?? await this.status();

            const changeset: { [key: string]: string[]; } = {};
            status.staged.forEach((value: FileStatusResult) => {
                if (value.index in changeset) {
                    changeset[value.index].push(value.path);
                } else {
                    changeset[value.index] = [value.path];
                }
            });

            const chunks = [];
            for (const [action, files] of Object.entries(changeset)) {
                chunks.push(action + " " + files.join(" "));
            }

            const files = chunks.join(", ");

            template = template.replace("{{files}}", files);
        }

        const moment = (window as any).moment;
        template = template.replace(
            "{{date}}",
            moment().format(this.plugin.settings.commitDateFormat)
        );
        if (this.plugin.settings.listChangedFilesInMessageBody) {
            template = template + "\n\n" + "Affected files:" + "\n" + (status ?? await this.status()).staged.map((e) => e.path).join("\n");
        }
        return template;
    }
}
