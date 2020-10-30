import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import simpleGit, { CheckRepoActions, SimpleGit } from "simple-git";

enum PluginState {
    idle,
    checkRepoClean,
    pull,
    add,
    commit,
    push,
}

export default class ObsidianGit extends Plugin {
    public git: SimpleGit;
    public settings: ObsidianGitSettings;
    public statusBar: StatusBar;
    public state: PluginState = PluginState.idle;

    private intervalID: number;
    private lastUpdate: number;

    setState(state: PluginState) {
        this.state = state;
        this.statusBar.display(this);
        this.periodicStatusBarUpdate();
    }

    getState(): PluginState {
        return this.state;
    }

    async onload() {
        const adapter: any = this.app.vault.adapter;
        const git = simpleGit(adapter.basePath);
        let isValidRepo = git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
        if (!isValidRepo) {
            new Notice("Valid git repository not found.");
            return;
        }

        let statusBarEl = this.addStatusBarItem();
        this.statusBar = new StatusBar(statusBarEl);
        this.statusBar.displayIdle();

        this.git = git;
        this.settings = (await this.loadData()) || new ObsidianGitSettings();

        this.setState(PluginState.idle);

        if (this.settings.autoPullOnBoot) {
            setTimeout(
                async () =>
                    await this.pull().then((filesUpdated) => {
                        this.setState(PluginState.idle);
                        this.maybeNotice(
                            `Pulled new changes. ${filesUpdated} files updated.`
                        );
                    }),
                700
            );
        }

        if (this.settings.autoSaveInterval > 0) {
            this.enableAutosave();
        }

        this.registerInterval(
            window.setInterval(() => this.periodicStatusBarUpdate(), 10 * 1000)
        );

        this.addSettingTab(new ObsidianGitSettingsTab(this.app, this));

        this.addCommand({
            id: "pull",
            name: "Pull from remote repository",
            callback: async () => {
                let filesUpdated = await this.pull();
                if (filesUpdated > 0) {
                    this.maybeNotice(
                        `Pulled new changes. ${filesUpdated} files updated.`
                    );
                } else {
                    this.maybeNotice("Everything is up-to-date");
                }
                this.setState(PluginState.idle);
            },
        });

        this.addCommand({
            id: "push",
            name: "Commit *all* changes and push to remote repository",
            callback: async () =>
                await this.isRepoClean().then(async (isClean) => {
                    if (isClean) {
                        this.maybeNotice(
                            "No updates detected. Nothing to push."
                        );
                    } else {
                        this.maybeNotice(
                            "Pushing changes to remote repository.."
                        );
                        await this.add()
                            .then(async () => await this.commit())
                            .then(async () => await this.push());
                        this.maybeNotice("Pushed!");
                    }
                    this.setState(PluginState.idle);
                }),
        });
    }

    async onunload() {
        await this.saveData(this.settings);
    }

    // region: main methods
    async isRepoClean(): Promise<boolean> {
        this.setState(PluginState.checkRepoClean);
        let status = await this.git.status();
        return status.isClean();
    }

    async add(): Promise<void> {
        this.setState(PluginState.add);
        await this.git.add("./*");
    }

    async commit(): Promise<void> {
        this.setState(PluginState.commit);
        await this.git.commit(this.settings.commitMessage);
    }

    async push(): Promise<void> {
        this.setState(PluginState.push);
        await this.git.push("origin", "master");

        this.lastUpdate = Date.now();
    }

    async pull(): Promise<number> {
        this.setState(PluginState.pull);
        let pullResult = await this.git.pull();
        this.lastUpdate = Date.now();
        return pullResult.files.length;
    }

    // endregion: main methods

    isIdle(): boolean {
        return this.getState() === PluginState.idle;
    }

    periodicStatusBarUpdate(): void {
        if (this.lastUpdate && this.isIdle()) {
            this.statusBar.displayFromNow(this.lastUpdate);
        } else if (!this.lastUpdate && this.isIdle()) {
            this.statusBar.displayIdle();
        }
    }

    enableAutosave() {
        let minutes = this.settings.autoSaveInterval;
        this.intervalID = window.setInterval(
            async () =>
                await this.isRepoClean().then(async (isClean) => {
                    if (!isClean) {
                        await this.add()
                            .then(async () => await this.commit())
                            .then(async () => await this.push());
                        this.maybeNotice("Pushed changes to remote repository");
                    }
                    this.setState(PluginState.idle);
                }),
            minutes * 60000
        );
        this.registerInterval(this.intervalID);
    }

    disableAutosave(): boolean {
        if (this.intervalID) {
            clearInterval(this.intervalID);
            return true;
        }

        return false;
    }

    maybeNotice(text: string): void {
        if (!this.settings.disablePopups) {
            new Notice(text);
        } else {
            console.log(`git obsidian: ${text}`);
        }
    }
}

class ObsidianGitSettings {
    commitMessage: string = "vault backup";
    autoSaveInterval: number = 0;
    autoPullOnBoot: boolean = false;
    disablePopups: boolean = false;
}

class ObsidianGitSettingsTab extends PluginSettingTab {
    display(): void {
        let { containerEl } = this;
        const plugin: any = (this as any).plugin;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Git Backup settings" });

        new Setting(containerEl)
            .setName("Commit message")
            .setDesc("Specify a custom commit message")
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
                        plugin.saveData(plugin.settings);
                    })
            );

        new Setting(containerEl)
            .setName("Autosave")
            .setDesc(
                "Commit and push changes every X minutes. To disable autosave, specify negative value or zero (default)"
            )
            .addText((text) =>
                text
                    .setValue(String(plugin.settings.autoSaveInterval))
                    .onChange((value) => {
                        if (!isNaN(Number(value))) {
                            plugin.settings.autoSaveInterval = Number(value);
                            plugin.saveData(plugin.settings);

                            if (plugin.settings.autoSaveInterval > 0) {
                                plugin.disableAutosave(); // call clearInterval() before setting up a new one
                                plugin.enableAutosave();
                                new Notice(
                                    `Autosave enabled! Every ${plugin.settings.autoSaveInterval} minutes.`
                                );
                            } else if (
                                plugin.settings.autoSaveInterval <= 0 &&
                                plugin.intervalID
                            ) {
                                plugin.disableAutosave() &&
                                    new Notice("Autosave disabled!");
                            }
                        } else {
                            new Notice("Please specify a valid number.");
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Pull updates on startup")
            .setDesc("Automatically pull updates when Obsidian starts")
            .addToggle((toggle) =>
                toggle
                    .setValue(plugin.settings.autoPullOnBoot)
                    .onChange((value) => {
                        plugin.settings.autoPullOnBoot = value;
                        plugin.saveData(plugin.settings);
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
                        plugin.saveData(plugin.settings);
                    })
            );
    }
}

class StatusBar {
    private statusBarEl: HTMLElement;

    constructor(statusBarEl: HTMLElement) {
        this.statusBarEl = statusBarEl;
    }

    displayFromNow(timestamp: number): void {
        let moment = (window as any).moment;
        let fromNow = moment(timestamp).fromNow();
        this.statusBarEl.setText(`git: last update ${fromNow}..`);
    }

    displayIdle(): void {
        this.statusBarEl.setText("git: ready");
    }

    display(plugin: ObsidianGit) {
        switch (plugin.getState()) {
            case PluginState.checkRepoClean:
                this.statusBarEl.setText("git: checking repo..");
                break;
            case PluginState.add:
                this.statusBarEl.setText("git: adding files to repo..");
                break;
            case PluginState.commit:
                this.statusBarEl.setText("git: committing changes..");
                break;
            case PluginState.push:
                this.statusBarEl.setText("git: pushing changes..");
                break;
            case PluginState.pull:
                this.statusBarEl.setText(
                    "git: pulling changes from remote repo.."
                );
                break;
        }
    }
}
