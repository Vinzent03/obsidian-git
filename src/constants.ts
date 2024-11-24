import { Platform } from "obsidian";
import type { ObsidianGitSettings } from "./types";
export const DATE_FORMAT = "YYYY-MM-DD";
export const DATE_TIME_FORMAT_MINUTES = `${DATE_FORMAT} HH:mm`;
export const DATE_TIME_FORMAT_SECONDS = `${DATE_FORMAT} HH:mm:ss`;

export const GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH = 40;

export const CONFLICT_OUTPUT_FILE = "conflict-files-obsidian-git.md";

export const DEFAULT_SETTINGS: Omit<ObsidianGitSettings, "autoCommitMessage"> =
    {
        commitMessage: "vault backup: {{date}}",
        commitDateFormat: DATE_TIME_FORMAT_SECONDS,
        autoSaveInterval: 0,
        autoPushInterval: 0,
        autoPullInterval: 0,
        autoPullOnBoot: false,
        disablePush: false,
        pullBeforePush: true,
        disablePopups: false,
        disablePopupsForNoChanges: false,
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
        authorInHistoryView: "hide",
        dateInHistoryView: false,
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
            textColorCss: "var(--text-muted)", //  more pronounced than line numbers, but less than the content text
            ignoreWhitespace: false,
            gutterSpacingFallbackLength: 5,
        },
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

export const ASK_PASS_INPUT_FILE = "git_credentials_input";
export const ASK_PASS_SCRIPT_FILE = "obsidian_askpass.sh";

export const ASK_PASS_SCRIPT = `#!/bin/sh

PROMPT="$1"
TEMP_FILE="$OBSIDIAN_GIT_CREDENTIALS_INPUT"

cleanup() {
    rm -f "$TEMP_FILE" "$TEMP_FILE.response"
}
trap cleanup EXIT

echo "$PROMPT" > "$TEMP_FILE"

while [ ! -e "$TEMP_FILE.response" ]; do
    sleep 0.1
done

RESPONSE=$(cat "$TEMP_FILE.response")

echo "$RESPONSE"
`;
