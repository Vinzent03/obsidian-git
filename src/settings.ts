import { Notice, PluginSettingTab, Setting } from "obsidian";
import ObsidianGit from "./main";

export class ObsidianGitSettingsTab extends PluginSettingTab {
    display(): void {
        let { containerEl } = this;
        const plugin: ObsidianGit = (this as any).plugin;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Git Backup settings" });

        new Setting(containerEl)
            .setName("Vault backup interval (minutes)")
            .setDesc(
                "Commit and push changes every X minutes. To disable automatic backup, specify negative value or zero (default)"
            )
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
                                    `Automatic backup enabled! Every ${plugin.settings.autoSaveInterval} minutes.`
                                );
                            } else if (
                                plugin.settings.autoSaveInterval <= 0 &&
                                plugin.timeoutIDBackup
                            ) {
                                plugin.clearAutoBackup() &&
                                    new Notice("Automatic backup disabled!");
                            }
                        } else {
                            new Notice("Please specify a valid number.");
                        }
                    })
            );
        new Setting(containerEl)
            .setName("Auto pull interval (minutes)")
            .setDesc(
                "Pull changes every X minutes. To disable automatic pull, specify negative value or zero (default)"
            )
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
                                plugin.settings.autoPullInterval <= 0 &&
                                plugin.timeoutIDPull
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
            .setName("Commit message")
            .setDesc(
                "Specify custom commit message. Available placeholders: {{date}}" +
                " (see below) and {{numFiles}} (number of changed files in the commit)"
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
                    plugin.gitManager.updateGitPath(value || "git");
                    plugin.saveSettings();
                });
            });
    }
}