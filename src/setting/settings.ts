import type { App, RGB, TextComponent } from "obsidian";
import {
    moment,
    Notice,
    Platform,
    PluginSettingTab,
    Setting,
    TextAreaComponent,
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
import type {
    ObsidianGitSettings,
    MergeStrategy,
    ShowAuthorInHistoryView,
    SyncMethod,
} from "src/types";
import { convertToRgb, formatMinutes, rgbToString } from "src/utils";
import { t, setLocaleOverride } from "../locale";

const FORMAT_STRING_REFERENCE_URL =
    "https://momentjs.com/docs/#/parsing/string-format/";
const LINE_AUTHOR_FEATURE_WIKI_LINK =
    "https://publish.obsidian.md/git-doc/Line+Authoring";

export class ObsidianGitSettingsTab extends PluginSettingTab {
    lineAuthorColorSettings: Map<"oldest" | "newest", Setting> = new Map();
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

    display(): void {
        const { containerEl } = this;
        const plugin: ObsidianGit = this.plugin;

        let commitOrSync: string;
        if (plugin.settings.differentIntervalCommitAndPush) {
            commitOrSync = "commit";
        } else {
            commitOrSync = "commit-and-sync";
        }

        const gitReady = plugin.gitReady;

        containerEl.empty();
        if (!gitReady) {
            containerEl.createEl("p", {
                text: t("settings.git_not_ready"),
            });
            containerEl.createEl("br");
        }

        let setting: Setting;
        if (gitReady) {
            new Setting(containerEl).setName(t("settings.heading.automatic")).setHeading();
            new Setting(containerEl)
                .setName(t("settings.split_timers"))
                .setDesc(
                    t("settings.split_timers_desc")
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(
                            plugin.settings.differentIntervalCommitAndPush
                        )
                        .onChange(async (value) => {
                            plugin.settings.differentIntervalCommitAndPush =
                                value;
                            await plugin.saveSettings();
                            plugin.automaticsManager.reload("commit", "push");
                            this.refreshDisplayWithDelay();
                        })
                );

            new Setting(containerEl)
                .setName(plugin.settings.differentIntervalCommitAndPush ? t("settings.auto_commit_interval_only_commit") : t("settings.auto_commit_interval"))
                .setDesc(
                    plugin.settings.differentIntervalCommitAndPush ? t("settings.auto_commit_interval_desc_only_commit") : t("settings.auto_commit_interval_desc")
                )
                .addText((text) => {
                    text.inputEl.type = "number";
                    this.setNonDefaultValue({
                        text,
                        settingsProperty: "autoSaveInterval",
                    });
                    text.setPlaceholder(
                        String(DEFAULT_SETTINGS.autoSaveInterval)
                    );
                    text.onChange(async (value) => {
                        if (value !== "") {
                            plugin.settings.autoSaveInterval = Number(value);
                        } else {
                            plugin.settings.autoSaveInterval =
                                DEFAULT_SETTINGS.autoSaveInterval;
                        }
                        await plugin.saveSettings();
                        plugin.automaticsManager.reload("commit");
                    });
                });

            setting = new Setting(containerEl)
                .setName(plugin.settings.differentIntervalCommitAndPush ? t("settings.auto_commit_after_file_edit_only_commit") : t("settings.auto_commit_after_file_edit"))
                .setDesc(
                    plugin.settings.differentIntervalCommitAndPush
                        ? t("settings.auto_commit_after_file_edit_desc_only_commit", { minutes: formatMinutes(plugin.settings.autoSaveInterval) })
                        : t("settings.auto_commit_after_file_edit_desc", { minutes: formatMinutes(plugin.settings.autoSaveInterval) })
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.autoBackupAfterFileChange)
                        .onChange(async (value) => {
                            plugin.settings.autoBackupAfterFileChange = value;
                            this.refreshDisplayWithDelay();

                            await plugin.saveSettings();
                            plugin.automaticsManager.reload("commit");
                        })
                );
            this.mayDisableSetting(
                setting,
                plugin.settings.setLastSaveToLastCommit
            );

            setting = new Setting(containerEl)
                .setName(plugin.settings.differentIntervalCommitAndPush ? t("settings.auto_commit_after_latest_only_commit") : t("settings.auto_commit_after_latest"))
                .setDesc(
                    plugin.settings.differentIntervalCommitAndPush
                        ? t("settings.auto_commit_after_latest_desc_only_commit")
                        : t("settings.auto_commit_after_latest_desc")
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.setLastSaveToLastCommit)
                        .onChange(async (value) => {
                            plugin.settings.setLastSaveToLastCommit = value;
                            await plugin.saveSettings();
                            plugin.automaticsManager.reload("commit");
                            this.refreshDisplayWithDelay();
                        })
                );
            this.mayDisableSetting(
                setting,
                plugin.settings.autoBackupAfterFileChange
            );

            setting = new Setting(containerEl)
                .setName(t("settings.auto_push_interval"))
                .setDesc(
                    t("settings.auto_push_interval_desc")
                )
                .addText((text) => {
                    text.inputEl.type = "number";
                    this.setNonDefaultValue({
                        text,
                        settingsProperty: "autoPushInterval",
                    });
                    text.setPlaceholder(
                        String(DEFAULT_SETTINGS.autoPushInterval)
                    );
                    text.onChange(async (value) => {
                        if (value !== "") {
                            plugin.settings.autoPushInterval = Number(value);
                        } else {
                            plugin.settings.autoPushInterval =
                                DEFAULT_SETTINGS.autoPushInterval;
                        }
                        await plugin.saveSettings();
                        plugin.automaticsManager.reload("push");
                    });
                });
            this.mayDisableSetting(
                setting,
                !plugin.settings.differentIntervalCommitAndPush
            );

            new Setting(containerEl)
                .setName(t("settings.auto_pull_interval"))
                .setDesc(
                    t("settings.auto_pull_interval_desc")
                )
                .addText((text) => {
                    text.inputEl.type = "number";
                    this.setNonDefaultValue({
                        text,
                        settingsProperty: "autoPullInterval",
                    });
                    text.setPlaceholder(
                        String(DEFAULT_SETTINGS.autoPullInterval)
                    );
                    text.onChange(async (value) => {
                        if (value !== "") {
                            plugin.settings.autoPullInterval = Number(value);
                        } else {
                            plugin.settings.autoPullInterval =
                                DEFAULT_SETTINGS.autoPullInterval;
                        }
                        await plugin.saveSettings();
                        plugin.automaticsManager.reload("pull");
                    });
                });

            new Setting(containerEl)
                .setName(plugin.settings.differentIntervalCommitAndPush ? t("settings.auto_commit_only_staged_only_commit") : t("settings.auto_commit_only_staged"))
                .setDesc(
                    plugin.settings.differentIntervalCommitAndPush
                        ? t("settings.auto_commit_only_staged_desc_only_commit")
                        : t("settings.auto_commit_only_staged_desc")
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.autoCommitOnlyStaged)
                        .onChange(async (value) => {
                            plugin.settings.autoCommitOnlyStaged = value;
                            await plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName(
                    plugin.settings.differentIntervalCommitAndPush ? t("settings.specify_custom_message_only_commit") : t("settings.specify_custom_message")
                )
                .setDesc(t("settings.specify_custom_message_desc"))
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.customMessageOnAutoBackup)
                        .onChange(async (value) => {
                            plugin.settings.customMessageOnAutoBackup = value;
                            await plugin.saveSettings();
                            this.refreshDisplayWithDelay();
                        })
                );

            setting = new Setting(containerEl)
                .setName(plugin.settings.differentIntervalCommitAndPush ? t("settings.auto_commit_message_only_commit") : t("settings.auto_commit_message"))
                .setDesc(
                    plugin.settings.differentIntervalCommitAndPush
                        ? t("settings.auto_commit_message_desc_only_commit")
                        : t("settings.auto_commit_message_desc")
                )
                .addTextArea((text) => {
                    text.setPlaceholder(
                        DEFAULT_SETTINGS.autoCommitMessage
                    ).onChange(async (value) => {
                        if (value === "") {
                            plugin.settings.autoCommitMessage =
                                DEFAULT_SETTINGS.autoCommitMessage;
                        } else {
                            plugin.settings.autoCommitMessage = value;
                        }
                        await plugin.saveSettings();
                    });
                    this.setNonDefaultValue({
                        text,
                        settingsProperty: "autoCommitMessage",
                    });
                });
            this.mayDisableSetting(
                setting,
                plugin.settings.customMessageOnAutoBackup
            );

            new Setting(containerEl).setName(t("settings.heading.commit_message")).setHeading();

            const manualCommitMessageSetting = new Setting(containerEl)
                .setName(t("settings.manual_commit_message"))
                .setDesc(
                    t("settings.manual_commit_message_desc")
                );
            manualCommitMessageSetting.addTextArea((text) => {
                manualCommitMessageSetting.addButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip(
                            t("settings.set_to_default", { value: DEFAULT_SETTINGS.commitMessage })
                        )
                        .onClick(() => {
                            text.setValue(DEFAULT_SETTINGS.commitMessage);
                            text.onChanged();
                        });
                });
                text.setValue(plugin.settings.commitMessage);
                text.onChange(async (value) => {
                    plugin.settings.commitMessage = value;
                    await plugin.saveSettings();
                });
            });

            if (Platform.isDesktopApp)
                new Setting(containerEl)
                    .setName(t("settings.commit_message_script"))
                    .setDesc(
                        t("settings.commit_message_script_desc")
                    )
                    .addText((text) => {
                        text.onChange(async (value) => {
                            if (value === "") {
                                plugin.settings.commitMessageScript =
                                    DEFAULT_SETTINGS.commitMessageScript;
                            } else {
                                plugin.settings.commitMessageScript = value;
                            }
                            await plugin.saveSettings();
                        });
                        this.setNonDefaultValue({
                            text,
                            settingsProperty: "commitMessageScript",
                        });
                    });

            const datePlaceholderSetting = new Setting(containerEl)
                .setName(t("settings.date_placeholder_format"))
                .addMomentFormat((text) =>
                    text
                        .setDefaultFormat(plugin.settings.commitDateFormat)
                        .setValue(plugin.settings.commitDateFormat)
                        .onChange(async (value) => {
                            plugin.settings.commitDateFormat = value;
                            await plugin.saveSettings();
                        })
                );

            datePlaceholderSetting.descEl.createSpan({
                text: t("settings.date_placeholder_format_desc", { format: DATE_TIME_FORMAT_SECONDS }),
            });
            datePlaceholderSetting.descEl.createEl("a", {
                text: t("settings.momentjs_docs"),
                href: FORMAT_STRING_REFERENCE_URL,
                attr: {
                    target: "_blank",
                },
            });
            datePlaceholderSetting.descEl.createSpan({
                text: t("settings.date_placeholder_format_desc_suffix"),
            });

            new Setting(containerEl)
                .setName(t("settings.hostname_placeholder"))
                .setDesc(
                    t("settings.hostname_placeholder_desc")
                )
                .addText((text) =>
                    text
                        .setValue(plugin.localStorage.getHostname() ?? "")
                        .onChange((value) => {
                            plugin.localStorage.setHostname(value);
                        })
                );

            new Setting(containerEl)
                .setName(t("settings.preview_commit_message"))
                .addButton((button) =>
                    button.setButtonText(t("settings.preview_button")).onClick(async () => {
                        const commitMessagePreview =
                            await plugin.gitManager.formatCommitMessage(
                                plugin.settings.commitMessage
                            );
                        new Notice(`${commitMessagePreview}`);
                    })
                );

            new Setting(containerEl)
                .setName(t("settings.list_filenames_in_commit"))
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.listChangedFilesInMessageBody)
                        .onChange(async (value) => {
                            plugin.settings.listChangedFilesInMessageBody =
                                value;
                            await plugin.saveSettings();
                        })
                );

            new Setting(containerEl).setName(t("settings.heading.pull")).setHeading();

            if (plugin.gitManager instanceof SimpleGit)
                new Setting(containerEl)
                    .setName(t("settings.merge_strategy"))
                    .setDesc(
                        t("settings.merge_strategy_desc")
                    )
                    .addDropdown((dropdown) => {
                        const options: Record<SyncMethod, string> = {
                            merge: t("settings.sync_method.merge"),
                            rebase: t("settings.sync_method.rebase"),
                            reset: t("settings.sync_method.reset"),
                        };
                        dropdown.addOptions(options);
                        dropdown.setValue(plugin.settings.syncMethod);

                        dropdown.onChange(async (option: SyncMethod) => {
                            plugin.settings.syncMethod = option;
                            await plugin.saveSettings();
                        });
                    });

            new Setting(containerEl)
                .setName(t("settings.merge_strategy_on_conflicts"))
                .setDesc(
                    t("settings.merge_strategy_on_conflicts_desc")
                )
                .addDropdown((dropdown) => {
                    const options: Record<MergeStrategy, string> = {
                        none: t("settings.merge_strategy.none"),
                        ours: t("settings.merge_strategy.ours"),
                        theirs: t("settings.merge_strategy.theirs"),
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(plugin.settings.mergeStrategy);

                    dropdown.onChange(async (option: MergeStrategy) => {
                        plugin.settings.mergeStrategy = option;
                        await plugin.saveSettings();
                    });
                });

            new Setting(containerEl)
                .setName(t("settings.pull_on_startup"))
                .setDesc(t("settings.pull_on_startup_desc"))
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.autoPullOnBoot)
                        .onChange(async (value) => {
                            plugin.settings.autoPullOnBoot = value;
                            await plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName(t("settings.heading.commit_and_sync"))
                .setDesc(
                    t("settings.commit_and_sync_desc")
                )
                .setHeading();

            setting = new Setting(containerEl)
                .setName(t("settings.push_on_commit_and_sync"))
                .setDesc(
                    plugin.settings.pullBeforePush ? t("settings.push_on_commit_and_sync_desc_with_pull") : t("settings.push_on_commit_and_sync_desc_without_pull")
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(!plugin.settings.disablePush)
                        .onChange(async (value) => {
                            plugin.settings.disablePush = !value;
                            this.refreshDisplayWithDelay();
                            await plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName(t("settings.pull_on_commit_and_sync"))
                .setDesc(
                    plugin.settings.disablePush ? t("settings.pull_on_commit_and_sync_desc_without_push") : t("settings.pull_on_commit_and_sync_desc_with_push")
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.pullBeforePush)
                        .onChange(async (value) => {
                            plugin.settings.pullBeforePush = value;
                            this.refreshDisplayWithDelay();
                            await plugin.saveSettings();
                        })
                );

            if (plugin.gitManager instanceof SimpleGit) {
                new Setting(containerEl)
                    .setName(t("settings.heading.hunk_management"))
                    .setDesc(
                        t("settings.hunk_management_desc")
                    )
                    .setHeading();

                new Setting(containerEl)
                    .setName(t("settings.signs"))
                    .setDesc(
                        t("settings.signs_desc")
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(plugin.settings.hunks.showSigns)
                            .onChange(async (value) => {
                                plugin.settings.hunks.showSigns = value;
                                await plugin.saveSettings();
                                plugin.editorIntegration.refreshSignsSettings();
                            })
                    );

                new Setting(containerEl)
                    .setName(t("settings.hunk_commands"))
                    .setDesc(
                        t("settings.hunk_commands_desc")
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(plugin.settings.hunks.hunkCommands)
                            .onChange(async (value) => {
                                plugin.settings.hunks.hunkCommands = value;
                                await plugin.saveSettings();

                                plugin.editorIntegration.refreshSignsSettings();
                            })
                    );

                new Setting(containerEl)
                    .setName(t("settings.hunk_status_bar"))
                    .addDropdown((toggle) =>
                        toggle
                            .addOptions({
                                disabled: t("settings.hunk_status.disabled"),
                                colored: t("settings.hunk_status.colored"),
                                monochrome: t("settings.hunk_status.monochrome"),
                            })
                            .setValue(plugin.settings.hunks.statusBar)
                            .onChange(
                                async (
                                    option: ObsidianGitSettings["hunks"]["statusBar"]
                                ) => {
                                    plugin.settings.hunks.statusBar = option;
                                    await plugin.saveSettings();
                                    plugin.editorIntegration.refreshSignsSettings();
                                }
                            )
                    );

                new Setting(containerEl)
                    .setName(t("settings.heading.line_author_info"))
                    .setHeading();

                this.addLineAuthorInfoSettings();
            }
        }

        new Setting(containerEl).setName(t("settings.heading.history_view")).setHeading();

        new Setting(containerEl)
            .setName(t("settings.show_author"))
            .setDesc(t("settings.show_author_desc"))
            .addDropdown((dropdown) => {
                const options: Record<ShowAuthorInHistoryView, string> = {
                    hide: t("settings.author_display_hide"),
                    full: t("settings.author_display_full"),
                    initials: t("settings.author_display_initials"),
                };
                dropdown.addOptions(options);
                dropdown.setValue(plugin.settings.authorInHistoryView);
                dropdown.onChange(async (option: ShowAuthorInHistoryView) => {
                    plugin.settings.authorInHistoryView = option;
                    await plugin.saveSettings();
                    await plugin.refresh();
                });
            });

        new Setting(containerEl)
            .setName(t("settings.show_date"))
            .setDesc(
                t("settings.show_date_desc")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.dateInHistoryView)
                    .onChange(async (value) => {
                        plugin.settings.dateInHistoryView = value;
                        await plugin.saveSettings();
                        await plugin.refresh();
                    })
            );

        new Setting(containerEl).setName(t("settings.heading.source_control_view")).setHeading();

        new Setting(containerEl)
            .setName(
                t("settings.auto_refresh_sc")
            )
            .setDesc(
                t("settings.auto_refresh_sc_desc")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.refreshSourceControl)
                    .onChange(async (value) => {
                        plugin.settings.refreshSourceControl = value;
                        await plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.sc_refresh_interval"))
            .setDesc(
                t("settings.sc_refresh_interval_desc")
            )
            .addText((text) => {
                const MIN_SOURCE_CONTROL_REFRESH_INTERVAL = 500;
                text.inputEl.type = "number";
                this.setNonDefaultValue({
                    text,
                    settingsProperty: "refreshSourceControlTimer",
                });
                text.setPlaceholder(
                    String(DEFAULT_SETTINGS.refreshSourceControlTimer)
                );
                text.onChange(async (value) => {
                    // Without this check, if the textbox is empty or the input is invalid, MIN_SOURCE_CONTROL_REFRESH_INTERVAL would be saved instead of saving the default value.
                    if (value !== "" && Number.isInteger(Number(value))) {
                        plugin.settings.refreshSourceControlTimer = Math.max(
                            Number(value),
                            MIN_SOURCE_CONTROL_REFRESH_INTERVAL
                        );
                    } else {
                        plugin.settings.refreshSourceControlTimer =
                            DEFAULT_SETTINGS.refreshSourceControlTimer;
                    }
                    await plugin.saveSettings();
                    plugin.setRefreshDebouncer();
                });
            });
        new Setting(containerEl).setName(t("settings.heading.miscellaneous")).setHeading();

        if (plugin.gitManager instanceof SimpleGit) {
            new Setting(containerEl)
                .setName(t("settings.diff_view_style"))
                .setDesc(
                    t("settings.diff_view_style_desc")
                )
                .addDropdown((dropdown) => {
                    const options: Record<
                        ObsidianGitSettings["diffStyle"],
                        string
                    > = {
                        split: t("settings.diff_style.split"),
                        git_unified: t("settings.diff_style.unified"),
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(plugin.settings.diffStyle);
                    dropdown.onChange(
                        async (option: ObsidianGitSettings["diffStyle"]) => {
                            plugin.settings.diffStyle = option;
                            await plugin.saveSettings();
                        }
                    );
                });
        }

        new Setting(containerEl)
            .setName(t("settings.disable_info_notifications"))
            .setDesc(
                t("settings.disable_info_notifications_desc")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.disablePopups)
                    .onChange(async (value) => {
                        plugin.settings.disablePopups = value;
                        this.refreshDisplayWithDelay();
                        await plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.disable_error_notifications"))
            .setDesc(
                t("settings.disable_error_notifications_desc")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(!plugin.settings.showErrorNotices)
                    .onChange(async (value) => {
                        plugin.settings.showErrorNotices = !value;
                        await plugin.saveSettings();
                    })
            );

        if (!plugin.settings.disablePopups)
            new Setting(containerEl)
                .setName(t("settings.hide_no_changes_notifications"))
                .setDesc(
                    t("settings.hide_no_changes_notifications_desc")
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.disablePopupsForNoChanges)
                        .onChange(async (value) => {
                            plugin.settings.disablePopupsForNoChanges = value;
                            await plugin.saveSettings();
                        })
                );

        new Setting(containerEl)
            .setName(t("settings.show_status_bar"))
            .setDesc(
                t("settings.restart_required")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showStatusBar)
                    .onChange(async (value) => {
                        plugin.settings.showStatusBar = value;
                        await plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.file_menu_integration"))
            .setDesc(
                t("settings.file_menu_integration_desc")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showFileMenu)
                    .onChange(async (value) => {
                        plugin.settings.showFileMenu = value;
                        await plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.show_branch_status_bar"))
            .setDesc(
                t("settings.restart_required")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showBranchStatusBar)
                    .onChange(async (value) => {
                        plugin.settings.showBranchStatusBar = value;
                        await plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.show_changed_files_count"))
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.changedFilesInStatusBar)
                    .onChange(async (value) => {
                        plugin.settings.changedFilesInStatusBar = value;
                        await plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("settings.language"))
            .setDesc(t("settings.language_desc"))
            .addDropdown((dropdown) => {
                dropdown.addOptions({
                    auto: t("settings.language.auto"),
                    en: t("settings.language.en"),
                    zh: t("settings.language.zh"),
                });
                dropdown.setValue(plugin.settings.localeOverride);
                dropdown.onChange(async (value: "auto" | "en" | "zh") => {
                    plugin.settings.localeOverride = value;
                    setLocaleOverride(value);
                    await plugin.saveSettings();
                    this.refreshDisplayWithDelay();
                });
            });

        if (plugin.gitManager instanceof IsomorphicGit) {
            new Setting(containerEl)
                .setName(t("settings.heading.auth_commit_author"))
                .setHeading();
        } else {
            new Setting(containerEl).setName(t("settings.heading.commit_author")).setHeading();
        }

        if (plugin.gitManager instanceof IsomorphicGit)
            new Setting(containerEl)
                .setName(
                    t("settings.username")
                )
                .addText((cb) => {
                    cb.setValue(plugin.localStorage.getUsername() ?? "");
                    cb.onChange((value) => {
                        plugin.localStorage.setUsername(value);
                    });
                });

        if (plugin.gitManager instanceof IsomorphicGit)
            new Setting(containerEl)
                .setName(t("settings.password"))
                .setDesc(
                    t("settings.password_desc")
                )
                .addText((cb) => {
                    cb.inputEl.autocapitalize = "off";
                    cb.inputEl.autocomplete = "off";
                    cb.inputEl.spellcheck = false;
                    cb.onChange((value) => {
                        plugin.localStorage.setPassword(value);
                    });
                });

        if (plugin.gitReady)
            new Setting(containerEl)
                .setName(t("settings.author_name"))
                .addText(async (cb) => {
                    cb.setValue(
                        (await plugin.gitManager.getConfig("user.name")) ?? ""
                    );
                    cb.onChange(async (value) => {
                        await plugin.gitManager.setConfig(
                            "user.name",
                            value == "" ? undefined : value
                        );
                    });
                });

        if (plugin.gitReady)
            new Setting(containerEl)
                .setName(t("settings.author_email"))
                .addText(async (cb) => {
                    cb.setValue(
                        (await plugin.gitManager.getConfig("user.email")) ?? ""
                    );
                    cb.onChange(async (value) => {
                        await plugin.gitManager.setConfig(
                            "user.email",
                            value == "" ? undefined : value
                        );
                    });
                });

        new Setting(containerEl)
            .setName(t("settings.heading.advanced"))
            .setDesc(
                t("settings.advanced_desc")
            )
            .setHeading();

        if (plugin.gitManager instanceof SimpleGit) {
            new Setting(containerEl)
                .setName(t("settings.update_submodules"))
                .setDesc(
                    t("settings.update_submodules_desc")
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.updateSubmodules)
                        .onChange(async (value) => {
                            plugin.settings.updateSubmodules = value;
                            await plugin.saveSettings();
                        })
                );
            if (plugin.settings.updateSubmodules) {
                new Setting(containerEl)
                    .setName(t("settings.submodule_recurse_checkout"))
                    .setDesc(
                        t("settings.submodule_recurse_checkout_desc")
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(plugin.settings.submoduleRecurseCheckout)
                            .onChange(async (value) => {
                                plugin.settings.submoduleRecurseCheckout =
                                    value;
                                await plugin.saveSettings();
                            })
                    );
            }
        }

        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName(t("settings.custom_git_path"))
                .setDesc(
                    t("settings.custom_git_path_desc")
                )
                .addText((cb) => {
                    cb.setValue(plugin.localStorage.getGitPath() ?? "");
                    cb.setPlaceholder("git");
                    cb.onChange((value) => {
                        plugin.localStorage.setGitPath(value);
                        plugin.gitManager
                            .updateGitPath(value || "git")
                            .catch((e) => plugin.displayError(e));
                    });
                });

        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName(t("settings.additional_env_vars"))
                .setDesc(
                    t("settings.additional_env_vars_desc")
                )
                .addTextArea((cb) => {
                    cb.setPlaceholder("GIT_DIR=/path/to/git/dir");
                    cb.setValue(plugin.localStorage.getEnvVars().join("\n"));
                    cb.onChange((value) => {
                        plugin.localStorage.setEnvVars(value.split("\n"));
                    });
                });

        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName(t("settings.additional_path"))
                .setDesc(t("settings.additional_path_desc"))
                .addTextArea((cb) => {
                    cb.setValue(plugin.localStorage.getPATHPaths().join("\n"));
                    cb.onChange((value) => {
                        plugin.localStorage.setPATHPaths(value.split("\n"));
                    });
                });
        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName(t("settings.reload_env_vars"))
                .setDesc(
                    t("settings.reload_env_vars_desc")
                )
                .addButton((cb) => {
                    cb.setButtonText(t("settings.reload_button"));
                    cb.setCta();
                    cb.onClick(async () => {
                        await (plugin.gitManager as SimpleGit).setGitInstance();
                    });
                });

        new Setting(containerEl)
            .setName(t("settings.custom_base_path"))
            .setDesc(
                t("settings.custom_base_path_desc")
            )
            .addText((cb) => {
                cb.setValue(plugin.settings.basePath);
                cb.setPlaceholder("directory/directory-with-git-repo");
                cb.onChange(async (value) => {
                    plugin.settings.basePath = value;
                    await plugin.saveSettings();
                    plugin.gitManager
                        .updateBasePath(value || "")
                        .catch((e) => plugin.displayError(e));
                });
            });

        new Setting(containerEl)
            .setName(t("settings.custom_git_dir"))
            .setDesc(
                t("settings.custom_git_dir_desc")
            )
            .addText((cb) => {
                cb.setValue(plugin.settings.gitDir);
                cb.setPlaceholder(".git");
                cb.onChange(async (value) => {
                    plugin.settings.gitDir = value;
                    await plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName(t("settings.disable_on_device"))
            .setDesc(
                t("settings.disable_on_device_desc")
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.localStorage.getPluginDisabled())
                    .onChange((value) => {
                        plugin.localStorage.setPluginDisabled(value);
                        if (value) {
                            plugin.unloadPlugin();
                        } else {
                            plugin
                                .init({ fromReload: true })
                                .catch((e) => plugin.displayError(e));
                        }
                        new Notice(
                            t("settings.restart_required")
                        );
                    })
            );

        new Setting(containerEl).setName(t("settings.heading.support")).setHeading();
        new Setting(containerEl)
            .setName(t("settings.donate"))
            .setDesc(
                t("settings.donate_desc")
            )
            .addButton((bt) => {
                const link = bt.buttonEl.parentElement?.createEl("a", {
                    href: "https://ko-fi.com/F1F195IQ5",
                    attr: {
                        target: "_blank",
                    },
                });
                if (link) {
                    link.createEl("img", {
                        attr: {
                            height: "36",
                            style: "border:0px;height:36px;",
                            src: "https://cdn.ko-fi.com/cdn/kofi3.png?v=3",
                            border: "0",
                            alt: "Buy Me a Coffee at ko-fi.com",
                        },
                    });
                    bt.buttonEl.remove();
                }
            });

        const debugDiv = containerEl.createDiv();
        debugDiv.setAttr("align", "center");
        debugDiv.setAttr("style", "margin: var(--size-4-2)");

        const debugButton = debugDiv.createEl("button");
        debugButton.setText(t("settings.copy_debug_info"));
        debugButton.onclick = async () => {
            await window.navigator.clipboard.writeText(
                JSON.stringify(
                    {
                        settings: this.plugin.settings,
                        pluginVersion: this.plugin.manifest.version,
                    },
                    null,
                    4
                )
            );
            new Notice(
                t("settings.debug_info_copied")
            );
        };

        if (Platform.isDesktopApp) {
            const info = containerEl.createDiv();
            info.setAttr("align", "center");
            info.setText(
                t("settings.debugging_info")
            );
            const keys = containerEl.createDiv();
            keys.setAttr("align", "center");
            keys.addClass("obsidian-git-shortcuts");
            if (Platform.isMacOS === true) {
                keys.createEl("kbd", { text: "CMD (⌘) + OPTION (⌥) + I" });
            } else {
                keys.createEl("kbd", { text: "CTRL + SHIFT + I" });
            }
        }
    }

    mayDisableSetting(setting: Setting, disable: boolean) {
        if (disable) {
            setting.setDisabled(disable);
            setting.setClass("obsidian-git-disabled");
        }
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

    private addLineAuthorInfoSettings() {
        const baseLineAuthorInfoSetting = new Setting(this.containerEl).setName(
            t("settings.show_commit_authoring")
        );

        if (
            !this.plugin.editorIntegration.lineAuthoringFeature.isAvailableOnCurrentPlatform()
        ) {
            baseLineAuthorInfoSetting
                .setDesc(t("settings.only_desktop"))
                .setDisabled(true);
        }

        baseLineAuthorInfoSetting.descEl.createEl("a", {
            href: LINE_AUTHOR_FEATURE_WIKI_LINK,
            text: t("settings.feature_guide"),
            attr: {
                target: "_blank",
            },
        });
        baseLineAuthorInfoSetting.descEl.createEl("br");
        baseLineAuthorInfoSetting.descEl.createSpan({
            text: t("settings.commit_hash_toggle_desc"),
        });
        baseLineAuthorInfoSetting.descEl.createEl("br");
        baseLineAuthorInfoSetting.descEl.createSpan({
            text: t("settings.hide_everything_desc"),
        });

        baseLineAuthorInfoSetting.addToggle((toggle) =>
            toggle.setValue(this.settings.lineAuthor.show).onChange((value) => {
                this.configureLineAuthorShowStatus(value);
                this.refreshDisplayWithDelay();
            })
        );

        if (this.settings.lineAuthor.show) {
            const trackMovement = new Setting(this.containerEl)
                .setName(t("settings.follow_movement"))
                .addDropdown((dropdown) => {
                    dropdown.addOptions({
                        inactive: t("settings.follow_inactive"),
                        "same-commit": t("settings.follow_same_commit"),
                        "all-commits": t("settings.follow_all_commits"),
                    });
                    dropdown.setValue(this.settings.lineAuthor.followMovement);
                    dropdown.onChange((value: LineAuthorFollowMovement) =>
                        this.lineAuthorSettingHandler("followMovement", value)
                    );
                });

            trackMovement.descEl.createSpan({
                text: t("settings.follow_movement_desc_default"),
            });
            trackMovement.descEl.createEl("br");
            trackMovement.descEl.createSpan({ text: t("settings.follow_movement_same_commit_desc") });
            trackMovement.descEl.createEl("br");
            trackMovement.descEl.createSpan({ text: t("settings.follow_movement_all_commits_desc") });
            trackMovement.descEl.createEl("br");
            trackMovement.descEl.createSpan({ text: t("settings.follow_movement_blame_desc", { minLength: GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH }) });

            new Setting(this.containerEl)
                .setName(t("settings.show_commit_hash"))
                .addToggle((tgl) => {
                    tgl.setValue(this.settings.lineAuthor.showCommitHash);
                    tgl.onChange((value: boolean) =>
                        this.lineAuthorSettingHandler("showCommitHash", value)
                    );
                });

            new Setting(this.containerEl)
                .setName(t("settings.author_name_display"))
                .setDesc(t("settings.author_name_display_desc"))
                .addDropdown((dropdown) => {
                    const options: Record<LineAuthorDisplay, string> = {
                        hide: t("settings.author_display.hide"),
                        initials: t("settings.author_display.initials"),
                        "first name": t("settings.author_display.first_name"),
                        "last name": t("settings.author_display.last_name"),
                        full: t("settings.author_display.full"),
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(this.settings.lineAuthor.authorDisplay);

                    dropdown.onChange(async (value: LineAuthorDisplay) =>
                        this.lineAuthorSettingHandler("authorDisplay", value)
                    );
                });

            new Setting(this.containerEl)
                .setName(t("settings.authoring_date_display"))
                .setDesc(
                    t("settings.authoring_date_display_desc")
                )
                .addDropdown((dropdown) => {
                    const options: Record<
                        LineAuthorDateTimeFormatOptions,
                        string
                    > = {
                        hide: t("settings.date_format.hide"),
                        date: t("settings.date_format.date"),
                        datetime: t("settings.date_format.datetime"),
                        "natural language": t("settings.date_format.natural"),
                        custom: t("settings.date_format.custom"),
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(
                        this.settings.lineAuthor.dateTimeFormatOptions
                    );

                    dropdown.onChange(
                        async (value: LineAuthorDateTimeFormatOptions) => {
                            await this.lineAuthorSettingHandler(
                                "dateTimeFormatOptions",
                                value
                            );
                            this.refreshDisplayWithDelay();
                        }
                    );
                });

            if (this.settings.lineAuthor.dateTimeFormatOptions === "custom") {
                const dateTimeFormatCustomStringSetting = new Setting(
                    this.containerEl
                );

                dateTimeFormatCustomStringSetting
                    .setName(t("settings.custom_date_format"))
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

            const timezoneSetting = new Setting(this.containerEl)
                .setName(t("settings.date_timezone"))
                .addDropdown((dropdown) => {
                    const options: Record<LineAuthorTimezoneOption, string> = {
                        "viewer-local": t("settings.timezone.viewer_local"),
                        "author-local": t("settings.timezone.author_local"),
                        utc0000: t("settings.timezone.utc"),
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(
                        this.settings.lineAuthor.dateTimeTimezone
                    );

                    dropdown.onChange(async (value: LineAuthorTimezoneOption) =>
                        this.lineAuthorSettingHandler("dateTimeTimezone", value)
                    );
                });
            timezoneSetting.descEl.empty();
            timezoneSetting.descEl.createSpan({
                text: t("settings.date_timezone_desc"),
            });
            timezoneSetting.descEl.createEl("a", {
                text: "UTC±00:00",
                href: "https://en.wikipedia.org/wiki/UTC%C2%B100:00",
            });
            timezoneSetting.descEl.createSpan({
                text: ".",
            });

            const oldestAgeSetting = new Setting(this.containerEl).setName(
                t("settings.oldest_age")
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

            this.createColorSetting("newest");
            this.createColorSetting("oldest");

            const textColorSetting = new Setting(this.containerEl)
                .setName(t("settings.text_color"))
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
                text: t("settings.text_color_desc"),
            });
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createSpan({
                text: t("settings.use_css_vars"),
            });
            textColorSetting.descEl.createEl("a", {
                text: t("settings.css_variables"),
                href: "https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties",
            });
            textColorSetting.descEl.createSpan({
                text: t("settings.css_vars_suffix"),
            });
            textColorSetting.descEl.createEl("pre", {
                text: "var(--text-muted)",
                attr: {
                    style: "display:inline",
                },
            });
            textColorSetting.descEl.createSpan({ text: t("settings.css_vars_suffix2") });
            textColorSetting.descEl.createEl("pre", {
                text: "var(--text-on-accent)",
                attr: {
                    style: "display:inline",
                },
            });
            textColorSetting.descEl.createSpan({
                text: t("settings.css_vars_suffix3"),
            });
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createEl("br");
            textColorSetting.descEl.createSpan({ text: t("settings.see_css_vars") });
            textColorSetting.descEl.createEl("a", {
                text: t("settings.css_vars_list"),
                href: "https://github.com/obsidian-community/obsidian-theme-template/blob/main/obsidian.css",
            });

            const ignoreWhitespaceSetting = new Setting(this.containerEl)
                .setName(t("settings.ignore_whitespace"))
                .addToggle((tgl) => {
                    tgl.setValue(this.settings.lineAuthor.ignoreWhitespace);
                    tgl.onChange((value) =>
                        this.lineAuthorSettingHandler("ignoreWhitespace", value)
                    );
                });
            ignoreWhitespaceSetting.descEl.empty();
            ignoreWhitespaceSetting.descEl.createSpan({
                text: t("settings.ignore_whitespace_desc"),
            });
            ignoreWhitespaceSetting.descEl.createEl("br");
            ignoreWhitespaceSetting.descEl.createSpan({
                text: t("settings.ignore_whitespace_desc2"),
            });
        }
    }

    private createColorSetting(which: "oldest" | "newest") {
        const setting = new Setting(this.containerEl)
            .setName("")
            .addText((text) => {
                const color = pickColor(which, this.settings.lineAuthor);
                const defaultColor = pickColor(
                    which,
                    DEFAULT_SETTINGS.lineAuthor
                );
                text.setPlaceholder(rgbToString(defaultColor));
                text.setValue(rgbToString(color));
                text.onChange(async (colorNew) => {
                    const rgb = convertToRgb(colorNew);
                    if (rgb !== undefined) {
                        const key =
                            which === "newest" ? "colorNew" : "colorOld";
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
            if (which === "oldest") {
                settingsDom.nameEl.setText(t("settings.color_for_oldest", { age: this.settings.lineAuthor.coloringMaxAge }));
            } else {
                settingsDom.nameEl.setText(t("settings.color_for_newest"));
            }
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
            text: t("settings.color_preview_desc"),
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
            text: t("settings.format_string"),
            href: FORMAT_STRING_REFERENCE_URL,
        });
        descEl.createSpan({
            text: t("settings.custom_date_format_desc"),
        });
        descEl.createEl("br");
        const formattedDateTime = moment().format(dateTimeFormatCustomString);
        descEl.createSpan({
            text: t("settings.currently", { value: formattedDateTime }),
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
            text: t("settings.oldest_age_desc", { value: durationString }),
        });
    }

    /**
     * Sets the value in the textbox for a given setting only if the saved value differs from the default value.
     * If the saved value is the default value, it probably wasn't defined by the user, so it's better to display it as a placeholder.
     */
    private setNonDefaultValue({
        settingsProperty,
        text,
    }: {
        settingsProperty: keyof ObsidianGitSettings;
        text: TextComponent | TextAreaComponent;
    }): void {
        const storedValue = this.plugin.settings[settingsProperty];
        const defaultValue = DEFAULT_SETTINGS[settingsProperty];

        if (defaultValue !== storedValue) {
            // Doesn't add "" to saved strings
            if (
                typeof storedValue === "string" ||
                typeof storedValue === "number" ||
                typeof storedValue === "boolean"
            ) {
                text.setValue(String(storedValue));
            } else {
                text.setValue(JSON.stringify(storedValue));
            }
        }
    }

    /**
     * Delays the update of the settings UI.
     * Used when the user toggles one of the settings that control enabled states of other settings. Delaying the update
     * allows most of the toggle animation to run, instead of abruptly jumping between enabled/disabled states.
     */
    private refreshDisplayWithDelay(timeout = 80): void {
        window.setTimeout(() => this.display(), timeout);
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
