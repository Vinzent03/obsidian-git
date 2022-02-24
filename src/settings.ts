import { Notice, Platform, PluginSettingTab, Setting } from "obsidian";
import ObsidianGit from "./main";
import { BackupIntervalMode, SyncMethod } from "./types";

export class ObsidianGitSettingsTab extends PluginSettingTab {
    display(): void {
        let { containerEl } = this;
        const plugin: ObsidianGit = (this as any).plugin;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Git Backup settings" });

        new Setting(containerEl)
            .setName("Vault backup interval (minutes)")
            .setDesc("Commit and push changes every X minutes. Set to 0 (default) to disable. (See below setting for further configuration!)")
            .addText((text) =>
                text
                    .setValue(String(plugin.settings.autoSaveInterval))
                    .onChange((value) => {
                        if (!isNaN(Number(value))) {
                            plugin.settings.autoSaveInterval = Number(value);
                            plugin.saveSettings();
                            const wasAutobackupActive = plugin.clearAutoBackup();

                            if (plugin.settings.autoSaveInterval > 0) {
                                plugin.startAutoBackup(plugin.settings.autoSaveInterval);
                                this.showAutoBackupEnabledNotice(plugin.settings.autoSaveInterval, plugin.settings.autoSaveIntervalMode);
                            } else if (wasAutobackupActive) {
                                new Notice("Automatic backup disabled!");
                            }
                        } else {
                            new Notice("Please specify a valid number.");
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Auto backup mode")
            .setDesc(createFragment((fragment) => {
                fragment.appendText('If auto backup interval is set, backup is run in fixed intervals in default mode. This setting can be set to one of the following values:');
                fragment.createEl('br');

                fragment.appendText('- ');
                fragment.createEl('strong', { text: 'Default: ' });
                fragment.appendText('do auto backup every X minutes. It\'s independent from last change.');
                fragment.createEl('br');


                fragment.appendText('- ');
                fragment.createEl('strong', { text: 'After last change: ' });
                fragment.appendText('do auto backup X minutes after last change. Prevents auto backup while editing a file.');
                fragment.createEl('br');

                fragment.appendText('- ');
                fragment.createEl('strong', { text: 'While window inactive: ' });
                fragment.appendText('do auto backup X minutes after Obsidian window was deactivated (put to background). Prevents auto backup while using Obsidian.')
            }))
            .addDropdown((dropdown) => {
                const options: Record<BackupIntervalMode, string> = {
                    'default': 'Default',
                    'after-change': 'After last change',
                    'after-inactive': 'While window inactive',
                };
                dropdown.addOptions(options);
                dropdown.setValue(plugin.settings.autoSaveIntervalMode ?? 'default');

                dropdown.onChange(async (mode: BackupIntervalMode) => {
                    plugin.settings.autoSaveIntervalMode = mode;
                    plugin.saveSettings();

                    switch (mode) {
                        case 'default': { return; }
                        case 'after-change':
                        case 'after-inactive': {
                            plugin.clearAutoBackup();
                            if (plugin.settings.autoSaveInterval > 0) {
                                plugin.startAutoBackup(plugin.settings.autoSaveInterval);
                            }
                            return;
                        }
                    }
                });
            });

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
            .setName("Commit message")
            .setDesc(
                "Specify custom commit message. Available placeholders: {{date}}" +
                " (see below), {{hostname}} (see below) and {{numFiles}} (number of changed files in the commit)"
            )
            .addText((text) =>
                text
                    .setPlaceholder("vault backup")
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
            .setDesc('Specify custom date format. E.g. "YYYY-MM-DD HH:mm:ss"')
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
                    .setValue(localStorage.getItem(plugin.manifest.id + ":hostname"))
                    .onChange(async (value) => {
                        localStorage.setItem(plugin.manifest.id + ":hostname", value);
                    })
            );

        new Setting(containerEl)
            .setName("Preview commit message")
            .addButton((button) =>
                button.setButtonText("Preview").onClick(async () => {
                    let commitMessagePreview = await plugin.gitManager.formatCommitMessage();
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

        new Setting(containerEl)
            .setName("Specify custom commit message on auto backup")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.customMessageOnAutoBackup)
                    .onChange((value) => {
                        plugin.settings.customMessageOnAutoBackup = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Current branch")
            .setDesc("Switch to a different branch")
            .addDropdown(async (dropdown) => {
                const branchInfo = await plugin.gitManager.branchInfo();
                for (const branch of branchInfo.branches) {
                    dropdown.addOption(branch, branch);
                }
                dropdown.setValue(branchInfo.current);
                dropdown.onChange(async (option) => {
                    await plugin.gitManager.checkout(option);
                    new Notice(`Checked out to ${option}`);
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
            .setName("Disable push")
            .setDesc("Do not push changes to the remote repository")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.disablePush)
                    .onChange((value) => {
                        plugin.settings.disablePush = value;
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

        new Setting(containerEl)
            .setName("Disable notifications")
            .setDesc(
                "Disable notifications for git operations to minimize distraction (refer to status bar for updates)"
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
            .setName("Custom Git binary path")
            .addText((cb) => {
                cb.setValue(plugin.settings.gitPath);
                cb.setPlaceholder("git");
                cb.onChange((value) => {
                    plugin.settings.gitPath = value;
                    plugin.saveSettings();
                    plugin.gitManager.updateGitPath(value || "git");
                });
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

    private showAutoBackupEnabledNotice(interval: number, mode: BackupIntervalMode) {
        const messageByMode: Record<BackupIntervalMode, string> = {
            default: `Every ${interval} minutes.`,
            'after-change': `${interval} minutes since last file change.`,
            'after-inactive': `${interval} minutes since Obsidian window is put to background.`,
        }

        new Notice(`Automatic backup enabled! ${messageByMode[mode]}`);
    }
}
