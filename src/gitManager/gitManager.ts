import { hostname as osHostname } from "os";
import { type App, moment, Platform } from "obsidian";
import type ObsidianGit from "../main";
import { GitOperation } from "../types";
import type {
    BranchInfo,
    DiffFile,
    FileStatusResult,
    LogEntry,
    PullResult,
    PushResult,
    Status,
    TreeItem,
    UnstagedFile,
} from "../types";

export abstract class GitManager {
    readonly plugin: ObsidianGit;
    readonly app: App;
    constructor(plugin: ObsidianGit) {
        this.plugin = plugin;
        this.app = plugin.app;
    }

    protected async withGitOperation<T>(
        operation: GitOperation,
        fn: () => Promise<T>
    ): Promise<T> {
        this.plugin.setPluginState({ operation });
        try {
            return await fn();
        } finally {
            this.plugin.statusBar?.clearProgress(false);
            this.plugin.setPluginState({ operation: GitOperation.idle });
        }
    }

    abstract status(opts?: { path?: string }): Promise<Status>;

    abstract isMergeInProgress(): Promise<boolean>;

    abstract commitAll(_: {
        message: string;
        status?: Status;
        unstagedFiles?: UnstagedFile[];
        amend?: boolean;
    }): Promise<number>;

    abstract commit(_: { message: string; amend?: boolean }): Promise<number>;

    abstract stageAll(_: { dir?: string; status?: Status }): Promise<void>;

    abstract unstageAll(_: { dir?: string; status?: Status }): Promise<void>;

    abstract stage(filepath: string, relativeToVault: boolean): Promise<void>;

    abstract unstage(filepath: string, relativeToVault: boolean): Promise<void>;

    abstract discard(filepath: string): Promise<void>;

    abstract discardAll(_: { dir?: string; status?: Status }): Promise<void>;

    /**
     * Use this method instead of {@link GitManager.status} to delete untracked files, becase on native git
     * directories which only contain untracked files will only be listed by their directory name e.g. `thedir/` and not every file individually.
     * This allows for more efficient deletion of untracked files.
     *
     * @param path - The path to the directory to get untracked paths in. If not specified, the whole repository is used.
     */
    abstract getUntrackedPaths(opts?: {
        path?: string;
        status?: Status;
    }): Promise<string[]>;

    abstract pull(): Promise<PullResult>;

    abstract push(): Promise<PushResult>;

    abstract getUnpushedCommits(): Promise<number>;

    abstract canPush(): Promise<boolean>;

    abstract checkRequirements(): Promise<
        "valid" | "missing-repo" | "missing-git"
    >;

    abstract branchInfo(): Promise<BranchInfo>;

    abstract checkout(branch: string, remote?: string): Promise<void>;

    abstract createBranch(branch: string): Promise<void>;

    abstract deleteBranch(branch: string, force: boolean): Promise<void>;

    abstract branchIsMerged(branch: string): Promise<boolean>;

    abstract init(): Promise<void>;

    abstract clone(url: string, dir: string, depth?: number): Promise<void>;

    abstract setConfig(
        path: string,
        value: string | number | boolean | undefined
    ): Promise<void>;

    abstract getConfig(
        path: string,
        scope?: string
    ): Promise<string | undefined>;

    abstract fetch(remote?: string): Promise<void>;

    abstract setRemote(name: string, url: string): Promise<void>;

    abstract getRemotes(): Promise<string[]>;

    abstract getRemoteUrl(remote: string): Promise<string | undefined>;

    abstract log(
        file: string | undefined,
        relativeToVault?: boolean,
        limit?: number,
        ref?: string
    ): Promise<LogEntry[]>;

    abstract getRemoteBranches(remote: string): Promise<string[]>;

    abstract removeRemote(remoteName: string): Promise<void>;

    abstract updateUpstreamBranch(remoteBranch: string): Promise<void>;

    abstract updateGitPath(gitPath: string): Promise<void>;

    abstract updateBasePath(basePath: string): Promise<void>;

    abstract getDiffString(
        filePath: string,
        stagedChanges: boolean,
        hash?: string
    ): Promise<string>;

    abstract show(
        commitHash: string,
        file: string,
        relativeToVault?: boolean
    ): Promise<string>;

    abstract getLastCommitTime(): Promise<Date | undefined>;

    // Constructs a path relative to the vault from a path relative to the git repository
    getRelativeVaultPath(path: string): string {
        if (this.plugin.settings.basePath) {
            if (path === "" || path === ".") {
                return this.plugin.settings.basePath;
            }
            return this.plugin.settings.basePath + "/" + path;
        } else {
            return path;
        }
    }

    // Constructs a path relative to the git repository from a path relative to the vault
    //
    // @param doConversion - If false, the path is returned as is. This is added because that parameter is often passed on to functions where this method is called.
    getRelativeRepoPath(
        filePath: string,
        doConversion: boolean = true
    ): string {
        if (doConversion) {
            const basePath = this.plugin.settings.basePath;
            if (basePath && basePath.length > 0) {
                if (filePath.startsWith(basePath + "/")) {
                    return filePath.substring(basePath.length + 1);
                } else if (filePath === basePath) {
                    return "";
                }
            }
        }
        return filePath;
    }

    /**
     * Returns the repository-relative vault directory when file operations
     * should be limited to a vault that is contained by the repository.
     * An undefined value means the whole repository is inside the vault, the
     * vault is the repository root, or the backend cannot address a parent
     * repository.
     */
    protected getVaultPathspec(): string | undefined {
        return undefined;
    }

    protected isPathInsideVault(filePath: string): boolean {
        const vaultPath = this.getVaultPathspec();
        return (
            vaultPath == undefined ||
            filePath === vaultPath ||
            filePath.startsWith(vaultPath + "/")
        );
    }

    unload(): void {}

    /*
     * Sorts the children and simplifies the title
     * If a node only contains another subdirectory, that subdirectory is moved up one level and integrated into the parent node
     */
    private simplify<T>(tree: TreeItem<T>[]): TreeItem<T>[] {
        for (const node of tree) {
            while (true) {
                const singleChild = node.children?.length == 1;
                const singleChildIsDir =
                    node.children?.first()?.data == undefined;

                if (
                    !(
                        node.children != undefined &&
                        singleChild &&
                        singleChildIsDir
                    )
                )
                    break;
                const child = node.children.first()!;
                node.title += "/" + child.title;
                node.data = child.data;
                node.path = child.path;
                node.vaultPath = child.vaultPath;
                node.children = child.children;
            }
            if (node.children != undefined) {
                this.simplify<T>(node.children);
            }
            node.children?.sort((a, b) => {
                const dirCompare =
                    (b.data == undefined ? 1 : 0) -
                    (a.data == undefined ? 1 : 0);
                if (dirCompare != 0) {
                    return dirCompare;
                } else {
                    return a.title.localeCompare(b.title);
                }
            });
        }
        return tree.sort((a, b) => {
            const dirCompare =
                (b.data == undefined ? 1 : 0) - (a.data == undefined ? 1 : 0);
            if (dirCompare != 0) {
                return dirCompare;
            } else {
                return a.title.localeCompare(b.title);
            }
        });
    }

    getTreeStructure<T = DiffFile | FileStatusResult>(
        children: (T & { path: string; vaultPath: string })[],
        root: "repository" | "vault" = "repository"
    ): TreeItem<T>[] {
        interface TrieNode {
            title: string;
            path: string;
            vaultPath: string;
            data?: T;
            children: Map<string, TrieNode>;
        }

        const rootChildren = new Map<string, TrieNode>();

        for (const item of children) {
            const treePath = root === "vault" ? item.vaultPath : item.path;
            const parts = treePath.split("/");
            let currentChildren = rootChildren;
            let currentTreePath = "";

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i]!;
                currentTreePath = currentTreePath
                    ? currentTreePath + "/" + part
                    : part;
                const isLast = i === parts.length - 1;

                let node = currentChildren.get(part);
                if (!node) {
                    const path =
                        root === "vault"
                            ? this.getRelativeRepoPath(currentTreePath)
                            : currentTreePath;
                    const vaultPath =
                        root === "vault"
                            ? currentTreePath
                            : this.getRelativeVaultPath(currentTreePath);
                    node = {
                        title: part,
                        path,
                        vaultPath,
                        children: new Map<string, TrieNode>(),
                    };
                    currentChildren.set(part, node);
                }

                if (isLast) {
                    node.data = item;
                }
                currentChildren = node.children;
            }
        }

        const convert = (nodes: Map<string, TrieNode>): TreeItem<T>[] => {
            const list: TreeItem<T>[] = [];
            for (const node of nodes.values()) {
                if (node.children.size > 0) {
                    list.push({
                        title: node.title,
                        path: node.path,
                        vaultPath: node.vaultPath,
                        children: convert(node.children),
                    });
                } else {
                    list.push({
                        title: node.title,
                        data: node.data,
                        path: node.path,
                        vaultPath: node.vaultPath,
                    });
                }
            }
            return list;
        };

        const tree = convert(rootChildren);
        const res = this.simplify<T>(tree);
        return res;
    }

    async formatCommitMessage(template: string): Promise<string> {
        let status: Status | undefined;
        if (template.includes("{{numFiles}}")) {
            status = await this.status();
            const numFiles = status.staged.length + status.stagedOutsideVault;
            template = template.replace("{{numFiles}}", String(numFiles));
        }
        if (template.includes("{{hostname}}")) {
            let hostname = this.plugin.localStorage.getHostname() || "";
            if (!hostname && Platform.isDesktopApp) {
                hostname = osHostname();
            }
            template = template.replace("{{hostname}}", hostname);
        }

        if (template.includes("{{files}}")) {
            status = status ?? (await this.status());

            const changeset: { [key: string]: string[] } = {};
            let files = "";
            // If there are more than 100 files, we don't list them all
            if (status.staged.length + status.stagedOutsideVault < 100) {
                status.staged.forEach((value: FileStatusResult) => {
                    if (value.index in changeset) {
                        changeset[value.index]!.push(value.path);
                    } else {
                        changeset[value.index] = [value.path];
                    }
                });

                const chunks = [];
                for (const [action, files] of Object.entries(changeset)) {
                    chunks.push(action + " " + files.join(" "));
                }

                files = chunks.join(", ");
                if (status.stagedOutsideVault > 0) {
                    files += `${files ? ", " : ""}${status.stagedOutsideVault} outside vault`;
                }
            } else {
                files = "Too many files to list";
            }

            template = template.replace("{{files}}", files);
        }

        template = template.replace(
            "{{date}}",
            moment().format(this.plugin.settings.commitDateFormat)
        );
        if (this.plugin.settings.listChangedFilesInMessageBody) {
            const status2 = status ?? (await this.status());
            let files = "";
            // If there are more than 100 files, we don't list them all
            if (status2.staged.length + status2.stagedOutsideVault < 100) {
                files = status2.staged.map((e) => e.path).join("\n");
                if (status2.stagedOutsideVault > 0) {
                    files += `${files ? "\n" : ""}${status2.stagedOutsideVault} staged file${status2.stagedOutsideVault === 1 ? "" : "s"} outside the vault`;
                }
            } else {
                files = "Too many files to list";
            }
            template = template + "\n\n" + "Affected files:" + "\n" + files;
        }
        return template;
    }
}
