import { Platform } from "obsidian";
import { ObsidianGitSettings } from "./types";

export const DATE_FORMAT = "YYYY-MM-DD";
export const DATE_TIME_FORMAT_MINUTES = `${DATE_FORMAT} HH:mm`;
export const DATE_TIME_FORMAT_SECONDS = `${DATE_FORMAT} HH:mm:ss`;

export const GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH = 40;

export const DEFAULT_SETTINGS: ObsidianGitSettings = {
    commitMessage: "vault backup: {{date}}",
    autoCommitMessage: undefined!, // default undefined for settings migration
    commitDateFormat: DATE_TIME_FORMAT_SECONDS,
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
    showBranchStatusBar: true,

    lineAuthor: {
        show: false,
        followMovement: "inactive",
        authorDisplay: "initials",
        showCommitHash: false,
        dateTimeFormatOptions: "date",
        dateTimeFormatCustomString: DATE_TIME_FORMAT_MINUTES,
        dateTimeTimezone: "viewer-local",
        coloringMaxAge: "1y",
        // colors were picked via:
        // https://color.adobe.com/de/create/color-accessibility
        colorNew: { r: 255, g: 150, b: 150 },
        colorOld: { r: 120, g: 160, b: 255 },
        gutterSpacingFallbackLength: 5,
    }
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
