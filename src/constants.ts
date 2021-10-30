import { ObsidianGitSettings } from "./types";

export const DEFAULT_SETTINGS: ObsidianGitSettings = {
    commitMessage: "vault backup: {{date}}",
    commitDateFormat: "YYYY-MM-DD HH:mm:ss",
    autoSaveInterval: 0,
    autoPullInterval: 0,
    autoPullOnBoot: false,
    disablePush: false,
    pullBeforePush: true,
    disablePopups: false,
    listChangedFilesInMessageBody: false,
    showStatusBar: true,
    updateSubmodules: false,
    gitPath: ""
};

export const VIEW_CONFIG = {
    type: 'git-view',
    name: 'Source Control',
    icon: 'feather-git-pull-request'
}