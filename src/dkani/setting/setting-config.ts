import type { ObsidianGitSettings } from "src/types";
import type { ObsidianNewGitSettingsTab } from "./setting-tab";
import { SimpleGit } from "src/gitManager/simpleGit";
import type {
    SettingsConfig,
    NumberConstraint,
} from "@dkani/obsidian-settings-ui";

const intervalConstraint: NumberConstraint = {
    min: 0,
    max: 35791,
    unit: "minutes",
};

export function createSettingsConfig(
    settingsTab: ObsidianNewGitSettingsTab
): SettingsConfig<ObsidianGitSettings> {
    const plugin = settingsTab.plugin;
    return {
        elements: [
            // Message
            {
                type: "Message",
                id: "isGitReady",
                showIf: !plugin.gitReady,
            },
            {
                type: "Conditional",
                showIf: plugin.gitReady,
                items: [
                    // Automatic Commit
                    {
                        type: "SettingGroup",
                        id: "settingGroup.autoCommit",
                        items: [
                            {
                                type: "Status",
                                id: "activeTimers",
                                items: [
                                    {
                                        text: "commit",
                                        isEnabled:
                                            plugin.settings.autoSaveInterval >
                                            0,
                                    },
                                    {
                                        text: "push",
                                        isEnabled:
                                            settingsTab.isAutoPushEnabled(),
                                    },
                                    {
                                        text: "pull",
                                        isEnabled:
                                            plugin.settings.autoPullInterval >
                                            0,
                                    },
                                ],
                            },
                            {
                                type: "Toggle",
                                path: "differentIntervalCommitAndPush",
                                postSave: () =>
                                    plugin.automaticsManager.reload(
                                        "commit",
                                        "push"
                                    ),
                            },
                            {
                                type: "Numberfield",
                                path: "autoSaveInterval",
                                constraint: intervalConstraint,
                                replacements:
                                    settingsTab.autoSaveIntervalReplacements,
                            },
                            {
                                type: "RadioGroup",
                                path: "saveIntervalType",
                                showIf: plugin.settings.autoSaveInterval > 0,
                                replacements:
                                    settingsTab.autoSaveIntervalReplacements,
                                defaultId: "autoSaveIntervalInGeneral",
                                items: [
                                    { id: "autoSaveIntervalInGeneral" },
                                    { id: "autoBackupAfterFileChange" },
                                    { id: "setLastSaveToLastCommit" },
                                ],
                            },
                            {
                                type: "Numberfield",
                                path: "autoPushInterval",
                                constraint: intervalConstraint,
                                showIf: plugin.settings
                                    .differentIntervalCommitAndPush,
                            },
                            {
                                type: "Numberfield",
                                path: "autoPullInterval",
                                constraint: intervalConstraint,
                            },
                            {
                                type: "Toggle",
                                path: "customMessageOnAutoBackup",
                            },
                            {
                                type: "Textarea",
                                path: "autoCommitMessage",
                                showIf: !plugin.settings
                                    .customMessageOnAutoBackup,
                            },
                        ],
                    },
                    // Commit Message
                    {
                        type: "SettingGroup",
                        id: "settingGroup.commitMessage",
                        items: [
                            {
                                type: "Textarea",
                                path: "commitMessage",
                            },
                            {
                                type: "Textfield",
                                path: "commitMessageScript",
                            },
                            {
                                type: "Button",
                                id: "previewCommitMessage",
                                onClick: () =>
                                    settingsTab.onClickPreviewCommitMessage(),
                            },
                            {
                                type: "Textfield",
                                path: "commitDateFormat",
                            },
                            {
                                type: "Textfield",
                                id: "hostnameReplacement",
                                handler: {
                                    getValue: () =>
                                        plugin.localStorage.getHostname() ?? "",
                                    setValue: (value) =>
                                        plugin.localStorage.setHostname(value),
                                },
                            },
                            {
                                type: "Toggle",
                                path: "listChangedFilesInMessageBody",
                            },
                        ],
                    },
                    // settingGroup.pull
                    {
                        type: "SettingGroup",
                        id: "settingGroup.pull",
                        items: [
                            {
                                type: "Dropdown",
                                path: "syncMethod",
                                items: [
                                    { id: "merge" },
                                    { id: "rebase" },
                                    { id: "reset" },
                                ],
                            },
                            {
                                type: "Toggle",
                                path: "autoPullOnBoot",
                            },
                        ],
                    },
                    // commit-and-sync
                    {
                        type: "SettingGroup",
                        id: "settingGroup.commitAndSync",
                        items: [
                            {
                                type: "Toggle",
                                path: "pullBeforePush",
                            },
                            {
                                type: "Toggle",
                                path: "disablePush",
                            },
                        ],
                    },
                    // lineAuthor
                    {
                        type: "SettingGroup",
                        id: "settingGroup.lineAuthor",
                        items: [
                            {
                                type: "Toggle",
                                path: "lineAuthor.show",
                                preSave: (value) =>
                                    settingsTab.setLineAuthor(value),
                            },
                            {
                                type: "Conditional",
                                showIf:
                                    plugin.settings.lineAuthor.show === true,
                                items: [
                                    {
                                        type: "Dropdown",
                                        path: "lineAuthor.followMovement",
                                        items: [
                                            { id: "inactive" },
                                            { id: "same-commit" },
                                            { id: "all-commits" },
                                        ],
                                    },
                                    {
                                        type: "Toggle",
                                        path: "lineAuthor.showCommitHash",
                                    },
                                    {
                                        type: "Dropdown",
                                        path: "lineAuthor.authorDisplay",
                                        items: [
                                            { id: "hide" },
                                            { id: "initials" },
                                            { id: "first name" },
                                            { id: "last name" },
                                            { id: "full" },
                                        ],
                                    },
                                    {
                                        type: "Dropdown",
                                        path: "lineAuthor.dateTimeFormatOptions",
                                        items: [
                                            { id: "hide" },
                                            { id: "date" },
                                            { id: "datetime" },
                                            { id: "natural language" },
                                            { id: "custom" },
                                        ],
                                    },
                                    {
                                        type: "Textfield",
                                        path: "lineAuthor.dateTimeFormatCustomString",
                                        showIf: settingsTab.customLineAuthorDatetimeFormat(),
                                        replacements:
                                            settingsTab.customLineAuthorDatetimeFormatPreview,
                                    },
                                    {
                                        type: "Dropdown",
                                        path: "lineAuthor.dateTimeTimezone",
                                        items: [
                                            { id: "viewer-local" },
                                            { id: "author-local" },
                                            {
                                                id: "utc0000",
                                                label: "UTC±00:00",
                                            },
                                        ],
                                    },
                                    {
                                        type: "Textfield",
                                        path: "lineAuthor.coloringMaxAge",
                                        replacements:
                                            settingsTab.coloringMaxAgeReplacements,
                                        validate: (value: string) =>
                                            settingsTab.validateColoringMaxAge(
                                                value
                                            ),
                                    },
                                    {
                                        type: "ColorPicker",
                                        path: "lineAuthor.colorNew",
                                        datatype: "RGB",
                                        preview: () =>
                                            settingsTab.previewColor(
                                                "colorNew"
                                            ),
                                    },
                                    {
                                        type: "ColorPicker",
                                        path: "lineAuthor.colorOld",
                                        datatype: "RGB",
                                        preview: () =>
                                            settingsTab.previewColor(
                                                "colorOld"
                                            ),
                                    },
                                    {
                                        type: "ColorDropdown",
                                        path: "lineAuthor.textColorCss",
                                        withCustomOption: true,
                                        items: [
                                            { id: "var(--text-muted)" },
                                            { id: "var(--text-normal)" },
                                            { id: "var(--text-accent)" },
                                            { id: "var(--text-faint)" },
                                        ],
                                        postSave: () =>
                                            settingsTab.updateColors(),
                                    },
                                    {
                                        type: "Toggle",
                                        path: "lineAuthor.ignoreWhitespace",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            // historyView
            {
                type: "SettingGroup",
                id: "settingGroup.historyView",
                items: [
                    {
                        type: "Dropdown",
                        path: "authorInHistoryView",
                        items: [
                            { id: "hide" },
                            { id: "full" },
                            { id: "initials" },
                        ],
                    },
                    {
                        type: "Toggle",
                        path: "dateInHistoryView",
                    },
                ],
            },
            // sourceControl
            {
                type: "SettingGroup",
                id: "settingGroup.sourceControl",
                items: [
                    {
                        type: "Toggle",
                        path: "refreshSourceControl",
                    },
                    {
                        type: "Numberfield",
                        path: "refreshSourceControlTimer",
                        showIf: plugin.settings.refreshSourceControl,
                        unit: "milliseconds",
                    },
                ],
            },
            // miscellaneous
            {
                type: "SettingGroup",
                id: "settingGroup.miscellaneous",
                items: [
                    {
                        type: "Dropdown",
                        path: "diffStyle",
                        items: [{ id: "git_unified" }, { id: "split" }],
                    },
                    {
                        type: "Toggle",
                        path: "disablePopups",
                    },
                    {
                        type: "Toggle",
                        path: "disableErrorNotice",
                    },
                    {
                        type: "Toggle",
                        path: "disablePopupsForNoChanges",
                        showIf: plugin.settings.disablePopups === false,
                    },
                    {
                        type: "Toggle",
                        path: "showStatusBar",
                    },
                    {
                        type: "Toggle",
                        path: "showFileMenu",
                    },
                    {
                        type: "Toggle",
                        path: "showBranchStatusBar",
                    },
                    {
                        type: "Toggle",
                        path: "changedFilesInStatusBar",
                    },
                ],
            },
            // gitReadyCommitAuthor
            {
                type: "SettingGroup",
                id: "settingGroup.gitReadyCommitAuthor",
                showIf: plugin.gitReady,
                items: [
                    {
                        type: "Textfield",
                        id: "authorName",
                        handler: {
                            getValue: () => settingsTab.getGitReadyUsername(),
                            setValue: (value: string) =>
                                settingsTab.setGitReadyUsername(value),
                        },
                    },
                    {
                        type: "Textfield",
                        id: "authorEmail",
                        handler: {
                            getValue: () => settingsTab.getGitReadyEmail(),
                            setValue: (value: string) =>
                                settingsTab.setGitReadyEmail(value),
                        },
                    },
                ],
            },
            // IsomorphicGit
            {
                type: "SettingGroup",
                id: "settingGroup.IsomorphicGit",
                showIf: settingsTab.isIsomorphicGit(),
                items: [
                    {
                        type: "Textfield",
                        id: "username",
                        handler: {
                            getValue: () =>
                                settingsTab.getIsomorphicGitUsername(),
                            setValue: (value: string) =>
                                settingsTab.setIsomorphicGitUsername(value),
                        },
                    },
                    {
                        type: "Password",
                        id: "password",
                        handler: {
                            getValue: () =>
                                settingsTab.getIsomorphicGitPassword(),
                            setValue: (value: string) =>
                                settingsTab.setIsomorphicGitPassword(value),
                        },
                    },
                ],
            },
            // Advanced
            {
                type: "SettingGroup",
                id: "settingGroup.advanced",
                items: [
                    {
                        // Conditional if isSimpleGit()
                        type: "Conditional",
                        showIf: plugin.gitManager instanceof SimpleGit,
                        items: [
                            {
                                type: "Toggle",
                                path: "updateSubmodules",
                            },
                            {
                                type: "Toggle",
                                path: "submoduleRecurseCheckout",
                                showIf: plugin.settings.updateSubmodules,
                            },
                            {
                                type: "Textfield",
                                id: "customGitPath",
                                handler: {
                                    getValue: () =>
                                        plugin.localStorage.getGitPath() ?? "",
                                    setValue: (value: string) =>
                                        settingsTab.setGitPath(value),
                                },
                            },
                            {
                                type: "Textarea",
                                id: "envVariables",
                                handler: {
                                    getValue: () =>
                                        plugin.localStorage
                                            .getEnvVars()
                                            .join("\n"),
                                    setValue: (value: string) =>
                                        plugin.localStorage.setEnvVars(
                                            value.split("\n")
                                        ),
                                },
                            },
                            {
                                type: "Textarea",
                                id: "pathVariables",
                                handler: {
                                    getValue: () =>
                                        plugin.localStorage
                                            .getPATHPaths()
                                            .join("\n"),
                                    setValue: (value: string) =>
                                        plugin.localStorage.setPATHPaths(
                                            value.split("\n")
                                        ),
                                },
                            },
                            {
                                type: "Button",
                                id: "reloadGit",
                                onClick: async () =>
                                    await (
                                        plugin.gitManager as SimpleGit
                                    ).setGitInstance(),
                            },
                        ],
                    },
                    {
                        type: "Textfield",
                        id: "customBasePath",
                        handler: {
                            getValue: () => plugin.settings.basePath,
                            setValue: (value: string) =>
                                settingsTab.setBasePath(value),
                        },
                    },
                    {
                        type: "Textfield",
                        path: "gitDir",
                        preSave: (value) => settingsTab.setBasePath(value),
                    },
                    {
                        type: "Toggle",
                        id: "disablePlugin",
                        handler: {
                            getValue: () =>
                                plugin.localStorage.getPluginDisabled(),
                            setValue: (value: boolean) =>
                                settingsTab.setPluginDisabled(value),
                        },
                    },
                ],
            },
        ],
        support: {
            kofiId: "F1F195IQ5",
        },
    };
}
