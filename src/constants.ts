import { Platform } from "obsidian";
import { ObsidianGitSettings } from "./types";

export const DEFAULT_SETTINGS: ObsidianGitSettings = {
    commitMessage: "vault backup: {{date}}",
    autoCommitMessage: undefined, // default undefined for settings migration
    commitDateFormat: "YYYY-MM-DD HH:mm:ss",
    autoSaveInterval: 0,
    autoPushInterval: 0,
    autoPullInterval: 0,
    autoPullOnBoot: false,
    disablePush: false,
    pullBeforePush: true,
    disablePopups: false,
    listChangedFilesInMessageBody: false,
    showStatusBar: true,
    updateSubmodules: false,
    syncMethod: 'merge',
    customMessageOnAutoBackup: false,
    autoBackupAfterFileChange: false,
    treeStructure: false,
    refreshSourceControl: Platform.isDesktopApp,
    basePath: "",
    differentIntervalCommitAndPush: false,
    changedFilesInStatusBar: false,
    username: "",
    showedMobileNotice: false,
    refreshSourceControlTimer: 7000,
    showBranchStatusBar: true
};

export const GIT_VIEW_CONFIG = {
    type: 'git-view',
    name: 'Source Control',
    icon: 'git-pull-request'
};

export const DIFF_VIEW_CONFIG = {
    type: 'diff-view',
    name: 'Diff View',
    icon: 'git-pull-request'
};
