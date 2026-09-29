import type {
    App,
    RGB,
    SettingDefinition,
    SettingDefinitionItem,
} from "obsidian";
import {
    moment,
    Notice,
    Platform,
    PluginSettingTab,
    Setting,
    SettingPage,
} from "obsidian";
import {
    DATE_TIME_FORMAT_SECONDS,
    DEFAULT_SETTINGS,
    GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH,
} from "src/constants";
import { IsomorphicGit } from "src/gitManager/isomorphicGit";
import { SimpleGit } from "src/gitManager/simpleGit";
import { previewColor } from "src/editor/lineAuthor/lineAuthorProvider";
import type {
    LineAuthorDateTimeFormatOptions,
    LineAuthorDisplay,
    LineAuthorFollowMovement,
    LineAuthorSettings,
    LineAuthorTimezoneOption,
} from "src/editor/lineAuthor/model";
import type ObsidianGit from "src/main";
import type { ObsidianGitSettings } from "src/types";
import { convertToRgb, rgbToString } from "src/utils";

const FORMAT_STRING_REFERENCE_URL =
    "https://momentjs.com/docs/#/parsing/string-format/";
const LINE_AUTHOR_FEATURE_WIKI_LINK =
    "https://publish.obsidian.md/git-doc/Line+Authoring";
const INVERTED_CONTROLS: Partial<Record<string, keyof ObsidianGitSettings>> = {
    showInformationalNotifications: "disablePopups",
    showNoChangesNotifications: "disablePopupsForNoChanges",
};
const AUTOMATIC_RELOADS: Record<string, ("commit" | "push" | "pull")[]> = {
    differentIntervalCommitAndPush: ["commit", "push"],
    autoBackupAfterFileChange: ["commit"],
    setLastSaveToLastCommit: ["commit"],
    autoSaveInterval: ["commit"],
    autoPushInterval: ["push"],
    autoPullInterval: ["pull"],
};
const validateInteger = (value: number): string | undefined =>
    Number.isInteger(value) ? undefined : "Enter a whole number.";

export class ObsidianGitSettingsTab extends PluginSettingTab {
    lineAuthorColorSettings: Map<"oldest" | "newest", Setting> = new Map();
    private lineAuthorRefreshTimer?: number;
    constructor(
        app: App,
        private plugin: ObsidianGit
    ) {
        super(app, plugin);
    }

    icon = "git-pull-request";

    private get settings() {
        return this.plugin.settings;
    }

    private toggle(
        name: string,
        key: string,
        desc?: string
    ): SettingDefinition {
        return { name, desc, control: { type: "toggle", key } };
    }

    private dropdown(
        name: string,
        key: string,
        options: Record<string, string>,
        desc?: string
    ): SettingDefinition {
        return { name, desc, control: { type: "dropdown", key, options } };
    }

    private get commitOrSync(): string {
        return this.settings.differentIntervalCommitAndPush
            ? "commit"
            : "commit-and-sync";
    }

    private renderRepositoryAuthor(
        setting: Setting,
        key: "user.name" | "user.email"
    ): void {
        setting.addText((text) => {
            const manager = this.plugin.gitManager;
            let edited = false;
            void (async () => {
                const local = await manager.getConfig(key, "local");
                if (!edited) text.setValue(local ?? "");
                if (manager instanceof SimpleGit) {
                    const global = await manager.getConfig(key, "global");
                    if (global) text.setPlaceholder(`Global: ${global}`);
                }
            })().catch((error) => this.plugin.displayError(error));

            text.onChange(async (value) => {
                edited = true;
                await this.plugin.gitActions.setGitConfig(
                    key,
                    value || undefined
                );
            });
        });
    }

    private resolveControl(key: string) {
        const invertedKey = INVERTED_CONTROLS[key];
        const storedKey = invertedKey ?? key;
        const isHunk = storedKey.startsWith("hunks.");
        return {
            storedKey,
            inverted: invertedKey !== undefined,
            target: (isHunk
                ? this.settings.hunks
                : this.settings) as unknown as Record<string, unknown>,
            field: isHunk ? storedKey.slice("hunks.".length) : storedKey,
        };
    }

    getControlValue(key: string): unknown {
        const { target, field, inverted } = this.resolveControl(key);
        const value = target[field];
        return inverted ? !value : value;
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        const { storedKey, target, field, inverted } = this.resolveControl(key);
        if (storedKey === "basePath") {
            const path = value as string;
            await this.plugin.changeBasePath(path);
            return;
        }
        if (inverted) value = !value;
        if (storedKey === "autoCommitMessage" && value === "") {
            value = DEFAULT_SETTINGS[storedKey];
        }
        target[field] = value;
        await this.plugin.saveSettings();

        const automaticTypes = AUTOMATIC_RELOADS[storedKey];
        if (automaticTypes) {
            this.plugin.automaticsManager.reload(...automaticTypes);
        }
        if (storedKey === "differentIntervalCommitAndPush") this.update();
        if (storedKey.startsWith("hunks.")) {
            this.plugin.editorIntegration.refreshSignsSettings();
        } else if (
            storedKey === "authorInHistoryView" ||
            storedKey === "dateInHistoryView" ||
            storedKey === "limitToVault"
        ) {
            await this.plugin.refresh();
        } else if (storedKey === "refreshSourceControlTimer") {
            this.plugin.setRefreshDebouncer();
        }
        // Obsidian refreshes predicates for controls after the write.
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        const ready = () => this.plugin.gitReady;
        const desktop = () => this.plugin.gitManager instanceof SimpleGit;
        const mobile = () => this.plugin.gitManager instanceof IsomorphicGit;
        const automatic = this.commitOrSync;
        return [
            {
                name: "Git is not ready",
                desc: "When the repository is ready, automatic routines, commit, sync, and editor settings become available. Check the repository paths and Git configuration under Advanced.",
                visible: () => !this.plugin.gitReady,
                status: "warning",
            },
            {
                type: "page",
                name: "Automatic",
                desc: "Scheduled commit, pull, and push routines.",
                visible: ready,
                items: [
                    this.toggle(
                        "Use separate commit and push intervals",
                        "differentIntervalCommitAndPush",
                        "Enable to use one interval for commits and another for pushes."
                    ),
                    {
                        name: `Auto ${automatic} interval (minutes)`,
                        desc: `${this.settings.differentIntervalCommitAndPush ? "Commit" : "Commit and sync"} changes every X minutes. Set to 0 to disable.`,
                        control: {
                            type: "number",
                            key: "autoSaveInterval",
                            min: 0,
                            step: 1,
                            validate: validateInteger,
                        },
                    },
                    {
                        name: `Auto ${automatic} after stopping file edits`,
                        desc: `Requires the ${automatic} interval not to be 0. Waits for file edits to stop before the next auto ${automatic}.`,
                        control: {
                            type: "toggle",
                            key: "autoBackupAfterFileChange",
                            disabled: () =>
                                this.settings.setLastSaveToLastCommit,
                        },
                    },
                    {
                        name: `Start the automatic ${automatic} timer from the latest commit`,
                        desc: `Sets the last auto ${automatic} timestamp to the latest commit timestamp, reducing the frequency after manual commits.`,
                        control: {
                            type: "toggle",
                            key: "setLastSaveToLastCommit",
                            disabled: () =>
                                this.settings.autoBackupAfterFileChange,
                        },
                    },
                    {
                        name: "Auto push interval (minutes)",
                        desc: "Push commits every X minutes. Set to 0 to disable.",
                        control: {
                            type: "number",
                            key: "autoPushInterval",
                            min: 0,
                            step: 1,
                            validate: validateInteger,
                            disabled: () =>
                                !this.settings.differentIntervalCommitAndPush,
                        },
                    },
                    {
                        name: "Auto pull interval (minutes)",
                        desc: "Pull changes every X minutes. Set to 0 to disable.",
                        control: {
                            type: "number",
                            key: "autoPullInterval",
                            min: 0,
                            step: 1,
                            validate: validateInteger,
                        },
                    },
                    this.toggle(
                        `Auto ${automatic} only staged files`,
                        "autoCommitOnlyStaged",
                        `Only staged files are committed on auto ${automatic}.`
                    ),
                    this.toggle(
                        `Specify custom commit message on auto ${automatic}`,
                        "customMessageOnAutoBackup",
                        "Shows a prompt to specify your message."
                    ),
                    {
                        name: `Commit message on auto ${automatic}`,
                        desc: "Placeholders: {{date}}, {{hostname}}, {{numFiles}}, and {{files}}.",
                        control: {
                            type: "textarea",
                            key: "autoCommitMessage",
                            defaultValue: DEFAULT_SETTINGS.autoCommitMessage,
                            disabled: () =>
                                this.settings.customMessageOnAutoBackup,
                        },
                    },
                ],
            },
            {
                type: "page",
                name: "Commit",
                desc: "Commit messages and placeholders.",
                visible: ready,
                items: [
                    this.toggle(
                        "Stage all changes when nothing is staged",
                        "autoStageOnEmptyIndex",
                        "When using Commit with nothing staged, stage and commit all changes. Commit all changes and Commit-and-sync are unaffected."
                    ),
                    {
                        name: "Commit message on manual commit",
                        desc: "Placeholders: {{date}}, {{hostname}}, {{numFiles}}, and {{files}}. Leave empty to require manual input.",
                        render: (setting) => {
                            setting.addTextArea((text) => {
                                text.setValue(this.settings.commitMessage);
                                text.onChange(async (value) => {
                                    this.settings.commitMessage = value;
                                    await this.plugin.saveSettings();
                                });
                                setting.addButton((button) =>
                                    button
                                        .setIcon("reset")
                                        .setTooltip(
                                            `Set to default: "${DEFAULT_SETTINGS.commitMessage}"`
                                        )
                                        .onClick(() => {
                                            text.setValue(
                                                DEFAULT_SETTINGS.commitMessage
                                            );
                                            text.onChanged();
                                        })
                                );
                            });
                        },
                    },
                    {
                        name: "Commit message script",
                        desc: "Run with 'sh -c' to generate a commit message. Placeholders: {{hostname}}, {{date}}.",
                        visible: () => Platform.isDesktopApp,
                        control: { type: "text", key: "commitMessageScript" },
                    },
                    {
                        name: "{{date}} placeholder format",
                        render: (setting) => {
                            setting.addMomentFormat((text) =>
                                text
                                    .setDefaultFormat(
                                        this.settings.commitDateFormat
                                    )
                                    .setValue(this.settings.commitDateFormat)
                                    .onChange(async (value) => {
                                        this.settings.commitDateFormat = value;
                                        await this.plugin.saveSettings();
                                    })
                            );
                            setting.descEl.createSpan({
                                text: `Example: ${DATE_TIME_FORMAT_SECONDS}. See `,
                            });
                            setting.descEl.createEl("a", {
                                text: "Moment.js documentation",
                                href: FORMAT_STRING_REFERENCE_URL,
                                attr: { target: "_blank" },
                            });
                            setting.descEl.createSpan({
                                text: " for more formats.",
                            });
                        },
                    },
                    {
                        name: "{{hostname}} placeholder replacement",
                        desc: "Set a hostname for this device. Defaults to the OS hostname on desktop.",
                        render: (setting) => {
                            setting.addText((text) =>
                                text
                                    .setValue(
                                        this.plugin.localStorage.getHostname() ??
                                            ""
                                    )
                                    .onChange((value) =>
                                        this.plugin.localStorage.setHostname(
                                            value
                                        )
                                    )
                            );
                        },
                    },
                    {
                        name: "Preview commit message",
                        render: (setting) => {
                            setting.addButton((button) =>
                                button
                                    .setButtonText("Preview")
                                    .onClick(async () => {
                                        const preview =
                                            await this.plugin.gitManager.formatCommitMessage(
                                                this.settings.commitMessage
                                            );
                                        new Notice(preview);
                                    })
                            );
                        },
                    },
                    this.toggle(
                        "List filenames affected by commit in the commit body",
                        "listChangedFilesInMessageBody"
                    ),
                ],
            },
            {
                type: "page",
                name: "Sync",
                desc: "Pull, merge, and commit-and-sync behavior.",
                visible: ready,
                items: [
                    {
                        type: "group",
                        heading: "Pull",
                        items: [
                            {
                                ...this.dropdown(
                                    "Merge strategy",
                                    "syncMethod",
                                    {
                                        merge: "Merge",
                                        rebase: "Rebase",
                                        reset: "Other sync service (update HEAD only)",
                                    },
                                    "How to integrate remote commits."
                                ),
                                visible: desktop,
                            },
                            {
                                ...this.dropdown(
                                    "Auto-stash changes when rebasing",
                                    "rebaseAutoStash",
                                    {
                                        enabled: "Enabled",
                                        disabled: "Disabled",
                                        "git-config": "Use Git configuration",
                                    },
                                    "Stash local changes before rebasing and restore them afterward. Restoring may produce conflicts."
                                ),
                                visible: () =>
                                    desktop() &&
                                    this.settings.syncMethod === "rebase",
                            },
                            this.dropdown(
                                "Merge strategy on conflicts",
                                "mergeStrategy",
                                {
                                    none: "None (Git default)",
                                    ours: "Our changes",
                                    theirs: "Their changes",
                                },
                                "Choose which side to favor when pulling remote changes."
                            ),
                            this.toggle(
                                "Pull on startup",
                                "autoPullOnBoot",
                                "Automatically pull commits when Obsidian starts."
                            ),
                        ],
                    },
                    {
                        type: "group",
                        heading: "Commit-and-sync",
                        items: [
                            {
                                name: "Push on commit-and-sync",
                                desc: "Push after committing. Disabling turns commit-and-sync into a local commit, with an optional pull.",
                                render: (setting) => {
                                    setting.addToggle((toggle) =>
                                        toggle
                                            .setValue(
                                                !this.settings.disablePush
                                            )
                                            .onChange(async (value) => {
                                                this.settings.disablePush =
                                                    !value;
                                                await this.plugin.saveSettings();
                                                this.refreshDomState();
                                            })
                                    );
                                },
                            },
                            this.toggle(
                                "Pull on commit-and-sync",
                                "pullBeforePush",
                                "Pull commits as part of commit-and-sync."
                            ),
                            {
                                ...this.toggle(
                                    "Squash commits before push",
                                    "squashCommitsBeforePush",
                                    "Combine local unpushed commits into one before pushing. No force-push is needed."
                                ),
                                visible: desktop,
                            },
                        ],
                    },
                ],
            },
            {
                type: "page",
                name: "Editor",
                desc: "Hunk controls and line author information.",
                visible: () => ready() && desktop(),
                items: [
                    {
                        type: "group",
                        heading: "Hunk management",
                        items: [
                            this.toggle(
                                "Signs",
                                "hunks.showSigns",
                                "Show colored change markers in the editor and stage, reset, or preview hunks."
                            ),
                            this.toggle(
                                "Hunk commands",
                                "hunks.hunkCommands",
                                "Commands to stage and reset hunks and navigate between them."
                            ),
                            this.dropdown(
                                "Show line changes in the status bar",
                                "hunks.statusBar",
                                {
                                    disabled: "Disabled",
                                    colored: "Colored",
                                    monochrome: "Monochrome",
                                }
                            ),
                        ],
                    },
                    {
                        type: "page",
                        name: "Line author information",
                        desc: "Commit hash, author, date, and age coloring next to each line.",
                        page: () => new LineAuthorSettingsPage(this),
                    },
                ],
            },
            {
                type: "page",
                name: "Views",
                desc: "History, source control, and diff views.",
                items: [
                    {
                        type: "group",
                        heading: "Source control view",
                        items: [
                            this.toggle(
                                "Automatically refresh source control view on file changes",
                                "refreshSourceControl",
                                "Disable on slower machines if this causes lag."
                            ),
                            {
                                name: "Source control view refresh interval",
                                desc: "Milliseconds to wait after a file change before refreshing. Minimum 500.",
                                control: {
                                    type: "number",
                                    key: "refreshSourceControlTimer",
                                    min: 500,
                                    step: 1,
                                    validate: validateInteger,
                                },
                            },
                        ],
                    },
                    {
                        type: "group",
                        heading: "Diff view",
                        items: [
                            {
                                ...this.dropdown(
                                    "Diff view style",
                                    "diffStyle",
                                    { split: "Split", git_unified: "Unified" },
                                    "Split mode creates an editable diff in the editor, which may differ from Git's diff."
                                ),
                                visible: desktop,
                            },
                            {
                                name: "Split diff computation time limit (ms)",
                                desc: "Maximum milliseconds to compute a detailed split diff. Read-only diffs use ten times this value.",
                                visible: desktop,
                                control: {
                                    type: "number",
                                    key: "diffTimeout",
                                    min: 1,
                                    step: 1,
                                    validate: validateInteger,
                                },
                            },
                        ],
                    },
                    {
                        type: "group",
                        heading: "History view",
                        items: [
                            this.dropdown(
                                "Show author",
                                "authorInHistoryView",
                                {
                                    hide: "Hide",
                                    full: "Full",
                                    initials: "Initials",
                                },
                                "Show the commit author in the history view."
                            ),
                            this.toggle(
                                "Show date",
                                "dateInHistoryView",
                                "Uses the {{date}} placeholder format."
                            ),
                        ],
                    },
                ],
            },
            {
                type: "page",
                name: "Interface",
                desc: "Notifications, status bar, and file menu.",
                items: [
                    this.toggle(
                        "Show informational notifications",
                        "showInformationalNotifications",
                        "Show notices about Git operations. The status bar still shows updates when this is off."
                    ),
                    this.toggle(
                        "Show error notifications",
                        "showErrorNotices",
                        "Show error notices for Git operations."
                    ),
                    {
                        ...this.toggle(
                            "Show notifications when nothing changed",
                            "showNoChangesNotifications",
                            "Also notify when a commit or push finds no changes."
                        ),
                        visible: () => !this.settings.disablePopups,
                    },
                    this.toggle(
                        "Show status bar",
                        "showStatusBar",
                        "Restart Obsidian for this change to take effect."
                    ),
                    this.toggle(
                        "File menu integration",
                        "showFileMenu",
                        "Add Stage, Unstage, and Add to .gitignore actions to the file menu."
                    ),
                    this.toggle(
                        "Show branch status bar",
                        "showBranchStatusBar",
                        "Restart Obsidian for this change to take effect."
                    ),
                    this.toggle(
                        "Show the count of modified files in the status bar",
                        "changedFilesInStatusBar"
                    ),
                ],
            },
            {
                type: "page",
                name: "Identity",
                desc: "Authentication and commit author.",
                items: [
                    {
                        name: "Username on your Git server",
                        visible: mobile,
                        render: (setting) => {
                            setting.addText((text) =>
                                text
                                    .setValue(
                                        this.plugin.localStorage.getUsername() ??
                                            ""
                                    )
                                    .onChange((value) =>
                                        this.plugin.localStorage.setUsername(
                                            value
                                        )
                                    )
                            );
                        },
                    },
                    {
                        name: "Git server password or access token",
                        desc: "Stored on this device. The saved value is not shown again.",
                        visible: mobile,
                        render: (setting) => {
                            setting.addText((text) => {
                                text.inputEl.autocapitalize = "off";
                                text.inputEl.autocomplete = "off";
                                text.inputEl.spellcheck = false;
                                text.onChange((value) =>
                                    this.plugin.localStorage.setPassword(value)
                                );
                            });
                        },
                    },
                    {
                        name: "Repository author name",
                        desc: Platform.isDesktopApp
                            ? "Changes only this repository's Git config. Leave blank to use the global author name, if configured."
                            : "Saved in this repository's Git config. Mobile Git has no global author name fallback.",
                        visible: ready,
                        render: (setting) => {
                            this.renderRepositoryAuthor(setting, "user.name");
                        },
                    },
                    {
                        name: "Repository author email",
                        desc: Platform.isDesktopApp
                            ? "Changes only this repository's Git config. Leave blank to use the global author email, if configured."
                            : "Saved in this repository's Git config. Mobile Git has no global author email fallback.",
                        visible: ready,
                        render: (setting) => {
                            this.renderRepositoryAuthor(setting, "user.email");
                        },
                    },
                ],
            },
            {
                type: "page",
                name: "Advanced",
                desc: "Repository paths, Git environment, and device options.",
                items: [
                    {
                        ...this.toggle(
                            "Update submodules",
                            "updateSubmodules",
                            "Commit-and-sync and pull update submodules. Tracking branches must be configured for each submodule."
                        ),
                        visible: desktop,
                    },
                    {
                        ...this.toggle(
                            "Submodule recurse checkout/switch",
                            "submoduleRecurseCheckout",
                            "Recurse checkout on submodules when switching the root repository."
                        ),
                        visible: () =>
                            desktop() && this.settings.updateSubmodules,
                    },
                    this.toggle(
                        "Limit file operations to the vault",
                        "limitToVault",
                        "Limit status, staging, unstaging, discarding, and submodule updates to the vault where possible. Repository history and remote actions remain repository-wide."
                    ),
                    {
                        name: "Custom Git binary path",
                        desc: "Path to the Git executable for a custom installation.",
                        visible: desktop,
                        render: (setting) => {
                            setting.addText((text) =>
                                text
                                    .setPlaceholder("git")
                                    .setValue(
                                        this.plugin.localStorage.getGitPath() ??
                                            ""
                                    )
                                    .onChange((value) => {
                                        void this.plugin.changeGitPath(value);
                                    })
                            );
                        },
                    },
                    {
                        name: "Additional environment variables",
                        desc: "One KEY=VALUE pair per line.",
                        visible: desktop,
                        render: (setting) => {
                            setting.addTextArea((text) =>
                                text
                                    .setPlaceholder("GIT_DIR=/path/to/git/dir")
                                    .setValue(
                                        this.plugin.localStorage
                                            .getEnvVars()
                                            .join("\n")
                                    )
                                    .onChange((value) =>
                                        this.plugin.localStorage.setEnvVars(
                                            value.split("\n")
                                        )
                                    )
                            );
                        },
                    },
                    {
                        name: "Additional PATH environment variable paths",
                        desc: "One path per line.",
                        visible: desktop,
                        render: (setting) => {
                            setting.addTextArea((text) =>
                                text
                                    .setValue(
                                        this.plugin.localStorage
                                            .getPATHPaths()
                                            .join("\n")
                                    )
                                    .onChange((value) =>
                                        this.plugin.localStorage.setPATHPaths(
                                            value.split("\n")
                                        )
                                    )
                            );
                        },
                    },
                    {
                        name: "Reload with new environment variables",
                        desc: "Removing previous variables requires an Obsidian restart.",
                        visible: desktop,
                        render: (setting) => {
                            setting.addButton((button) =>
                                button
                                    .setButtonText("Reload")
                                    .setCta()
                                    .onClick(async () =>
                                        this.plugin.reloadGitManager()
                                    )
                            );
                        },
                    },
                    {
                        name: "Repository folder within the vault",
                        desc: "Choose the folder containing the Git repository. Leave empty when the repository is at the root.",
                        control: {
                            type: "folder",
                            key: "basePath",
                            includeRoot: false,
                            validate: (path) => {
                                if (path === "") return undefined;
                                else if (path == "/")
                                    return "Leave empty when the repository is at the root.";
                                else if (!this.app.vault.getFolderByPath(path))
                                    return "Choose an existing folder in this vault.";
                                return undefined;
                            },
                        },
                    },
                    {
                        name: "Custom Git directory path (instead of .git)",
                        desc: "Resolved from the custom base path or vault root. Restart Obsidian to apply. Use backslashes on Windows.",
                        control: {
                            type: "text",
                            key: "gitDir",
                            placeholder: ".git",
                        },
                    },
                    {
                        name: "Disable on this device",
                        desc: "This setting is not synced.",
                        render: (setting) => {
                            setting.addToggle((toggle) =>
                                toggle
                                    .setValue(
                                        this.plugin.localStorage.getPluginDisabled()
                                    )
                                    .onChange((value) => {
                                        this.plugin.localStorage.setPluginDisabled(
                                            value
                                        );
                                        if (value) this.plugin.unloadPlugin();
                                        else
                                            this.plugin
                                                .init({ fromReload: true })
                                                .catch((error) =>
                                                    this.plugin.displayError(
                                                        error
                                                    )
                                                );
                                        new Notice(
                                            "Obsidian must be restarted for the change to take effect."
                                        );
                                    })
                            );
                        },
                    },
                    {
                        type: "group",
                        heading: "Debugging",
                        items: [
                            {
                                name: "Copy debug information",
                                desc: "May contain sensitive settings.",
                                render: (setting) => {
                                    setting.addButton((button) =>
                                        button
                                            .setButtonText("Copy")
                                            .onClick(async () => {
                                                await window.navigator.clipboard.writeText(
                                                    JSON.stringify(
                                                        {
                                                            settings:
                                                                this.settings,
                                                            pluginVersion:
                                                                this.plugin
                                                                    .manifest
                                                                    .version,
                                                        },
                                                        null,
                                                        4
                                                    )
                                                );
                                                new Notice(
                                                    "Debug information copied to clipboard. May contain sensitive information!"
                                                );
                                            })
                                    );
                                },
                            },
                            {
                                name: "Debugging and logging",
                                desc: Platform.isDesktopApp
                                    ? `Open the developer console with ${Platform.isMacOS ? "CMD (⌘) + OPTION (⌥) + I" : "CTRL + SHIFT + I"}.`
                                    : "",
                                visible: () => Platform.isDesktopApp,
                            },
                        ],
                    },
                ],
            },
            {
                heading: "Support",
                type: "group",
                items: [
                    {
                        name: "Donate",
                        desc: "Support continued development of the plugin.",
                        render: (setting) => {
                            setting.addButton((button) => {
                                const link =
                                    button.buttonEl.parentElement?.createEl(
                                        "a",
                                        {
                                            href: "https://ko-fi.com/F1F195IQ5",
                                            attr: { target: "_blank" },
                                        }
                                    );
                                link?.createEl("img", {
                                    attr: {
                                        height: "36",
                                        style: "border:0px;height:36px;",
                                        src: "https://cdn.ko-fi.com/cdn/kofi3.png?v=3",
                                        border: "0",
                                        alt: "Buy Me a Coffee at ko-fi.com",
                                    },
                                });
                                button.buttonEl.remove();
                            });
                        },
                    },
                ],
            },
        ];
    }

    public configureLineAuthorShowStatus(show: boolean) {
        this.settings.lineAuthor.show = show;
        void this.plugin.saveSettings();

        if (show) this.plugin.editorIntegration.activateLineAuthoring();
        else this.plugin.editorIntegration.deactiveLineAuthoring();
    }

    /**
     * Persists the setting {@link key} with value {@link value} and
     * refreshes the line author info views.
     */
    public async lineAuthorSettingHandler<
        K extends keyof ObsidianGitSettings["lineAuthor"],
    >(key: K, value: ObsidianGitSettings["lineAuthor"][K]): Promise<void> {
        this.settings.lineAuthor[key] = value;
        await this.plugin.saveSettings();
        this.plugin.editorIntegration.lineAuthoringFeature.refreshLineAuthorViews();
    }

    /**
     * Ensure, that certain last shown values are persistent in the settings.
     *
     * Necessary for the line author info gutter context menus.
     */
    public beforeSaveSettings() {
        const laSettings = this.settings.lineAuthor;
        if (laSettings.authorDisplay !== "hide") {
            laSettings.lastShownAuthorDisplay = laSettings.authorDisplay;
        }
        if (laSettings.dateTimeFormatOptions !== "hide") {
            laSettings.lastShownDateTimeFormatOptions =
                laSettings.dateTimeFormatOptions;
        }
    }

    public renderLineAuthorSettings(containerEl: HTMLElement): void {
        containerEl.empty();
        this.lineAuthorColorSettings.clear();
        const baseLineAuthorInfoSetting = new Setting(containerEl).setName(
            "Show commit authoring information next to each line"
        );

        if (
            !this.plugin.editorIntegration.lineAuthoringFeature.isAvailableOnCurrentPlatform()
        ) {
            baseLineAuthorInfoSetting
                .setDesc("Only available on desktop currently.")
                .setDisabled(true);
        }

        baseLineAuthorInfoSetting.descEl.createEl("a", {
            href: LINE_AUTHOR_FEATURE_WIKI_LINK,
            text: "Feature guide and quick examples",
            attr: {
                target: "_blank",
            },
        });
        baseLineAuthorInfoSetting.descEl.createEl("br");
        baseLineAuthorInfoSetting.descEl.createSpan({
            text: " The commit hash, author name and authoring date can all be individually toggled.",
        });
        baseLineAuthorInfoSetting.descEl.createEl("br");
        baseLineAuthorInfoSetting.descEl.createSpan({
            text: "Hide everything, to only show the age-colored sidebar.",
        });

        baseLineAuthorInfoSetting.addToggle((toggle) =>
            toggle.setValue(this.settings.lineAuthor.show).onChange((value) => {
                this.configureLineAuthorShowStatus(value);
                this.refreshLineAuthorPage(containerEl);
            })
        );

        if (this.settings.lineAuthor.show) {
            const trackMovement = new Setting(containerEl)
                .setName("Follow movement and copies across files and commits")
                .addDropdown((dropdown) => {
                    dropdown.addOptions({
                        inactive: "Do not follow (default)",
                        "same-commit": "Follow within same commit",
                        "all-commits": "Follow within all commits (maybe slow)",
                    });
                    dropdown.setValue(this.settings.lineAuthor.followMovement);
                    dropdown.onChange((value) =>
                        this.lineAuthorSettingHandler(
                            "followMovement",
                            value as LineAuthorFollowMovement
                        )
                    );
                });

            trackMovement.descEl.createSpan({
                text: "By default (deactivated), each line only shows the newest commit where it was changed.",
            });
            trackMovement.descEl.createEl("br");
            trackMovement.descEl.createSpan({ text: "With " });
            trackMovement.descEl.createEl("i", { text: "same commit" });
            trackMovement.descEl.createSpan({
                text: ", cut-copy-paste-ing of text is followed within the same commit and the original commit of authoring will be shown.",
            });
            trackMovement.descEl.createEl("br");
            trackMovement.descEl.createSpan({ text: "With " });
            trackMovement.descEl.createEl("i", { text: "all commits" });
            trackMovement.descEl.createSpan({
                text: ", cut-copy-paste-ing text inbetween multiple commits will be detected.",
            });
            trackMovement.descEl.createEl("br");
            trackMovement.descEl.createSpan({ text: "It uses " });
            trackMovement.descEl.createEl("a", {
                href: "https://git-scm.com/docs/git-blame",
                text: "git-blame",
                attr: {
                    target: "_blank",
                },
            });
            trackMovement.descEl.createSpan({
                text: ` and for matches (at least ${GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH} characters) within the same (or all) commit(s), `,
            });
            trackMovement.descEl.createEl("em", { text: "the originating" });
            trackMovement.descEl.createSpan({
                text: " commit's information is shown.",
            });

            new Setting(containerEl)
                .setName("Show commit hash")
                .addToggle((tgl) => {
                    tgl.setValue(this.settings.lineAuthor.showCommitHash);
                    tgl.onChange((value: boolean) =>
                        this.lineAuthorSettingHandler("showCommitHash", value)
                    );
                });

            new Setting(containerEl)
                .setName("Author name display")
                .setDesc("If and how the author is displayed")
                .addDropdown((dropdown) => {
                    const options: Record<LineAuthorDisplay, string> = {
                        hide: "Hide",
                        initials: "Initials (default)",
                        "first name": "First name",
                        "last name": "Last name",
                        full: "Full name",
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(this.settings.lineAuthor.authorDisplay);

                    dropdown.onChange(async (value) =>
                        this.lineAuthorSettingHandler(
                            "authorDisplay",
                            value as LineAuthorDisplay
                        )
                    );
                });

            new Setting(containerEl)
                .setName("Authoring date display")
                .setDesc(
                    "If and how the date and time of authoring the line is displayed"
                )
                .addDropdown((dropdown) => {
                    const options: Record<
                        LineAuthorDateTimeFormatOptions,
                        string
                    > = {
                        hide: "Hide",
                        date: "Date (default)",
                        datetime: "Date and time",
                        "natural language": "Natural language",
                        custom: "Custom",
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(
                        this.settings.lineAuthor.dateTimeFormatOptions
                    );

                    dropdown.onChange(async (value) => {
                        await this.lineAuthorSettingHandler(
                            "dateTimeFormatOptions",
                            value as LineAuthorDateTimeFormatOptions
                        );
                        this.refreshLineAuthorPage(containerEl);
                    });
                });

            if (this.settings.lineAuthor.dateTimeFormatOptions === "custom") {
                const dateTimeFormatCustomStringSetting = new Setting(
                    containerEl
                );

                dateTimeFormatCustomStringSetting
                    .setName("Custom authoring date format")
                    .addText((cb) => {
                        cb.setValue(
                            this.settings.lineAuthor.dateTimeFormatCustomString
                        );
                        cb.setPlaceholder("YYYY-MM-DD HH:mm");

                        cb.onChange(async (value) => {
                            await this.lineAuthorSettingHandler(
                                "dateTimeFormatCustomString",
                                value
                            );
                            this.setCustomDateTimeDescription(
                                dateTimeFormatCustomStringSetting.descEl,
                                value
                            );
                        });
                    });

                this.setCustomDateTimeDescription(
                    dateTimeFormatCustomStringSetting.descEl,
                    this.settings.lineAuthor.dateTimeFormatCustomString
                );
            }

            const timezoneSetting = new Setting(containerEl)
                .setName("Authoring date display timezone")
                .addDropdown((dropdown) => {
                    const options: Record<LineAuthorTimezoneOption, string> = {
                        "viewer-local": "My local (default)",
                        "author-local": "Author's local",
                        utc0000: "UTC+0000/Z",
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(
                        this.settings.lineAuthor.dateTimeTimezone
                    );

                    dropdown.onChange(async (value) =>
                        this.lineAuthorSettingHandler(
                            "dateTimeTimezone",
                            value as LineAuthorTimezoneOption
                        )
                    );
                });
            timezoneSetting.descEl.empty();
            timezoneSetting.descEl.createSpan({
                text: "The time-zone in which the authoring date should be shown.\nEither your local time-zone (default),\nthe author's time-zone during commit creation or\n",
            });
            timezoneSetting.descEl.createEl("a", {
                text: "UTC±00:00",
                href: "https://en.wikipedia.org/wiki/UTC%C2%B100:00",
            });
            timezoneSetting.descEl.createSpan({
                text: ".",
            });

            const oldestAgeSetting = new Setting(containerEl).setName(
                "Oldest age in coloring"
            );

            this.setOldestAgeDescription(
                oldestAgeSetting.descEl,
                this.settings.lineAuthor.coloringMaxAge
            );

            oldestAgeSetting.addText((text) => {
                text.setPlaceholder("1y");
                text.setValue(this.settings.lineAuthor.coloringMaxAge);
                text.onChange(async (value) => {
                    const duration = parseColoringMaxAgeDuration(value);
                    const valid = duration !== undefined;
                    this.setOldestAgeDescription(
                        oldestAgeSetting.descEl,
                        value
                    );
                    if (valid) {
                        await this.lineAuthorSettingHandler(
                            "coloringMaxAge",
                            value
                        );
                        this.refreshColorSettingsName("oldest");
                    }
                });
            });

            this.createColorSetting("newest", containerEl);
            this.createColorSetting("oldest", containerEl);

            const textColorSetting = new Setting(containerEl)
                .setName("Text color")
                .addText((field) => {
                    field.setValue(this.settings.lineAuthor.textColorCss);
                    field.onChange(async (value) => {
                        await this.lineAuthorSettingHandler(
                            "textColorCss",
                            value
                        );
                    });
                });
            textColorSetting.descEl.empty();
            textColorSetting.descEl.createSpan({
                text: "The CSS color of the gutter text.",
            });
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createSpan({
                text: "It is highly recommended to use ",
            });
            textColorSetting.descEl.createEl("a", {
                text: "CSS variables",
                href: "https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties",
            });
            textColorSetting.descEl.createSpan({
                text: " defined by themes (e.g. ",
            });
            textColorSetting.descEl.createEl("pre", {
                text: "var(--text-muted)",
                attr: {
                    style: "display:inline",
                },
            });
            textColorSetting.descEl.createSpan({ text: " or " });
            textColorSetting.descEl.createEl("pre", {
                text: "var(--text-on-accent)",
                attr: {
                    style: "display:inline",
                },
            });
            textColorSetting.descEl.createSpan({
                text: "), because they automatically adapt to theme changes.",
            });
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createSpan({ text: "See: " });
            textColorSetting.descEl.createEl("a", {
                text: "List of available CSS variables in Obsidian",
                href: "https://github.com/obsidian-community/obsidian-theme-template/blob/main/obsidian.css",
            });

            const ignoreWhitespaceSetting = new Setting(containerEl)
                .setName("Ignore whitespace and newlines in changes")
                .addToggle((tgl) => {
                    tgl.setValue(this.settings.lineAuthor.ignoreWhitespace);
                    tgl.onChange((value) =>
                        this.lineAuthorSettingHandler("ignoreWhitespace", value)
                    );
                });
            ignoreWhitespaceSetting.descEl.empty();
            ignoreWhitespaceSetting.descEl.createSpan({
                text: "Whitespace and newlines are interpreted as part of the document and in changes by default (hence not ignored). This makes the last line being shown as 'changed' when a new subsequent line is added, even if the previously last line's text is the same.",
            });
            ignoreWhitespaceSetting.descEl.createEl("br");
            ignoreWhitespaceSetting.descEl.createSpan({
                text: "If you don't care about purely-whitespace changes (e.g. list nesting / quote indentation changes), then activating this will provide more meaningful change detection.",
            });
        }
    }

    private createColorSetting(
        which: "oldest" | "newest",
        containerEl: HTMLElement
    ) {
        const setting = new Setting(containerEl).setName("").addText((text) => {
            const color = pickColor(which, this.settings.lineAuthor);
            const defaultColor = pickColor(which, DEFAULT_SETTINGS.lineAuthor);
            text.setPlaceholder(rgbToString(defaultColor));
            text.setValue(rgbToString(color));
            text.onChange(async (colorNew) => {
                const rgb = convertToRgb(colorNew);
                if (rgb !== undefined) {
                    const key = which === "newest" ? "colorNew" : "colorOld";
                    await this.lineAuthorSettingHandler(key, rgb);
                }
                this.refreshColorSettingsDesc(which, rgb);
            });
        });
        this.lineAuthorColorSettings.set(which, setting);

        this.refreshColorSettingsName(which);
        this.refreshColorSettingsDesc(
            which,
            pickColor(which, this.settings.lineAuthor)
        );
    }

    private refreshColorSettingsName(which: "oldest" | "newest") {
        const settingsDom = this.lineAuthorColorSettings.get(which);
        if (settingsDom) {
            const whichDescriber =
                which === "oldest"
                    ? `oldest (${this.settings.lineAuthor.coloringMaxAge} or older)`
                    : "newest";
            settingsDom.nameEl.setText(`Color for ${whichDescriber} commits`);
        }
    }

    private refreshColorSettingsDesc(which: "oldest" | "newest", rgb?: RGB) {
        const settingsDom = this.lineAuthorColorSettings.get(which);
        if (settingsDom) {
            this.colorSettingPreviewDesc(
                settingsDom.descEl,
                which,
                this.settings.lineAuthor,
                rgb !== undefined
            );
        }
    }

    private colorSettingPreviewDesc(
        descEl: HTMLElement,
        which: "oldest" | "newest",
        laSettings: LineAuthorSettings,
        colorIsValid: boolean
    ): void {
        descEl.empty();
        descEl.createSpan({
            text: "Supports 'rgb(r,g,b)', 'hsl(h,s,l)', hex (#) and named colors (e.g. 'black', 'purple'). Color preview: ",
        });

        const rgbStr = colorIsValid
            ? previewColor(which, laSettings)
            : `rgba(127,127,127,0.3)`;
        const today = moment.unix(moment.now() / 1000).format("YYYY-MM-DD");
        const text = colorIsValid
            ? `abcdef Author Name ${today}`
            : "invalid color";

        descEl.createEl("div", {
            text: text,
            attr: {
                class: "line-author-settings-preview",
                style: `background-color: ${rgbStr}; width: 30ch;`,
            },
        });
    }

    private setCustomDateTimeDescription(
        descEl: HTMLElement,
        dateTimeFormatCustomString: string
    ): void {
        descEl.empty();
        descEl.createEl("a", {
            text: "Format string",
            href: FORMAT_STRING_REFERENCE_URL,
        });
        descEl.createSpan({
            text: " to display the authoring date.",
        });
        descEl.createEl("br");
        const formattedDateTime = moment().format(dateTimeFormatCustomString);
        descEl.createSpan({
            text: `Currently: ${formattedDateTime}`,
        });
    }

    private setOldestAgeDescription(
        descEl: HTMLElement,
        coloringMaxAge: string
    ): void {
        const duration = parseColoringMaxAgeDuration(coloringMaxAge);
        const durationString =
            duration !== undefined ? `${duration.asDays()} days` : "invalid!";
        descEl.empty();
        descEl.createSpan({
            text: `The oldest age in the line author coloring. Everything older will have the same color.\nSmallest valid age is "1d". Currently: ${durationString}`,
        });
    }

    private refreshLineAuthorPage(containerEl: HTMLElement): void {
        window.clearTimeout(this.lineAuthorRefreshTimer);
        this.lineAuthorRefreshTimer = window.setTimeout(() => {
            this.lineAuthorRefreshTimer = undefined;
            if (containerEl.isConnected)
                this.renderLineAuthorSettings(containerEl);
        }, 80);
    }

    public cancelLineAuthorRefresh(): void {
        window.clearTimeout(this.lineAuthorRefreshTimer);
        this.lineAuthorRefreshTimer = undefined;
        this.lineAuthorColorSettings.clear();
    }
}

// Color previews and formatted descriptions depend on live input, so this
// sub-page keeps its custom rows while the surrounding navigation is declarative.
class LineAuthorSettingsPage extends SettingPage {
    title = "Line author information";

    constructor(private tab: ObsidianGitSettingsTab) {
        super();
    }

    display(): void {
        this.tab.renderLineAuthorSettings(this.containerEl);
    }

    hide(): void {
        this.tab.cancelLineAuthorRefresh();
        super.hide();
    }
}

export function pickColor(
    which: "oldest" | "newest",
    las: LineAuthorSettings
): RGB {
    return which === "oldest" ? las.colorOld : las.colorNew;
}

export function parseColoringMaxAgeDuration(
    durationString: string
): moment.Duration | undefined {
    // https://momentjs.com/docs/#/durations/creating/
    const duration = moment.duration("P" + durationString.toUpperCase());
    return duration.isValid() && duration.asDays() && duration.asDays() >= 1
        ? duration
        : undefined;
}
