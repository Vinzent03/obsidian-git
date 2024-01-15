import {
    moment,
    Notice,
    Platform,
    PluginSettingTab,
    RGB,
    Setting,
} from "obsidian";
import {
    DATE_TIME_FORMAT_SECONDS,
    DEFAULT_SETTINGS,
    GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH,
} from "src/constants";
import { IsomorphicGit } from "src/gitManager/isomorphicGit";
import { SimpleGit } from "src/gitManager/simpleGit";
import { previewColor } from "src/lineAuthor/lineAuthorProvider";
import {
    LineAuthorDateTimeFormatOptions,
    LineAuthorDisplay,
    LineAuthorFollowMovement,
    LineAuthorSettings,
    LineAuthorTimezoneOption,
} from "src/lineAuthor/model";
import ObsidianGit from "src/main";
import { ObsidianGitSettings, SyncMethod } from "src/types";
import { convertToRgb, rgbToString, formatMinutes } from "src/utils";

const FORMAT_STRING_REFERENCE_URL =
    "https://momentjs.com/docs/#/parsing/string-format/";
const LINE_AUTHOR_FEATURE_WIKI_LINK =
    "https://publish.obsidian.md/git-doc/Line+Authoring";

export class ObsidianGitSettingsTab extends PluginSettingTab {
    lineAuthorColorSettings: Map<"oldest" | "newest", Setting> = new Map();

    declare plugin: ObsidianGit; // narrow type from PluginSettingTab.plugin

    private get settings() {
        return this.plugin.settings;
    }

    display(): void {
        const { containerEl } = this;
        const plugin: ObsidianGit = (this as any).plugin;
        const commitOrBackup = plugin.settings.differentIntervalCommitAndPush
            ? "commit"
            : "backup";
        const gitReady = plugin.gitReady;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Git Backup settings" });
        if (!gitReady) {
            containerEl.createEl("p", {
                text: "Git is not ready. When all settings are correct you can configure auto backup, etc.",
            });
        }

        if (gitReady) {
            containerEl.createEl("br");
            containerEl.createEl("h3", { text: "Automatic" });
            new Setting(containerEl)
                .setName("Split automatic commit and push")
                .setDesc("Enable to use separate timer for commit and push")
                .addToggle((toggle) =>
                    toggle
                        .setValue(
                            plugin.settings.differentIntervalCommitAndPush
                        )
                        .onChange((value) => {
                            plugin.settings.differentIntervalCommitAndPush =
                                value;
                            plugin.saveSettings();
                            plugin.clearAutoBackup();
                            plugin.clearAutoPush();
                            if (plugin.settings.autoSaveInterval > 0) {
                                plugin.startAutoBackup(
                                    plugin.settings.autoSaveInterval
                                );
                            }
                            if (value && plugin.settings.autoPushInterval > 0) {
                                plugin.startAutoPush(
                                    plugin.settings.autoPushInterval
                                );
                            }
                            this.display();
                        })
                );

            new Setting(containerEl)
                .setName(`Vault ${commitOrBackup} interval (minutes)`)
                .setDesc(
                    `${
                        plugin.settings.differentIntervalCommitAndPush
                            ? "Commit"
                            : "Commit and push"
                    } changes every X minutes. Set to 0 (default) to disable. (See below setting for further configuration!)`
                )
                .addText((text) =>
                    text
                        .setValue(String(plugin.settings.autoSaveInterval))
                        .onChange((value) => {
                            if (!isNaN(Number(value))) {
                                plugin.settings.autoSaveInterval =
                                    Number(value);
                                plugin.saveSettings();

                                if (plugin.settings.autoSaveInterval > 0) {
                                    plugin.clearAutoBackup();
                                    plugin.startAutoBackup(
                                        plugin.settings.autoSaveInterval
                                    );
                                    new Notice(
                                        `Automatic ${commitOrBackup} enabled! Every ${formatMinutes(
                                            plugin.settings.autoSaveInterval
                                        )}.`
                                    );
                                } else if (
                                    plugin.settings.autoSaveInterval <= 0
                                ) {
                                    plugin.clearAutoBackup() &&
                                        new Notice(
                                            `Automatic ${commitOrBackup} disabled!`
                                        );
                                }
                            } else {
                                new Notice("Please specify a valid number.");
                            }
                        })
                );

            if (!plugin.settings.setLastSaveToLastCommit)
                new Setting(containerEl)
                    .setName(`Auto Backup after stopping file edits`)
                    .setDesc(
                        `Requires the ${commitOrBackup} interval not to be 0.
                        If turned on, do auto ${commitOrBackup} every ${formatMinutes(
                            plugin.settings.autoSaveInterval
                        )} after stopping file edits.
                        This also prevents auto ${commitOrBackup} while editing a file. If turned off, it's independent from the last change.`
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(plugin.settings.autoBackupAfterFileChange)
                            .onChange((value) => {
                                plugin.settings.autoBackupAfterFileChange =
                                    value;
                                this.display();
                                plugin.saveSettings();
                                plugin.clearAutoBackup();
                                if (plugin.settings.autoSaveInterval > 0) {
                                    plugin.startAutoBackup(
                                        plugin.settings.autoSaveInterval
                                    );
                                }
                            })
                    );

            if (!plugin.settings.autoBackupAfterFileChange)
                new Setting(containerEl)
                    .setName(`Auto ${commitOrBackup} after latest commit`)
                    .setDesc(
                        `If turned on, set last auto ${commitOrBackup} time to latest commit`
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(plugin.settings.setLastSaveToLastCommit)
                            .onChange(async (value) => {
                                plugin.settings.setLastSaveToLastCommit = value;
                                plugin.saveSettings();
                                this.display();
                                plugin.clearAutoBackup();
                                await plugin.setUpAutoBackup();
                            })
                    );

            if (plugin.settings.differentIntervalCommitAndPush) {
                new Setting(containerEl)
                    .setName(`Vault push interval (minutes)`)
                    .setDesc(
                        "Push changes every X minutes. Set to 0 (default) to disable."
                    )
                    .addText((text) =>
                        text
                            .setValue(String(plugin.settings.autoPushInterval))
                            .onChange((value) => {
                                if (!isNaN(Number(value))) {
                                    plugin.settings.autoPushInterval =
                                        Number(value);
                                    plugin.saveSettings();

                                    if (plugin.settings.autoPushInterval > 0) {
                                        plugin.clearAutoPush();
                                        plugin.startAutoPush(
                                            plugin.settings.autoPushInterval
                                        );
                                        new Notice(
                                            `Automatic push enabled! Every ${formatMinutes(
                                                plugin.settings.autoPushInterval
                                            )}.`
                                        );
                                    } else if (
                                        plugin.settings.autoPushInterval <= 0
                                    ) {
                                        plugin.clearAutoPush() &&
                                            new Notice(
                                                "Automatic push disabled!"
                                            );
                                    }
                                } else {
                                    new Notice(
                                        "Please specify a valid number."
                                    );
                                }
                            })
                    );
            }

            new Setting(containerEl)
                .setName("Auto pull interval (minutes)")
                .setDesc(
                    "Pull changes every X minutes. Set to 0 (default) to disable."
                )
                .addText((text) =>
                    text
                        .setValue(String(plugin.settings.autoPullInterval))
                        .onChange((value) => {
                            if (!isNaN(Number(value))) {
                                plugin.settings.autoPullInterval =
                                    Number(value);
                                plugin.saveSettings();

                                if (plugin.settings.autoPullInterval > 0) {
                                    plugin.clearAutoPull();
                                    plugin.startAutoPull(
                                        plugin.settings.autoPullInterval
                                    );
                                    new Notice(
                                        `Automatic pull enabled! Every ${formatMinutes(
                                            plugin.settings.autoPullInterval
                                        )}.`
                                    );
                                } else if (
                                    plugin.settings.autoPullInterval <= 0
                                ) {
                                    plugin.clearAutoPull() &&
                                        new Notice("Automatic pull disabled!");
                                }
                            } else {
                                new Notice("Please specify a valid number.");
                            }
                        })
                );

            new Setting(containerEl)
                .setName("Specify custom commit message on auto backup")
                .setDesc("You will get a pop up to specify your message")
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.customMessageOnAutoBackup)
                        .onChange((value) => {
                            plugin.settings.customMessageOnAutoBackup = value;
                            plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName("Commit message on auto backup/commit")
                .setDesc(
                    "Available placeholders: {{date}}" +
                        " (see below), {{hostname}} (see below), {{numFiles}} (number of changed files in the commit) and {{files}} (changed files in commit message)"
                )
                .addTextArea((text) =>
                    text
                        .setPlaceholder("vault backup: {{date}}")
                        .setValue(plugin.settings.autoCommitMessage)
                        .onChange((value) => {
                            plugin.settings.autoCommitMessage = value;
                            plugin.saveSettings();
                        })
                );

            containerEl.createEl("br");
            containerEl.createEl("h3", { text: "Commit message" });

            new Setting(containerEl)
                .setName("Commit message on manual backup/commit")
                .setDesc(
                    "Available placeholders: {{date}}" +
                        " (see below), {{hostname}} (see below), {{numFiles}} (number of changed files in the commit) and {{files}} (changed files in commit message)"
                )
                .addTextArea((text) =>
                    text
                        .setPlaceholder("vault backup: {{date}}")
                        .setValue(
                            plugin.settings.commitMessage
                                ? plugin.settings.commitMessage
                                : ""
                        )
                        .onChange((value) => {
                            plugin.settings.commitMessage = value;
                            plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName("{{date}} placeholder format")
                .setDesc(
                    `Specify custom date format. E.g. "${DATE_TIME_FORMAT_SECONDS}"`
                )
                .addText((text) =>
                    text
                        .setPlaceholder(plugin.settings.commitDateFormat)
                        .setValue(plugin.settings.commitDateFormat)
                        .onChange(async (value) => {
                            plugin.settings.commitDateFormat = value;
                            await plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName("{{hostname}} placeholder replacement")
                .setDesc("Specify custom hostname for every device.")
                .addText((text) =>
                    text
                        .setValue(plugin.localStorage.getHostname() ?? "")
                        .onChange(async (value) => {
                            plugin.localStorage.setHostname(value);
                        })
                );

            new Setting(containerEl)
                .setName("Preview commit message")
                .addButton((button) =>
                    button.setButtonText("Preview").onClick(async () => {
                        const commitMessagePreview =
                            await plugin.gitManager.formatCommitMessage(
                                plugin.settings.commitMessage
                            );
                        new Notice(`${commitMessagePreview}`);
                    })
                );

            new Setting(containerEl)
                .setName("List filenames affected by commit in the commit body")
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.listChangedFilesInMessageBody)
                        .onChange((value) => {
                            plugin.settings.listChangedFilesInMessageBody =
                                value;
                            plugin.saveSettings();
                        })
                );

            containerEl.createEl("br");
            containerEl.createEl("h3", { text: "Backup" });

            if (plugin.gitManager instanceof SimpleGit)
                new Setting(containerEl)
                    .setName("Sync Method")
                    .setDesc(
                        "Selects the method used for handling new changes found in your remote git repository."
                    )
                    .addDropdown((dropdown) => {
                        const options: Record<SyncMethod, string> = {
                            merge: "Merge",
                            rebase: "Rebase",
                            reset: "Other sync service (Only updates the HEAD without touching the working directory)",
                        };
                        dropdown.addOptions(options);
                        dropdown.setValue(plugin.settings.syncMethod);

                        dropdown.onChange(async (option: SyncMethod) => {
                            plugin.settings.syncMethod = option;
                            plugin.saveSettings();
                        });
                    });

            new Setting(containerEl)
                .setName("Pull updates on startup")
                .setDesc("Automatically pull updates when Obsidian starts")
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.autoPullOnBoot)
                        .onChange((value) => {
                            plugin.settings.autoPullOnBoot = value;
                            plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName("Push on backup")
                .setDesc("Disable to only commit changes")
                .addToggle((toggle) =>
                    toggle
                        .setValue(!plugin.settings.disablePush)
                        .onChange((value) => {
                            plugin.settings.disablePush = !value;
                            plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName("Pull changes before push")
                .setDesc("Commit -> pull -> push (Only if pushing is enabled)")
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.pullBeforePush)
                        .onChange((value) => {
                            plugin.settings.pullBeforePush = value;
                            plugin.saveSettings();
                        })
                );

            if (plugin.gitManager instanceof SimpleGit) {
                containerEl.createEl("br");
                containerEl.createEl("h3", { text: "Line author information" });

                this.addLineAuthorInfoSettings();
            }
        }

        containerEl.createEl("br");
        containerEl.createEl("h3", { text: "Miscellaneous" });

        new Setting(containerEl)
            .setName(
                "Automatically refresh Source Control View on file changes"
            )
            .setDesc(
                "On slower machines this may cause lags. If so, just disable this option"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.refreshSourceControl)
                    .onChange((value) => {
                        plugin.settings.refreshSourceControl = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Source Control View refresh interval")
            .setDesc(
                "Milliseconds to wait after file change before refreshing the Source Control View"
            )
            .addText((toggle) =>
                toggle
                    .setValue(
                        plugin.settings.refreshSourceControlTimer.toString()
                    )
                    .setPlaceholder("7000")
                    .onChange((value) => {
                        plugin.settings.refreshSourceControlTimer = Math.max(
                            parseInt(value),
                            500
                        );
                        plugin.saveSettings();
                        plugin.setRefreshDebouncer();
                    })
            );

        new Setting(containerEl)
            .setName("Disable notifications")
            .setDesc(
                "Disable notifications for git operations to minimize distraction (refer to status bar for updates). Errors are still shown as notifications even if you enable this setting"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.disablePopups)
                    .onChange((value) => {
                        plugin.settings.disablePopups = value;
                        this.display();
                        plugin.saveSettings();
                    })
            );

        if (!plugin.settings.disablePopups)
        new Setting(containerEl)
            .setName("Hide notifications for no changes")
            .setDesc(
                "Don't show notifications when there are no changes to commit/push"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.disablePopupsForNoChanges)
                    .onChange((value) => {
                        plugin.settings.disablePopupsForNoChanges = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show status bar")
            .setDesc(
                "Obsidian must be restarted for the changes to take affect"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showStatusBar)
                    .onChange((value) => {
                        plugin.settings.showStatusBar = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show stage/unstage button in file menu")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showFileMenu)
                    .onChange((value) => {
                        plugin.settings.showFileMenu = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show branch status bar")
            .setDesc(
                "Obsidian must be restarted for the changes to take affect"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showBranchStatusBar)
                    .onChange((value) => {
                        plugin.settings.showBranchStatusBar = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show the count of modified files in the status bar")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.changedFilesInStatusBar)
                    .onChange((value) => {
                        plugin.settings.changedFilesInStatusBar = value;
                        plugin.saveSettings();
                    })
            );

        containerEl.createEl("br");
        if (plugin.gitManager instanceof IsomorphicGit) {
            containerEl.createEl("h3", {
                text: "Authentication/Commit Author",
            });
        } else {
            containerEl.createEl("h3", { text: "Commit Author" });
        }

        if (plugin.gitManager instanceof IsomorphicGit)
            new Setting(containerEl)
                .setName(
                    "Username on your git server. E.g. your username on GitHub"
                )
                .addText((cb) => {
                    cb.setValue(plugin.localStorage.getUsername() ?? "");
                    cb.onChange((value) => {
                        plugin.localStorage.setUsername(value);
                    });
                });

        if (plugin.gitManager instanceof IsomorphicGit)
            new Setting(containerEl)
                .setName("Password/Personal access token")
                .setDesc(
                    "Type in your password. You won't be able to see it again."
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
                .setName("Author name for commit")
                .addText(async (cb) => {
                    cb.setValue(await plugin.gitManager.getConfig("user.name"));
                    cb.onChange((value) => {
                        plugin.gitManager.setConfig(
                            "user.name",
                            value == "" ? undefined : value
                        );
                    });
                });

        if (plugin.gitReady)
            new Setting(containerEl)
                .setName("Author email for commit")
                .addText(async (cb) => {
                    cb.setValue(
                        await plugin.gitManager.getConfig("user.email")
                    );
                    cb.onChange((value) => {
                        plugin.gitManager.setConfig(
                            "user.email",
                            value == "" ? undefined : value
                        );
                    });
                });

        containerEl.createEl("br");
        containerEl.createEl("h3", { text: "Advanced" });

        if (plugin.gitManager instanceof SimpleGit) {
            new Setting(containerEl)
                .setName("Update submodules")
                .setDesc(
                    '"Create backup" and "pull" takes care of submodules. Missing features: Conflicted files, count of pulled/pushed/committed files. Tracking branch needs to be set for each submodule'
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.updateSubmodules)
                        .onChange((value) => {
                            plugin.settings.updateSubmodules = value;
                            plugin.saveSettings();
                        })
                );
            if (plugin.settings.updateSubmodules) {
                new Setting(containerEl)
                    .setName("Submodule recurse checkout/switch")
                    .setDesc(
                        "Whenever a checkout happens on the root repository, recurse the checkout on the submodules (if the branches exist)."
                    )
                    .addToggle((toggle) =>
                        toggle
                            .setValue(plugin.settings.submoduleRecurseCheckout)
                            .onChange((value) => {
                                plugin.settings.submoduleRecurseCheckout =
                                    value;
                                plugin.saveSettings();
                            })
                    );
            }
        }

        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName("Custom Git binary path")
                .addText((cb) => {
                    cb.setValue(plugin.localStorage.getGitPath() ?? "");
                    cb.setPlaceholder("git");
                    cb.onChange((value) => {
                        plugin.localStorage.setGitPath(value);
                        plugin.gitManager.updateGitPath(value || "git");
                    });
                });

        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName("Additional environment variables")
                .setDesc(
                    "Use each line for a new environment variable in the format KEY=VALUE"
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
                .setName("Additional PATH environment variable paths")
                .setDesc("Use each line for one path")
                .addTextArea((cb) => {
                    cb.setValue(plugin.localStorage.getPATHPaths().join("\n"));
                    cb.onChange((value) => {
                        plugin.localStorage.setPATHPaths(value.split("\n"));
                    });
                });
        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName("Reload with new environment variables")
                .setDesc(
                    "Removing previously added environment variables will not take effect until Obsidian is restarted."
                )
                .addButton((cb) => {
                    cb.setButtonText("Reload");
                    cb.setCta();
                    cb.onClick(() => {
                        (plugin.gitManager as SimpleGit).setGitInstance();
                    });
                });

        new Setting(containerEl)
            .setName("Custom base path (Git repository path)")
            .setDesc(
                `
            Sets the relative path to the vault from which the Git binary should be executed.
             Mostly used to set the path to the Git repository, which is only required if the Git repository is below the vault root directory. Use "\\" instead of "/" on Windows.
            `
            )
            .addText((cb) => {
                cb.setValue(plugin.settings.basePath);
                cb.setPlaceholder("directory/directory-with-git-repo");
                cb.onChange((value) => {
                    plugin.settings.basePath = value;
                    plugin.saveSettings();
                    plugin.gitManager.updateBasePath(value || "");
                });
            });

        new Setting(containerEl)
            .setName("Custom Git directory path (Instead of '.git')")
            .setDesc(
                `Requires restart of Obsidian to take effect. Use "\\" instead of "/" on Windows.`
            )
            .addText((cb) => {
                cb.setValue(plugin.settings.gitDir);
                cb.setPlaceholder(".git");
                cb.onChange((value) => {
                    plugin.settings.gitDir = value;
                    plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName("Disable on this device")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.localStorage.getPluginDisabled())
                    .onChange((value) => {
                        plugin.localStorage.setPluginDisabled(value);
                        if (value) {
                            plugin.unloadPlugin();
                        } else {
                            plugin.loadPlugin();
                        }
                        new Notice(
                            "Obsidian must be restarted for the changes to take affect"
                        );
                    })
            );

        new Setting(containerEl)
            .setName("Donate")
            .setDesc(
                "If you like this Plugin, consider donating to support continued development."
            )
            .addButton((bt) => {
                bt.buttonEl.outerHTML =
                    "<a href='https://ko-fi.com/F1F195IQ5' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://cdn.ko-fi.com/cdn/kofi3.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>";
            });

        const info = containerEl.createDiv();
        info.setAttr("align", "center");
        info.setText(
            "Debugging and logging:\nYou can always see the logs of this and every other plugin by opening the console with"
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

    public configureLineAuthorShowStatus(show: boolean) {
        this.settings.lineAuthor.show = show;
        this.plugin.saveSettings();

        if (show) this.plugin.lineAuthoringFeature.activateFeature();
        else this.plugin.lineAuthoringFeature.deactivateFeature();
    }

    /**
     * Persists the setting {@link key} with value {@link value} and
     * refreshes the line author info views.
     */
    public lineAuthorSettingHandler<
        K extends keyof ObsidianGitSettings["lineAuthor"]
    >(key: K, value: ObsidianGitSettings["lineAuthor"][K]) {
        this.settings.lineAuthor[key] = value;
        this.plugin.saveSettings();
        this.plugin.lineAuthoringFeature.refreshLineAuthorViews();
    }

    /**
     * Ensure, that certain last shown values are persisten in the settings.
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
            "Show commit authoring information next to each line"
        );

        if (!this.plugin.lineAuthoringFeature.isAvailableOnCurrentPlatform()) {
            baseLineAuthorInfoSetting
                .setDesc("Only available on desktop currently.")
                .setDisabled(true);
        }

        baseLineAuthorInfoSetting.descEl.innerHTML = `
            <a href="${LINE_AUTHOR_FEATURE_WIKI_LINK}">Feature guide and quick examples</a></br>
            The commit hash, author name and authoring date can all be individually toggled.</br>Hide everything, to only show the age-colored sidebar.`;

        baseLineAuthorInfoSetting.addToggle((toggle) =>
            toggle.setValue(this.settings.lineAuthor.show).onChange((value) => {
                this.configureLineAuthorShowStatus(value);
                this.display();
            })
        );

        if (this.settings.lineAuthor.show) {
            const trackMovement = new Setting(this.containerEl)
                .setName("Follow movement and copies across files and commits")
                .setDesc("")
                .addDropdown((dropdown) => {
                    dropdown.addOptions(<
                        Record<LineAuthorFollowMovement, string>
                    >{
                        inactive: "Do not follow (default)",
                        "same-commit": "Follow within same commit",
                        "all-commits": "Follow within all commits (maybe slow)",
                    });
                    dropdown.setValue(this.settings.lineAuthor.followMovement);
                    dropdown.onChange((value: LineAuthorFollowMovement) =>
                        this.lineAuthorSettingHandler("followMovement", value)
                    );
                });
            trackMovement.descEl.innerHTML = `
                By default (deactivated), each line only shows the newest commit where it was changed.
                <br/>
                With <i>same commit</i>, cut-copy-paste-ing of text is followed within the same commit and the original commit of authoring will be shown.
                <br/>
                With <i>all commits</i>, cut-copy-paste-ing text inbetween multiple commits will be detected.
                <br/>
                It uses <a href="https://git-scm.com/docs/git-blame">git-blame</a> and
                for matches (at least ${GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH} characters) within the same (or all) commit(s), <em>the originating</em> commit's information is shown.`;

            new Setting(this.containerEl)
                .setName("Show commit hash")
                .addToggle((tgl) => {
                    tgl.setValue(this.settings.lineAuthor.showCommitHash);
                    tgl.onChange(async (value: boolean) =>
                        this.lineAuthorSettingHandler("showCommitHash", value)
                    );
                });

            new Setting(this.containerEl)
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

                    dropdown.onChange(async (value: LineAuthorDisplay) =>
                        this.lineAuthorSettingHandler("authorDisplay", value)
                    );
                });

            new Setting(this.containerEl)
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

                    dropdown.onChange(
                        async (value: LineAuthorDateTimeFormatOptions) => {
                            this.lineAuthorSettingHandler(
                                "dateTimeFormatOptions",
                                value
                            );
                            this.display();
                        }
                    );
                });

            if (this.settings.lineAuthor.dateTimeFormatOptions === "custom") {
                const dateTimeFormatCustomStringSetting = new Setting(
                    this.containerEl
                );

                dateTimeFormatCustomStringSetting
                    .setName("Custom authoring date format")
                    .addText((cb) => {
                        cb.setValue(
                            this.settings.lineAuthor.dateTimeFormatCustomString
                        );
                        cb.setPlaceholder("YYYY-MM-DD HH:mm");

                        cb.onChange((value) => {
                            this.lineAuthorSettingHandler(
                                "dateTimeFormatCustomString",
                                value
                            );
                            dateTimeFormatCustomStringSetting.descEl.innerHTML =
                                this.previewCustomDateTimeDescriptionHtml(
                                    value
                                );
                        });
                    });

                dateTimeFormatCustomStringSetting.descEl.innerHTML =
                    this.previewCustomDateTimeDescriptionHtml(
                        this.settings.lineAuthor.dateTimeFormatCustomString
                    );
            }

            new Setting(this.containerEl)
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

                    dropdown.onChange(async (value: LineAuthorTimezoneOption) =>
                        this.lineAuthorSettingHandler("dateTimeTimezone", value)
                    );
                }).descEl.innerHTML = `
                    The time-zone in which the authoring date should be shown.
                    Either your local time-zone (default),
                    the author's time-zone during commit creation or
                    <a href="https://en.wikipedia.org/wiki/UTC%C2%B100:00">UTC±00:00</a>.
            `;

            const oldestAgeSetting = new Setting(this.containerEl).setName(
                "Oldest age in coloring"
            );

            oldestAgeSetting.descEl.innerHTML =
                this.previewOldestAgeDescriptionHtml(
                    this.settings.lineAuthor.coloringMaxAge
                )[0];

            oldestAgeSetting.addText((text) => {
                text.setPlaceholder("1y");
                text.setValue(this.settings.lineAuthor.coloringMaxAge);
                text.onChange((value) => {
                    const [preview, valid] =
                        this.previewOldestAgeDescriptionHtml(value);
                    oldestAgeSetting.descEl.innerHTML = preview;
                    if (valid) {
                        this.lineAuthorSettingHandler("coloringMaxAge", value);
                        this.refreshColorSettingsName("oldest");
                    }
                });
            });

            this.createColorSetting("newest");
            this.createColorSetting("oldest");

            new Setting(this.containerEl)
                .setName("Text color")
                .addText((field) => {
                    field.setValue(this.settings.lineAuthor.textColorCss);
                    field.onChange((value) => {
                        this.lineAuthorSettingHandler("textColorCss", value);
                    });
                }).descEl.innerHTML = `
                    The CSS color of the gutter text.<br/>
                    
                    It is higly recommended to use
                    <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties">
                    CSS variables</a>
                    defined by themes
                    (e.g. <pre style="display:inline">var(--text-muted)</pre> or
                    <pre style="display:inline">var(--text-on-accent)</pre>,
                    because they automatically adapt to theme changes.<br/>

                    See: <a href="https://github.com/obsidian-community/obsidian-theme-template/blob/main/obsidian.css">
                    List of available CSS variables in Obsidian
                    <a/>
                `;

            new Setting(this.containerEl)
                .setName("Ignore whitespace and newlines in changes")
                .addToggle((tgl) => {
                    tgl.setValue(this.settings.lineAuthor.ignoreWhitespace);
                    tgl.onChange((value) =>
                        this.lineAuthorSettingHandler("ignoreWhitespace", value)
                    );
                }).descEl.innerHTML = `
                    Whitespace and newlines are interpreted as
                    part of the document and in changes
                    by default (hence not ignored).
                    This makes the last line being shown as 'changed'
                    when a new subsequent line is added,
                    even if the previously last line's text is the same.
                    <br>
                    If you don't care about purely-whitespace changes
                    (e.g. list nesting / quote indentation changes),
                    then activating this will provide more meaningful change detection.
                `;
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
                text.onChange((colorNew) => {
                    const rgb = convertToRgb(colorNew);
                    if (rgb !== undefined) {
                        const key =
                            which === "newest" ? "colorNew" : "colorOld";
                        this.lineAuthorSettingHandler(key, rgb);
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
            settingsDom.nameEl.innerText = `Color for ${whichDescriber} commits`;
        }
    }

    private refreshColorSettingsDesc(which: "oldest" | "newest", rgb?: RGB) {
        const settingsDom = this.lineAuthorColorSettings.get(which);
        if (settingsDom) {
            settingsDom.descEl.innerHTML = this.colorSettingPreviewDescHtml(
                which,
                this.settings.lineAuthor,
                rgb !== undefined
            );
        }
    }

    private colorSettingPreviewDescHtml(
        which: "oldest" | "newest",
        laSettings: LineAuthorSettings,
        colorIsValid: boolean
    ): string {
        const rgbStr = colorIsValid
            ? previewColor(which, laSettings)
            : `rgba(127,127,127,0.3)`;
        const today = moment.unix(moment.now() / 1000).format("YYYY-MM-DD");
        const text = colorIsValid
            ? `abcdef Author Name ${today}`
            : "invalid color";
        const preview = `<div
            class="line-author-settings-preview"
            style="background-color: ${rgbStr}; width: 30ch;"
            >${text}</div>`;

        return `Supports 'rgb(r,g,b)', 'hsl(h,s,l)', hex (#) and
            named colors (e.g. 'black', 'purple'). Color preview: ${preview}`;
    }

    private previewCustomDateTimeDescriptionHtml(
        dateTimeFormatCustomString: string
    ) {
        const formattedDateTime = moment().format(dateTimeFormatCustomString);
        return `<a href="${FORMAT_STRING_REFERENCE_URL}">Format string</a> to display the authoring date.</br>Currently: ${formattedDateTime}`;
    }

    private previewOldestAgeDescriptionHtml(coloringMaxAge: string) {
        const duration = parseColoringMaxAgeDuration(coloringMaxAge);
        const durationString =
            duration !== undefined ? `${duration.asDays()} days` : "invalid!";
        return [
            `The oldest age in the line author coloring. Everything older will have the same color.
            </br>Smallest valid age is "1d". Currently: ${durationString}`,
            duration,
        ] as const;
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
