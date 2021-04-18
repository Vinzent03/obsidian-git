import { Notice, PluginSettingTab, Setting } from "obsidian";
import { IsomorphicGit } from "./isomorphicGit";
import ObsidianGit from "./main";
import { SimpleGit } from "./simpleGit";

export class ObsidianGitSettingsTab extends PluginSettingTab {
    plugin: ObsidianGit;
    constructor(plugin: ObsidianGit) {
        super(plugin.app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        let { containerEl } = this;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Git Backup settings" });

        new Setting(containerEl)
            .setName("Vault backup interval (minutes)")
            .setDesc(
                "Commit and push changes every X minutes. To disable automatic backup, specify negative value or zero (default)"
            )
            .addText((text) =>
                text
                    .setValue(String(this.plugin.settings.autoSaveInterval))
                    .onChange((value) => {
                        if (!isNaN(Number(value))) {
                            this.plugin.settings.autoSaveInterval = Number(value);
                            this.plugin.saveSettings();

                            if (this.plugin.settings.autoSaveInterval > 0) {
                                this.plugin.disableAutoBackup();
                                this.plugin.enableAutoBackup();
                                new Notice(
                                    `Automatic backup enabled! Every ${this.plugin.settings.autoSaveInterval} minutes.`
                                );
                            } else if (
                                this.plugin.settings.autoSaveInterval <= 0 &&
                                this.plugin.intervalIDBackup
                            ) {
                                this.plugin.disableAutoBackup() &&
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
                    .setValue(String(this.plugin.settings.autoPullInterval))
                    .onChange((value) => {
                        if (!isNaN(Number(value))) {
                            this.plugin.settings.autoPullInterval = Number(value);
                            this.plugin.saveSettings();

                            if (this.plugin.settings.autoPullInterval > 0) {
                                this.plugin.disableAutoPull();
                                this.plugin.enableAutoPull();
                                new Notice(
                                    `Automatic pull enabled! Every ${this.plugin.settings.autoPullInterval} minutes.`
                                );
                            } else if (
                                this.plugin.settings.autoPullInterval <= 0 &&
                                this.plugin.intervalIDPull
                            ) {
                                this.plugin.disableAutoPull() &&
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
                        this.plugin.settings.commitMessage
                            ? this.plugin.settings.commitMessage
                            : ""
                    )
                    .onChange((value) => {
                        this.plugin.settings.commitMessage = value;
                        this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("{{date}} placeholder format")
            .setDesc('Specify custom date format. E.g. "YYYY-MM-DD HH:mm:ss"')
            .addText((text) =>
                text
                    .setPlaceholder(this.plugin.settings.commitDateFormat)
                    .setValue(this.plugin.settings.commitDateFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.commitDateFormat = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Preview commit message")
            .addButton((button) =>
                button.setButtonText("Preview").onClick(async () => {
                    const commitMessagePreview = await this.plugin.gitManager.formatCommitMessage();
                    new Notice(`${commitMessagePreview}`);
                })
            );

        new Setting(containerEl)
            .setName("List filenames affected by commit in the commit body")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.listChangedFilesInMessageBody)
                    .onChange((value) => {
                        this.plugin.settings.listChangedFilesInMessageBody = value;
                        this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Current branch")
            .setDesc("Switch to a different branch")
            .addDropdown(async (dropdown) => {
                const branchInfo = await this.plugin.gitManager.branchInfo();
                for (const branch of branchInfo.branches) {
                    dropdown.addOption(branch, branch);
                }
                dropdown.setValue(branchInfo.current);
                dropdown.onChange(async (option) => {
                    await this.plugin.gitManager.checkout(option);
                    new Notice(`Checked out to ${option}`);
                });
            });

        const remoteBranches = new Setting(containerEl)
            .setName("Tracking branch")
            .setDesc("Select tracking branch from remote");

        remoteBranches.addDropdown(async (dropdown) => {
            const branchInfo = await this.plugin.gitManager.branchInfo(true);
            for (const branch of branchInfo.remoteBranches) {
                dropdown.addOption(branch, branch);
            }
            dropdown.setValue(branchInfo.tracking);
            dropdown.onChange(async (option) => {
                const remote = option.substring(0, option.indexOf("/"));
                const branch = option.substring(option.indexOf("/"));
                await this.plugin.gitManager.setConfig(`branch.${branchInfo.current}.remote`, remote);
                await this.plugin.gitManager.setConfig(`branch.${branchInfo.current}.merge`, "refs/heads" + branch);
                new Notice(`Set ${option} as tracking branch`);
            });
        });
        remoteBranches.addButton(cb => {
            cb.setButtonText("Fetch remote");
            cb.setCta();
            cb.onClick(async (_) => {
                await this.plugin.gitManager.fetch();
                new Notice("Fetched remote branches");
                this.display();
            });
        });


        new Setting(containerEl)
            .setName("Pull updates on startup")
            .setDesc("Automatically pull updates when Obsidian starts")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autoPullOnBoot)
                    .onChange((value) => {
                        this.plugin.settings.autoPullOnBoot = value;
                        this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Disable push")
            .setDesc("Do not push changes to the remote repository")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.disablePush)
                    .onChange((value) => {
                        this.plugin.settings.disablePush = value;
                        this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Pull changes before push")
            .setDesc("Commit -> pull -> push (Only if pushing is enabled)")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.pullBeforePush)
                    .onChange((value) => {
                        this.plugin.settings.pullBeforePush = value;
                        this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Disable notifications")
            .setDesc(
                "Disable notifications for git operations to minimize distraction (refer to status bar for updates)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.disablePopups)
                    .onChange((value) => {
                        this.plugin.settings.disablePopups = value;
                        this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Name")
            .setDesc("Every commit will have this name as signature")
            .addText(async cb => {
                cb.setValue(await this.plugin.gitManager.getConfig("user.name"));
                cb.onChange(value => this.plugin.gitManager.setConfig("user.name", value));
            });

        new Setting(containerEl)
            .setName("E-Mail")
            .setDesc("Every commit will have this E-Mail as signature")
            .addText(async cb => {
                cb.setValue(await this.plugin.gitManager.getConfig("user.email"));
                cb.onChange(value => this.plugin.gitManager.setConfig("user.email", value));
            });

        new Setting(containerEl)
            .setName("Repository URL")
            .setDesc("URL under which the git repository is accessible")
            .addText(async cb => {
                cb.setValue(await this.plugin.gitManager.getConfig("remote.origin.url"));
                cb.onChange(async value => {
                    await this.plugin.gitManager.setConfig("remote.origin.url", value);
                    this.plugin.gitManager.setConfig("remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*");
                });
            });

        new Setting(containerEl)
            .setName("Standalone mode (Needed for Obsidian mobile)")
            .setDesc("No system wide git installation is needed. See README for limitations and instructions.")
            .addToggle(cb =>
                cb.setValue(this.plugin.settings.standaloneMode)
                    .onChange(value => {
                        this.plugin.settings.standaloneMode = value;
                        this.plugin.saveSettings();
                        if (value) {
                            this.plugin.gitManager = new IsomorphicGit(this.plugin);
                        } else {
                            this.plugin.gitManager = new SimpleGit(this.plugin);
                        }
                        this.display();
                    }));
        if (this.plugin.settings.standaloneMode) {
            this.addStandaloneSettings();
        }
    }

    addStandaloneSettings() {
        const containerEl = this.containerEl;
        containerEl.createEl("h2", { text: "Settings for standalone mode" });

        new Setting(containerEl)
            .setName("Proxy URL")
            .setDesc("Used Proxy to fix CORS. See README for instructions")
            .addText(async cb => {
                cb.setValue(this.plugin.settings.proxyURL);
                cb.onChange(value => {
                    this.plugin.settings.proxyURL = value;
                    this.plugin.saveSettings();
                });
            });

        containerEl.createEl("h3", { text: "Authentication" });


        new Setting(containerEl)
            .setName("Username")
            .addText(cb => {
                cb.setValue(window.localStorage.getItem(this.plugin.manifest.id + ":username"));
                cb.onChange(value => window.localStorage.setItem(this.plugin.manifest.id + ":username", value));
            });

        let password: string;
        const passwordSetting = new Setting(containerEl)
            .setName("Password/Personal access token")
            .setDesc("Type in your password and press on the button to set it. You won't be able to see it again.")
            .addText(cb => {
                cb.onChange(value => password = value);
            });
        passwordSetting.addButton(cb => {
            cb.setButtonText("Set")
                .setWarning().onClick((_) => window.localStorage.setItem(this.plugin.manifest.id + ":password", password));
        });

    }
}