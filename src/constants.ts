import { Platform } from "obsidian";
import { ObsidianGitSettings } from "./types";

export const DEFAULT_SETTINGS: Omit<ObsidianGitSettings, "autoCommitMessage"> =
    {
        commitMessage: "vault backup: {{date}}",
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
        syncMethod: "merge",
        customMessageOnAutoBackup: false,
        autoBackupAfterFileChange: false,
        treeStructure: false,
        refreshSourceControl: Platform.isDesktopApp,
        basePath: "",
        differentIntervalCommitAndPush: false,
        changedFilesInStatusBar: false,
        showedMobileNotice: false,
        refreshSourceControlTimer: 7000,
        showBranchStatusBar: true,
        setLastSaveToLastCommit: false,
        submoduleRecurseCheckout: false,
        gitDir: "",
        showFileMenu: true,
    };

export const SOURCE_CONTROL_VIEW_CONFIG = {
    type: "git-view",
    name: "Source Control",
    icon: "git-pull-request",
};

export const HISTORY_VIEW_CONFIG = {
    type: "git-history-view",
    name: "History",
    icon: "history",
};

export const DIFF_VIEW_CONFIG = {
    type: "diff-view",
    name: "Diff View",
    icon: "git-pull-request",
};
