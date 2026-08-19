import type { LineAuthorSettings } from "src/editor/lineAuthor/model";
import type {
    Editor,
    EventRef,
    MarkdownView,
    Menu,
    TFile,
    WorkspaceLeaf,
} from "obsidian";

export interface ObsidianGitSettings {
    commitMessage: string;
    autoCommitMessage: string;
    commitMessageScript: string;
    commitDateFormat: string;
    /**
     * Interval to either automatically commit-and-sync or just commit
     */
    autoSaveInterval: number;
    autoPushInterval: number;
    autoPullInterval: number;
    autoPullOnBoot: boolean;
    autoCommitOnlyStaged: boolean;
    syncMethod: SyncMethod;
    mergeStrategy: MergeStrategy;
    /**
     * Whether to push on commit-and-sync
     */
    disablePush: boolean;
    /**
     * Whether to pull on commit-and-sync
     */
    pullBeforePush: boolean;
    /**
     * Whether to squash all local unpushed commits into a single commit right
     * before pushing on commit-and-sync. Only rewrites unpushed history, so no
     * force-push is required.
     */
    squashCommitsBeforePush: boolean;
    /**
     * Whether messages from {@link ObsidianGit.displayMessage} should be shown
     */
    disablePopups: boolean;
    /**
     * Whether messages from {@link ObsidianGit.displayError} should be shown
     */
    showErrorNotices: boolean;
    disablePopupsForNoChanges: boolean;
    listChangedFilesInMessageBody: boolean;
    showStatusBar: boolean;
    updateSubmodules: boolean;
    submoduleRecurseCheckout: boolean;
    /**
     * @deprecated Using `localstorage` instead
     */
    gitPath?: string;
    customMessageOnAutoBackup: boolean;
    autoBackupAfterFileChange: boolean;
    treeStructure: boolean;
    /**
     * @deprecated Using `localstorage` instead
     */
    username?: string;
    differentIntervalCommitAndPush: boolean;
    changedFilesInStatusBar: boolean;

    /**
     * @deprecated Migrated to `syncMethod = 'merge'`
     */
    mergeOnPull?: boolean;
    refreshSourceControl: boolean;
    basePath: string;
    showedMobileNotice: boolean;
    refreshSourceControlTimer: number;
    showBranchStatusBar: boolean;
    lineAuthor: LineAuthorSettings;
    setLastSaveToLastCommit: boolean;
    gitDir: string;
    showFileMenu: boolean;
    authorInHistoryView: ShowAuthorInHistoryView;
    dateInHistoryView: boolean;
    diffStyle: "git_unified" | "split";
    hunks: {
        hunkCommands: boolean;
        showSigns: boolean;
        statusBar: "disabled" | "colored" | "monochrome";
    };
}

/**
 * Ensures, that nested values objects are correctly merged.
 */
export function mergeSettingsByPriority(
    low: Omit<ObsidianGitSettings, "autoCommitMessage">,
    high: ObsidianGitSettings
): ObsidianGitSettings {
    const lineAuthor = Object.assign({}, low.lineAuthor, high.lineAuthor);
    return Object.assign({}, low, high, { lineAuthor });
}

export type SyncMethod = "rebase" | "merge" | "reset";

export type MergeStrategy = "none" | "ours" | "theirs";

export type ShowAuthorInHistoryView = "full" | "initials" | "hide";

export interface Author {
    name: string;
    email: string;
}

export interface Status {
    all: FileStatusResult[];
    changed: FileStatusResult[];
    staged: FileStatusResult[];

    conflicted: string[];
}

export interface GitTimestamp {
    /**
     * The number of unix seconds since epoch time (UTC).
     */
    epochSeconds: number;
    /**
     * The time zone, in which the commit was originally created.
     * This can be used to reconstruct the local time during creating time.
     */
    tz: string;
}

export interface UserEmail {
    name: string;
    email: string;
}

export interface BlameCommit {
    hash: string;
    author?: UserEmail & GitTimestamp;
    committer?: UserEmail & GitTimestamp;
    previous?: { commitHash?: string; filename: string };
    filename?: string;
    summary: string;
    isZeroCommit: boolean; // true, if hash is 000...000
}

export const zeroCommit: BlameCommit = {
    hash: "000000",
    isZeroCommit: true,
    summary: "",
};

/**
 * See https://git-scm.com/docs/git-blame#_the_porcelain_format
 */
export interface Blame {
    commits: Map<string, BlameCommit>;
    /**
     * hashPerLine[i] is the commit hash where line i originates from
     *
     * The first element is always `undefined`, since line-numbers are 1-based.
     */
    hashPerLine: string[];
    /**
     * originalFileLineNrPerLine[i] contains the original files' line number from where line i
     *
     * The first element is always `undefined`, since line-numbers are 1-based.originated
     */
    originalFileLineNrPerLine: number[];
    /**
     * finalFileLineNrPerLine[i] contains the final files' line number from where line i originated
     *
     * The first element is always `undefined`, since line-numbers are 1-based.
     */
    finalFileLineNrPerLine: number[];
    /**
     * For each line i, which originates from a different commit than it's previous line,
     * groupSizePerStartingLine[i] contains the number of lines until either the next
     * group of lines or EOF is reached.
     */
    groupSizePerStartingLine: Map<number, number>;
}

/**
 * `index` and `working_dir` are each one-character codes, based off the git
 * status short format: git status --short
 * The following is from: https://www.git-scm.com/docs/git-status#_short_format
 *
 * The possible values are:
 * - ' ': unmodified
 * - M  : modified
 * - T  : file type changed
 * - A  : added
 * - D  : deleted
 * - R  : renamed
 * - C  : copied
 * - U  : updated but unmerged
 *
 *  index            working_dir            Meaning
 * ------------------------------------------------------------------------
 *                    [AMD]                 not updated
 *    M               [ MTD]                updated in index
 *    T               [ MTD]                type changed in index
 *    A               [ MTD]                added to index
 *    D                                     deleted from index
 *    R               [ MTD]                renamed in index
 *    C               [ MTD]                copied in index
 * [MTARC]                                  index and work tree match
 * [ MTARC]              M                  work tree changed since index
 * [ MTARC]              T                  type changed in work tree since index
 * [ MTARC]              D                  deleted in work tree
 *                       R                  renamed in work tree
 *                       C                  copied in work tree
 *    D                  D                  unmerged, both deleted
 *    A                  U                  unmerged, added by us
 *    U                  D                  unmerged, deleted by them
 *    U                  A                  unmerged, added by them
 *    D                  U                  unmerged, deleted by us
 *    A                  A                  unmerged, both added
 *    U                  U                  unmerged, both modified
 *    ?                  ?                  untracked
 *    !                  !                  ignored
 *
 *
 * FileStatusResult follows git status --short codes.
 */
export interface FileStatusResult {
    path: string;
    vaultPath: string;
    from?: string;

    // First digit of the status code of the file, e.g. 'M' = modified.
    // Represents the status of the index if no merge conflicts, otherwise represents
    // status of one side of the merge.
    index: string;
    // Second digit of the status code of the file. Represents status of the working directory
    // if no merge conflicts, otherwise represents status of other side of a merge.
    workingDir: string;
}

export interface PluginState {
    offlineMode: boolean;
    operation: GitOperation;
}

export interface GitProgress {
    /**
     * User-facing operation or phase label, e.g. "Fetching", "Pushing", or
     * "Updating submodules".
     */
    action: string;
    /**
     * Git progress stage or manual phase detail, e.g. "receiving",
     * "checking remote", or "merging". Git may emit multiple stages during one
     * operation, and stages are not guaranteed to emit a final 100% event.
     */
    stage: string;
    /**
     * Stage-specific percentage reported by Git. Undefined for indeterminate
     * phases where the plugin only knows that work is in progress.
     */
    progress?: number;
    /**
     * Number of stage items processed so far when reported by Git.
     */
    processed?: number;
    /**
     * Total number of stage items when reported by Git.
     */
    total?: number;
}

export enum GitOperation {
    idle,
    pull,
    commit,
    push,
    fetch,
    checkout,
}

export interface LogEntry {
    hash: string;
    date: string;
    message: string;
    refs: string[];
    body: string;
    diff: DiffEntry;
    author: {
        name: string;
        email: string;
    };
}

export interface DiffEntry {
    changed: number;
    files: DiffFile[];
}

export interface DiffFile {
    path: string;
    vaultPath: string;
    fromPath?: string;
    fromVaultPath?: string;
    hash: string;
    status: string;
    binary?: boolean;
}

export interface WalkDifference {
    path: string;
    type: "M" | "A" | "D";
}

export type UnstagedFile = WalkDifference;

export interface BranchInfo {
    current?: string;
    tracking?: string;
    branches: string[];
}

export interface TreeItem<T = DiffFile | FileStatusResult> {
    title: string;
    path: string;
    vaultPath: string;
    data?: T;
    children?: TreeItem<T>[];
}

export type RootTreeItem<T> = TreeItem<T> & { children: TreeItem<T>[] };

export type StatusRootTreeItem = RootTreeItem<FileStatusResult>;

export type HistoryRootTreeItem = RootTreeItem<DiffFile>;

export type DiffViewState = {
    /**
     * The repo relative file path for a.
     * For diffing a renamed file, this is the old path.
     */
    aFile: string;

    /**
     * The git ref to specify which state of that file should be shown.
     * An empty string refers to the index version of a file, so you have to specifically check against undefined.
     */
    aRef: string;

    /**
     * The repo relative file path for b.
     */
    bFile: string;

    /**
     * The git ref to specify which state of that file should be shown.
     * An empty string refers to the index version of a file, so you have to specifically check against undefined.
     * `undefined` stands for the working tree version.
     */
    bRef?: string;
};

export enum FileType {
    staged,
    changed,
    pulled,
}

export class NoNetworkError extends Error {
    constructor(public readonly originalError: string) {
        super("No network connection available");
    }
}

export class UserCanceledError extends Error {
    constructor() {
        super("The user canceled the operation");
    }
}

export type ElectronWindow = Window & {
    electron: {
        shell: {
            showItemInFolder(fullPath: string): void;
        };
    };
};

declare module "obsidian" {
    interface App {
        openWithDefaultApp(path: string): void;
        getTheme(): "obsidian" | "moonstone";
        viewRegistry: ViewRegistry;
    }
    interface View {
        titleEl: HTMLElement;
        inlineTitleEl: HTMLElement;
    }
    interface ViewRegistry {
        /**
         * PRIVATE API
         *
         * Returns the view type for the given extension if available.
         */
        getTypeByExtension(extension: string): string;
    }
    interface Workspace {
        on(
            name: "file-open",
            callback: (file: TFile | null) => unknown,
            ctx?: unknown
        ): EventRef;
        on(
            name: "active-leaf-change",
            callback: (leaf: WorkspaceLeaf | null) => unknown,
            ctx?: unknown
        ): EventRef;
        on(
            name: "editor-menu",
            callback: (
                menu: Menu,
                editor: Editor,
                view: MarkdownView
            ) => unknown,
            ctx?: unknown
        ): EventRef;
        /**
         * Emitted when some git action has been completed and plugin has been refreshed
         */
        on(
            name: "obsidian-git:refreshed",
            callback: () => void,
            ctx?: unknown
        ): EventRef;
        /**
         * Emitted when some git action has been completed and the plugin should refresh
         */
        on(
            name: "obsidian-git:refresh",
            callback: () => void,
            ctx?: unknown
        ): EventRef;
        /**
         * Emitted when the plugin is currently loading a new cached status.
         */
        on(
            name: "obsidian-git:loading-status",
            callback: () => void,
            ctx?: unknown
        ): EventRef;
        /**
         * Emitted when the HEAD changed.
         */
        on(
            name: "obsidian-git:head-change",
            callback: () => void,
            ctx?: unknown
        ): EventRef;
        /**
         * Emitted when a new cached status is available.
         */
        on(
            name: "obsidian-git:status-changed",
            callback: (status: Status) => void,
            ctx?: unknown
        ): EventRef;

        on(
            name: "obsidian-git:menu",
            callback: (
                menu: Menu,
                path: string,
                source: string,
                leaf?: WorkspaceLeaf
            ) => unknown,
            ctx?: unknown
        ): EventRef;
        trigger(name: string, ...data: unknown[]): void;
        trigger(name: "obsidian-git:refreshed"): void;
        trigger(name: "obsidian-git:refresh"): void;
        trigger(name: "obsidian-git:loading-status"): void;
        trigger(name: "obsidian-git:head-change"): void;
        trigger(name: "obsidian-git:status-changed", status: Status): void;
        trigger(
            name: "obsidian-git:menu",
            menu: Menu,
            path: string,
            source: string,
            leaf?: WorkspaceLeaf
        ): void;
    }
}
