import * as moment from "moment";
import { Notice, Platform, PluginSettingTab, RGB, Setting } from "obsidian";
import { DATE_TIME_FORMAT_SECONDS, GIT_LINE_AUTHORING_MOVEMENT_DETECTION_MINIMAL_LENGTH } from "src/constants";
import { previewColor } from "src/lineAuthor/lineAuthorProvider";
import { LineAuthorDateTimeFormatOptions, LineAuthorDisplay, LineAuthorFollowMovement, LineAuthorSettings, LineAuthorTimezoneOption } from "src/lineAuthor/model";
import { SyncMethod } from "src/types";
import { convertToRgb, currentMoment, rgbToString } from "src/utils";
import { IsomorphicGit } from "./isomorphicGit";
import ObsidianGit from "./main";
import { SimpleGit } from "./simpleGit";

const FORMAT_STRING_REFERENCE_URL = "https://momentjs.com/docs/#/parsing/string-format/";

export class ObsidianGitSettingsTab extends PluginSettingTab {
    lineAuthorColorSettings: Map<"oldest" | "newest", Setting> = new Map();

    display(): void {
        const { containerEl } = this;
        const plugin: ObsidianGit = (this as any).plugin;
        const commitOrBackup = plugin.settings.differentIntervalCommitAndPush ? "commit" : "backup";
        const gitReady = plugin.gitReady;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Git Backup settings" });
        if (!gitReady) {
            containerEl.createEl("p", { text: "Git is not ready. When all settings are correct you can configure auto backup, etc." });
        }


        if (gitReady) {
            containerEl.createEl('br');
            containerEl.createEl("h3", { text: "Automatic" });
            new Setting(containerEl)
                .setName("Split automatic commit and push")
                .setDesc("Enable to use separate timer for commit and push")
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.differentIntervalCommitAndPush)
                        .onChange((value) => {
                            plugin.settings.differentIntervalCommitAndPush = value;
                            plugin.saveSettings();
                            plugin.clearAutoBackup();
                            plugin.clearAutoPush();
                            if (plugin.settings.autoSaveInterval > 0) {
                                plugin.startAutoBackup(plugin.settings.autoSaveInterval);
                            }
                            if (value && plugin.settings.autoPushInterval > 0) {
                                plugin.startAutoPush(plugin.settings.autoPushInterval);
                            }
                            this.display();
                        })
                );

            new Setting(containerEl)
                .setName(`Vault ${commitOrBackup} interval (minutes)`)
                .setDesc(`${plugin.settings.differentIntervalCommitAndPush ? "Commit" : "Commit and push"} changes every X minutes. Set to 0 (default) to disable. (See below setting for further configuration!)`)
                .addText((text) =>
                    text
                        .setValue(String(plugin.settings.autoSaveInterval))
                        .onChange((value) => {
                            if (!isNaN(Number(value))) {
                                plugin.settings.autoSaveInterval = Number(value);
                                plugin.saveSettings();

                                if (plugin.settings.autoSaveInterval > 0) {
                                    plugin.clearAutoBackup();
                                    plugin.startAutoBackup(plugin.settings.autoSaveInterval);
                                    new Notice(
                                        `Automatic ${commitOrBackup} enabled! Every ${plugin.settings.autoSaveInterval} minutes.`
                                    );
                                } else if (plugin.settings.autoSaveInterval <= 0) {
                                    plugin.clearAutoBackup() &&
                                        new Notice(`Automatic ${commitOrBackup} disabled!`);
                                }
                            } else {
                                new Notice("Please specify a valid number.");
                            }
                        })
                );

            new Setting(containerEl)
                .setName(`If turned on, do auto ${commitOrBackup} every X minutes after last change. Prevents auto ${commitOrBackup} while editing a file. If turned off, do auto ${commitOrBackup} every X minutes. It's independent from last change.`)
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.autoBackupAfterFileChange)
                        .onChange((value) => {
                            plugin.settings.autoBackupAfterFileChange = value;
                            plugin.saveSettings();
                            plugin.clearAutoBackup();
                            if (plugin.settings.autoSaveInterval > 0) {
                                plugin.startAutoBackup(plugin.settings.autoSaveInterval);
                            }
                        })
                );

            if (plugin.settings.differentIntervalCommitAndPush) {
                new Setting(containerEl)
                    .setName(`Vault push interval (minutes)`)
                    .setDesc("Push changes every X minutes. Set to 0 (default) to disable.")
                    .addText((text) =>
                        text
                            .setValue(String(plugin.settings.autoPushInterval))
                            .onChange((value) => {
                                if (!isNaN(Number(value))) {
                                    plugin.settings.autoPushInterval = Number(value);
                                    plugin.saveSettings();

                                    if (plugin.settings.autoPushInterval > 0) {
                                        plugin.clearAutoPush();
                                        plugin.startAutoPush(plugin.settings.autoPushInterval);
                                        new Notice(
                                            `Automatic push enabled! Every ${plugin.settings.autoPushInterval} minutes.`
                                        );
                                    } else if (plugin.settings.autoPushInterval <= 0) {
                                        plugin.clearAutoPush() &&
                                            new Notice("Automatic push disabled!");
                                    }
                                } else {
                                    new Notice("Please specify a valid number.");
                                }
                            })
                    );
            }

            new Setting(containerEl)
                .setName("Auto pull interval (minutes)")
                .setDesc("Pull changes every X minutes. Set to 0 (default) to disable.")
                .addText((text) =>
                    text
                        .setValue(String(plugin.settings.autoPullInterval))
                        .onChange((value) => {
                            if (!isNaN(Number(value))) {
                                plugin.settings.autoPullInterval = Number(value);
                                plugin.saveSettings();

                                if (plugin.settings.autoPullInterval > 0) {
                                    plugin.clearAutoPull();
                                    plugin.startAutoPull(plugin.settings.autoPullInterval);
                                    new Notice(
                                        `Automatic pull enabled! Every ${plugin.settings.autoPullInterval} minutes.`
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
                .setName("Commit message on manual backup/commit")
                .setDesc(
                    "Available placeholders: {{date}}" +
                    " (see below), {{hostname}} (see below) and {{numFiles}} (number of changed files in the commit)"
                )
                .addText((text) =>
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
                    " (see below), {{hostname}} (see below) and {{numFiles}} (number of changed files in the commit)"
                )
                .addText((text) =>
                    text
                        .setPlaceholder("vault backup: {{date}}")
                        .setValue(
                            plugin.settings.autoCommitMessage
                        )
                        .onChange((value) => {
                            plugin.settings.autoCommitMessage = value;
                            plugin.saveSettings();
                        })
                );

            containerEl.createEl("br");
            containerEl.createEl("h3", { text: "Commit message" });

            new Setting(containerEl)
                .setName("{{date}} placeholder format")
                .setDesc(`Specify custom date format. E.g. "${DATE_TIME_FORMAT_SECONDS}"`)
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
                .setDesc('Specify custom hostname for every device.')
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
                        const commitMessagePreview = await plugin.gitManager.formatCommitMessage(plugin.settings.commitMessage);
                        new Notice(`${commitMessagePreview}`);
                    })
                );

            new Setting(containerEl)
                .setName("List filenames affected by commit in the commit body")
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.listChangedFilesInMessageBody)
                        .onChange((value) => {
                            plugin.settings.listChangedFilesInMessageBody = value;
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
                            'merge': 'Merge',
                            'rebase': 'Rebase',
                            'reset': 'Other sync service (Only updates the HEAD without touching the working directory)',
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

            containerEl.createEl("br");
            containerEl.createEl("h3", { text: "Line author information" });

            this.addLineAuthorInfoSettings(containerEl, plugin);
        }

        containerEl.createEl("br");
        containerEl.createEl("h3", { text: "Miscellaneous" });

        new Setting(containerEl)
            .setName("Automatically refresh Source Control View on file changes")
            .setDesc("On slower machines this may cause lags. If so, just disable this option")
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
            .setDesc("Milliseconds two wait after file change before refreshing the Source Control View")
            .addText((toggle) =>
                toggle
                    .setValue(plugin.settings.refreshSourceControlTimer.toString())
                    .setPlaceholder("7000")
                    .onChange((value) => {
                        plugin.settings.refreshSourceControlTimer = Math.max(parseInt(value), 500);
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
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show status bar")
            .setDesc("Obsidian must be restarted for the changes to take affect")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showStatusBar)
                    .onChange((value) => {
                        plugin.settings.showStatusBar = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show branch status bar")
            .setDesc("Obsidian must be restarted for the changes to take affect")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.showBranchStatusBar)
                    .onChange((value) => {
                        plugin.settings.showBranchStatusBar = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show changes files count in status bar")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.changedFilesInStatusBar)
                    .onChange((value) => {
                        plugin.settings.changedFilesInStatusBar = value;
                        plugin.saveSettings();
                    })
            );

        containerEl.createEl("br");
        containerEl.createEl("h3", { text: "Advanced" });

        if (plugin.gitManager instanceof SimpleGit)
            new Setting(containerEl)
                .setName("Update submodules")
                .setDesc('"Create backup" and "pull" takes care of submodules. Missing features: Conflicted files, count of pulled/pushed/committed files. Tracking branch needs to be set for each submodule')
                .addToggle((toggle) =>
                    toggle
                        .setValue(plugin.settings.updateSubmodules)
                        .onChange((value) => {
                            plugin.settings.updateSubmodules = value;
                            plugin.saveSettings();
                        })
                );

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

        if (plugin.gitManager instanceof IsomorphicGit)
            new Setting(containerEl)
                .setName("Username on your git server. E.g. your username on GitHub")
                .addText(cb => {
                    cb.setValue(plugin.settings.username);
                    cb.onChange((value) => {
                        plugin.settings.username = value;
                        plugin.saveSettings();
                    });
                });


        if (plugin.gitManager instanceof IsomorphicGit)
            new Setting(containerEl)
                .setName("Password/Personal access token")
                .setDesc("Type in your password. You won't be able to see it again.")
                .addText(cb => {
                    cb.inputEl.autocapitalize = "off";
                    cb.inputEl.autocomplete = "off";
                    cb.inputEl.spellcheck = false;
                    cb.onChange((value) => {
                        plugin.localStorage.setPassword(value);
                    });
                });
        if (gitReady)
            new Setting(containerEl)
                .setName("Author name for commit")
                .addText(async cb => {
                    cb.setValue(await plugin.gitManager.getConfig("user.name"));
                    cb.onChange((value) => {
                        plugin.gitManager.setConfig("user.name", value);
                    });
                });

        if (gitReady)
            new Setting(containerEl)
                .setName("Author email for commit")
                .addText(async cb => {
                    cb.setValue(await plugin.gitManager.getConfig("user.email"));
                    cb.onChange((value) => {
                        plugin.gitManager.setConfig("user.email", value);
                    });
                });

        new Setting(containerEl)
            .setName("Custom base path (Git repository path)")
            .setDesc(`
            Sets the relative path to the vault from which the Git binary should be executed.
             Mostly used to set the path to the Git repository, which is only required if the Git repository is below the vault root directory. Use "\\" instead of "/" on Windows.
            `)
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
                        new Notice("Obsidian must be restarted for the changes to take affect");
                    })
            );


        new Setting(containerEl)
            .setName('Donate')
            .setDesc('If you like this Plugin, consider donating to support continued development.')
            .addButton((bt) => {
                bt.buttonEl.outerHTML = "<a href='https://ko-fi.com/F1F195IQ5' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://cdn.ko-fi.com/cdn/kofi3.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>";
            });

        const info = containerEl.createDiv();
        info.setAttr("align", "center");
        info.setText("Debugging and logging:\nYou can always see the logs of this and every other plugin by opening the console with");
        const keys = containerEl.createDiv();
        keys.setAttr("align", "center");
        keys.addClass("obsidian-git-shortcuts");
        if (Platform.isMacOS === true) {
            keys.createEl("kbd", { text: "CMD (⌘) + OPTION (⌥) + I" });
        } else {
            keys.createEl("kbd", { text: "CTRL + SHIFT + I" });
        }
    }

    private addLineAuthorInfoSettings(containerEl: HTMLElement, plugin: ObsidianGit) {
        const baseLineAuthorInfoSetting = new Setting(containerEl)
            .setName("Show commit authoring information next to each line (git-blame)");

        if (!plugin.lineAuthoringFeature.isAvailableOnCurrentPlatform()) {
            baseLineAuthorInfoSetting
                .setDesc("Only available on desktop currently.")
                .setDisabled(true);
        }

        baseLineAuthorInfoSetting
            .setDesc("The commit hash, author name and authoring date can all be individually toggled.\nHide everything, to only show the age-colored sidebar.")
            .addToggle((toggle) => toggle
                .setValue(plugin.settings.lineAuthor.show)
                .onChange((value) => {
                    plugin.settings.lineAuthor.show = value;
                    plugin.saveSettings();

                    if (value) plugin.lineAuthoringFeature.activateFeature();
                    else plugin.lineAuthoringFeature.deactivateFeature();

                    this.display();
                })
            );

        if (plugin.settings.lineAuthor.show) {

            const trackMovement = new Setting(containerEl)
                .setName("Follow movement and copies across files and commits")
                .setDesc("")
                .addDropdown((dropdown) => {
                    dropdown.addOptions(<Record<LineAuthorFollowMovement, string>>{
                        "inactive": "Do not follow (default)",
                        "same-commit": "Follow within same commit",
                        "all-commits": "Follow within all commits (maybe slow)",
                    });
                    dropdown.setValue(plugin.settings.lineAuthor.followMovement);
                    dropdown.onChange((value: LineAuthorFollowMovement) => {
                        plugin.settings.lineAuthor.followMovement = value;
                        plugin.saveSettings();
                        plugin.lineAuthoringFeature.refreshLineAuthorViews();
                    });
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

            new Setting(containerEl)
                .setName("Show commit hash")
                .addToggle((tgl) => {
                    tgl.setValue(plugin.settings.lineAuthor.showCommitHash);
                    tgl.onChange(async (value: boolean) => {
                        plugin.settings.lineAuthor.showCommitHash = value;
                        plugin.saveSettings();
                        plugin.lineAuthoringFeature.refreshLineAuthorViews();
                    });
                });

            new Setting(containerEl)
                .setName("Author name display")
                .setDesc("If and how the author is displayed")
                .addDropdown((dropdown) => {
                    const options: Record<LineAuthorDisplay, string> = {
                        'hide': 'Hide',
                        'initials': 'Initials (default)',
                        'first name': 'First name',
                        'last name': 'Last name',
                        'full': 'Full name',
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(plugin.settings.lineAuthor.authorDisplay);

                    dropdown.onChange(async (option: LineAuthorDisplay) => {
                        plugin.settings.lineAuthor.authorDisplay = option;
                        plugin.saveSettings();
                        plugin.lineAuthoringFeature.refreshLineAuthorViews();
                    });
                });

            new Setting(containerEl)
                .setName("Authoring date display")
                .setDesc("If and how the date and time of authoring the line is displayed")
                .addDropdown((dropdown) => {
                    const options: Record<LineAuthorDateTimeFormatOptions, string> = {
                        'hide': 'Hide',
                        'date': 'Date (default)',
                        'datetime': 'Date and time',
                        'natural language': 'Natural language',
                        'custom': 'Custom',
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(plugin.settings.lineAuthor.dateTimeFormatOptions);

                    dropdown.onChange(async (option: LineAuthorDateTimeFormatOptions) => {
                        plugin.settings.lineAuthor.dateTimeFormatOptions = option;
                        plugin.saveSettings();
                        plugin.lineAuthoringFeature.refreshLineAuthorViews();
                        this.display();
                    });
                });

            const dateTimeFormatCustomStringSetting = new Setting(containerEl)
                .setName("Custom authoring date format")
                .setDisabled(plugin.settings.lineAuthor.dateTimeFormatOptions !== "custom");

            if (plugin.settings.lineAuthor.dateTimeFormatOptions === "custom") {
                dateTimeFormatCustomStringSetting
                    .addText((cb) => {
                        cb.setValue(plugin.settings.lineAuthor.dateTimeFormatCustomString);
                        cb.setPlaceholder("YYYY-MM-DD HH:mm");

                        cb.onChange((value) => {
                            plugin.settings.lineAuthor.dateTimeFormatCustomString = value;
                            dateTimeFormatCustomStringSetting.descEl.innerHTML =
                                this.previewCustomDateTimeDescription(value);
                            plugin.saveSettings();
                            if (plugin.settings.lineAuthor.dateTimeFormatOptions === "custom") {
                                plugin.lineAuthoringFeature.refreshLineAuthorViews();
                            }
                        });
                    });

                dateTimeFormatCustomStringSetting.descEl.innerHTML =
                    this.previewCustomDateTimeDescription(
                        plugin.settings.lineAuthor.dateTimeFormatCustomString
                    );
            }
            else {
                dateTimeFormatCustomStringSetting
                    .setDesc("Only applicable when authoring date display is \"Custom\"");
            }

            new Setting(containerEl)
                .setName("Authoring date display timezone")
                .setDesc("Show in your local timezone or explicitly display UTC offset")
                .addDropdown((dropdown) => {
                    const options: Record<LineAuthorTimezoneOption, string> = {
                        'local': 'Local (default)',
                        'utc': 'UTC',
                    };
                    dropdown.addOptions(options);
                    dropdown.setValue(plugin.settings.lineAuthor.dateTimeTimezone);

                    dropdown.onChange(async (option: LineAuthorTimezoneOption) => {
                        plugin.settings.lineAuthor.dateTimeTimezone = option;
                        plugin.saveSettings();
                        plugin.lineAuthoringFeature.refreshLineAuthorViews();
                    });
                });

            const oldestAgeSetting = new Setting(containerEl)
                .setName("Oldest age in coloring")
                .setDesc(
                    this.previewOldestAgeDescription(plugin.settings.lineAuthor.coloringMaxAge)[0]
                );

            oldestAgeSetting
                .addText((text) => {
                    text.setPlaceholder("1y");
                    text.setValue(plugin.settings.lineAuthor.coloringMaxAge);
                    text.onChange((value) => {
                        const [preview, valid] = this.previewOldestAgeDescription(value);
                        oldestAgeSetting.setDesc(preview);
                        if (valid) {
                            plugin.settings.lineAuthor.coloringMaxAge = value;
                            plugin.saveSettings();
                            this.refreshColorSettingsText("oldest", plugin);
                            plugin.lineAuthoringFeature.refreshLineAuthorViews();
                        }
                    });
                });

            this.createColorSetting("newest", containerEl, plugin);
            this.createColorSetting("oldest", containerEl, plugin);
        }
    }

    private createColorSetting(which: "oldest" | "newest", containerEl: HTMLElement, plugin: ObsidianGit) {

        const setting = new Setting(containerEl)
            .setName("")
            .addText((text) => {
                const color = which === "newest" ? plugin.settings.lineAuthor.colorNew : plugin.settings.lineAuthor.colorOld;
                text.setPlaceholder(rgbToString(color));
                text.setValue(rgbToString(color));
                text.onChange((colorNew) => {
                    const rgb = convertToRgb(colorNew);
                    if (rgb !== undefined) {
                        if (which === "newest") {
                            plugin.settings.lineAuthor.colorNew = rgb;
                        }
                        else {
                            plugin.settings.lineAuthor.colorOld = rgb;
                        }
                        plugin.saveSettings();
                        plugin.lineAuthoringFeature.refreshLineAuthorViews();
                    }
                    this.refreshColorSettingsText(which, plugin, rgb);
                });
            });
        this.lineAuthorColorSettings.set(which, setting);

        this.refreshColorSettingsText(which, plugin, pickColor(which, plugin.settings.lineAuthor));
    }

    private refreshColorSettingsText(which: "oldest" | "newest", plugin: ObsidianGit, rgb?: RGB) {
        const settingsDom = this.lineAuthorColorSettings.get(which);
        if (settingsDom) {
            const whichDescriber = which === "oldest" ? `oldest (${plugin.settings.lineAuthor.coloringMaxAge} or older)` : "newest";
            settingsDom.nameEl.innerText = `Color for ${whichDescriber} commits`;

            settingsDom.descEl.innerHTML = this.colorSettingPreviewDescHtml(
                which, plugin.settings.lineAuthor, rgb !== undefined
            );
        }
    }

    private colorSettingPreviewDescHtml(
        which: "oldest" | "newest",
        laSettings: LineAuthorSettings,
        colorIsValid: boolean,
    ): string {
        const rgbStr = colorIsValid ? previewColor(which, laSettings) : `rgba(127,127,127,0.3)`;
        const today = moment.unix(moment.now() / 1000).format("YYYY-MM-DD");
        const text = colorIsValid ? `abcdef Author Name ${today}` : "invalid color";
        const preview = `<div
            class="line-author-settings-preview"
            style="background-color: ${rgbStr}; width: 30ch;"
            >${text}</div>`;

        return `Supports 'rgb(r,g,b)', 'hsl(h,s,l)', hex (#) and
            named colors (e.g. 'black', 'purple'). Color preview: ${preview}`;
    }

    private previewCustomDateTimeDescription(dateTimeFormatCustomString: string) {
        const formattedDateTime = currentMoment().format(dateTimeFormatCustomString);
        return `<a href="${FORMAT_STRING_REFERENCE_URL}">Format string</a> to display the authoring date.\nCurrently: ${formattedDateTime}`;
    }

    private previewOldestAgeDescription(coloringMaxAge: string) {
        const duration = parseColoringMaxAgeDuration(coloringMaxAge);
        const durationString = duration !== undefined ? `${duration.asDays()} days` : "invalid!";
        return [
            `The oldest age in the line author coloring. Everything older will have the same color.\nSmallest valid age is "1d".\nCurrently: ${durationString}`,
            duration
        ] as const;
    }
}

export function pickColor(which: "oldest" | "newest", las: LineAuthorSettings): RGB {
    return which === "oldest" ? las.colorOld : las.colorNew;
}

export function parseColoringMaxAgeDuration(durationString: string): moment.Duration | undefined {
    // https://momentjs.com/docs/#/durations/creating/
    const duration = moment.duration("P" + durationString.toUpperCase());
    return duration.isValid() && duration.asDays() && duration.asDays() >= 1 ? duration : undefined;
}
