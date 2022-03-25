export interface ObsidianGitSettings {
    commitMessage: string;
    autoCommitMessage: string;
    commitDateFormat: string;
    autoSaveInterval: number;
    autoPullInterval: number;
    autoPullOnBoot: boolean;
    syncMethod: SyncMethod;
    disablePush: boolean;
    pullBeforePush: boolean;
    disablePopups: boolean;
    listChangedFilesInMessageBody: boolean;
    showStatusBar: boolean;
    updateSubmodules: boolean;
    gitPath: string;
    customMessageOnAutoBackup: boolean;
    autoBackupAfterFileChange: boolean;
    treeStructure: boolean;

    /**
     * @deprecated Migrated to `syncMethod = 'merge'`
     */
    mergeOnPull?: boolean;
    refreshSourceControl: boolean;
    basePath: string;
}

export type SyncMethod = 'rebase' | 'merge' | 'reset';

export interface Author {
    name: string;
    email: string;
}
export interface Status {
    changed: FileStatusResult[];
    staged: FileStatusResult[];
}
export interface FileStatusResult {
    path: string;
    from?: string;
    index: string;
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

export interface BranchInfo {
    current: string;
    tracking: string;
    branches: string[];
}

export interface TreeItem {
    title: string;
    statusResult?: FileStatusResult;
    children?: TreeItem[];
}

export interface DiffViewState {
    staged: boolean,
    file: string,
}