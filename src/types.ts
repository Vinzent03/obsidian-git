export interface ObsidianGitSettings {
    commitMessage: string;
    autoCommitMessage?: string; // possibly undefined for settings migration
    commitDateFormat: string;
    autoSaveInterval: number;
    autoPushInterval: number;
    autoPullInterval: number;
    autoPullOnBoot: boolean;
    syncMethod: SyncMethod;
    disablePush: boolean;
    pullBeforePush: boolean;
    disablePopups: boolean;
    listChangedFilesInMessageBody: boolean;
    showStatusBar: boolean;
    updateSubmodules: boolean;
    submoduleRecurseCheckout: boolean; // possibly undefined as it is not set by default
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
    setLastSaveToLastCommit: boolean;
    gitDir: string;
}

export type SyncMethod = "rebase" | "merge" | "reset";

export interface Author {
    name: string;
    email: string;
}

export interface Status {
    changed: FileStatusResult[];
    staged: FileStatusResult[];
    conflicted: string[];
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
 * FileStatusResult is based off simple-git's FileStatusResult:
 * https://github.com/steveukx/git-js/blob/a569868d800a0d872e8fb1534bb0dceccff47a4f/typings/response.d.ts#L267
 */
export interface FileStatusResult {
    path: string;
    vault_path: string;
    from?: string;

    // First digit of the status code of the file, e.g. 'M' = modified.
    // Represents the status of the index if no merge conflicts, otherwise represents
    // status of one side of the merge.
    index: string;
    // Second digit of the status code of the file. Represents status of the working directory
    // if no merge conflicts, otherwise represents status of other side of a merge.
    working_dir: string;
}
export interface DiffResult {
    path: string;
    type: "equal" | "modify" | "add" | "remove";
}

export enum PluginState {
    idle,
    status,
    pull,
    add,
    commit,
    push,
    conflicted,
}

export interface WalkDifference {
    path: string;
    type: "modify" | "add" | "remove";
}

export interface UnstagedFile {
    filepath: string;
    deleted: boolean;
}

export interface BranchInfo {
    current?: string;
    tracking?: string;
    branches: string[];
}

export interface TreeItem {
    title: string;
    path: string;
    vaultPath: string;
    statusResult?: FileStatusResult;
    children?: TreeItem[];
}

export type RootTreeItem = TreeItem & { children: TreeItem[] };

export interface DiffViewState {
    staged: boolean;
    file: string;
}

export enum FileType {
    staged,
    changed,
    pulled,
}

declare module "obsidian" {
    interface App {
        loadLocalStorage(key: string): string | null;
        saveLocalStorage(key: string, value: string | undefined): void;
    }
}
