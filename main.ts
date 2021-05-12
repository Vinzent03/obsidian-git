import { spawnSync } from "child_process";
import { FileSystemAdapter, FuzzySuggestModal, Notice, Plugin, PluginSettingTab, Setting, SuggestModal, TFile } from "obsidian";
import simpleGit, { FileStatusResult, SimpleGit } from "simple-git";

enum PluginState {
    idle,
    status,
    pull,
    add,
    commit,
    push,
    conflicted,
}
interface ObsidianGitSettings {
    commitMessage: string;
    commitDateFormat: string;
    autoSaveInterval: number;
    autoPullInterval: number;
    autoPullOnBoot: boolean;
    disablePush: boolean;
    pullBeforePush: boolean;
    disablePopups: boolean;
    listChangedFilesInMessageBody: boolean;
    showStatusBar: boolean;
}
const DEFAULT_SETTINGS: ObsidianGitSettings = {
    commitMessage: "vault backup: {{date}}",
    commitDateFormat: "YYYY-MM-DD HH:mm:ss",
    autoSaveInterval: 0,
    autoPullInterval: 0,
    autoPullOnBoot: false,
    disablePush: false,
    pullBeforePush: true,
    disablePopups: false,
    listChangedFilesInMessageBody: false,
    showStatusBar: true,
};

export default class ObsidianGit extends Plugin {
    git: SimpleGit;
    settings: ObsidianGitSettings;
    statusBar: StatusBar;
    state: PluginState;
    timeoutIDBackup: number;
    timeoutIDPull: number;
    lastUpdate: number;
    gitReady = false;
    promiseQueue: PromiseQueue = new PromiseQueue();
    conflictOutputFile = "conflict-files-obsidian-git.md";

    setState(state: PluginState) {
        this.state = state;
        this.statusBar?.display();
    }

    async onload() {
        console.log('loading ' + this.manifest.name + " plugin");
        await this.loadSettings();

        this.addSettingTab(new ObsidianGitSettingsTab(this.app, this));

        this.addCommand({
            id: "pull",
            name: "Pull from remote repository",
            callback: () => this.promiseQueue.addTask(() => this.pullChangesFromRemote()),
        });

        this.addCommand({
            id: "push",
            name: "Commit *all* changes and push to remote repository",
            callback: () => this.promiseQueue.addTask(() => this.createBackup(false))
        });

        this.addCommand({
            id: "commit-push-specified-message",
            name: "Commit and push all changes with specified message",
            callback: () => new CustomMessageModal(this).open()
        });

        this.addCommand({
            id: "list-changed-files",
            name: "List changed files",
            callback: async () => {
                const status = await this.git.status();
                new ChangedFilesModal(this, status.files).open();
            }
        });
        if (this.settings.showStatusBar) {
            // init statusBar
            let statusBarEl = this.addStatusBarItem();
            this.statusBar = new StatusBar(statusBarEl, this);
            this.registerInterval(
                window.setInterval(() => this.statusBar.display(), 1000)
            );
        }
        this.app.workspace.on("layout-ready", () => this.init());
    }

    async onunload() {
        window.clearTimeout(this.timeoutIDBackup);
        window.clearTimeout(this.timeoutIDPull);
        console.log('unloading ' + this.manifest.name + " plugin");
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }

    async saveLastAuto(date: Date, mode: "backup" | "pull") {
        const fileName = ".obsidian-git-data";
        let data = "\n";
        if (await this.app.vault.adapter.exists(fileName)) {
            data = await this.app.vault.adapter.read(fileName);
        }
        const lines = data.split("\n");
        if (mode === "backup") {
            lines[0] = date.toString();
        } else if (mode === "pull") {
            lines[1] = date.toString();
        }

        await this.app.vault.adapter.write(fileName, lines.join("\n"));
    }

    async loadLastAuto(): Promise<{ "backup": Date, "pull": Date; }> {
        const fileName = ".obsidian-git-data";
        let data = "\n";
        if (await this.app.vault.adapter.exists(fileName)) {
            data = await this.app.vault.adapter.read(fileName);
        }
        const lines = data.split("\n");
        return {
            "backup": new Date(lines[0]),
            "pull": new Date(lines[1])
        };
    }

    async init(): Promise<void> {
        if (!this.isGitInstalled()) {
            this.displayError("Cannot run git command");
            return;
        }
        try {
            const adapter = this.app.vault.adapter as FileSystemAdapter;
            const path = adapter.getBasePath();

            this.git = simpleGit(path);

            const isValidRepo = await this.git.checkIsRepo();

            if (!isValidRepo) {
                this.displayError("Valid git repository not found.");
            } else {
                this.gitReady = true;
                this.setState(PluginState.idle);

                if (this.settings.autoPullOnBoot) {
                    this.promiseQueue.addTask(() => this.pullChangesFromRemote());
                }
                const lastAutos = await this.loadLastAuto();

                if (this.settings.autoSaveInterval > 0) {
                    const now = new Date();

                    const diff = this.settings.autoSaveInterval - (Math.round(((now.getTime() - lastAutos.backup.getTime()) / 1000) / 60));
                    this.startAutoBackup(diff <= 0 ? 0 : diff);
                }
                if (this.settings.autoPullInterval > 0) {
                    const now = new Date();

                    const diff = this.settings.autoPullInterval - (Math.round(((now.getTime() - lastAutos.pull.getTime()) / 1000) / 60));
                    this.startAutoPull(diff <= 0 ? 0 : diff);
                }
            }

        } catch (error) {
            this.displayError(error);
            console.error(error);
        }
    }

    async pullChangesFromRemote(): Promise<void> {

        if (!this.gitReady) {
            await this.init();
        }

        if (!this.gitReady) return;

        const filesUpdated = await this.pull();
        if (filesUpdated > 0) {
            this.displayMessage(`Pulled new changes. ${filesUpdated} files updated`);
        } else {
            this.displayMessage("Everything is up-to-date");
        }

        const status = await this.git.status();
        if (status.conflicted.length > 0) {
            this.displayError(`You have ${status.conflicted.length} conflict files`);
        }

        this.lastUpdate = Date.now();
        this.setState(PluginState.idle);
    }

    async createBackup(fromAutoBackup: boolean, commitMessage?: string): Promise<void> {
        if (!this.gitReady) {
            await this.init();
        }
        if (!this.gitReady) return;

        this.setState(PluginState.status);
        let status = await this.git.status();


        if (!fromAutoBackup) {
            const file = this.app.vault.getAbstractFileByPath(this.conflictOutputFile);
            await this.app.vault.delete(file);
        }

        // check for conflict files on auto backup
        if (fromAutoBackup && status.conflicted.length > 0) {
            this.setState(PluginState.idle);
            this.displayError(`Did not commit, because you have ${status.conflicted.length} conflict files. Please resolve them and commit per command.`);
            this.handleConflict(status.conflicted);
            return;
        }

        const changedFiles = (await this.git.status()).files;

        if (changedFiles.length !== 0) {
            await this.add();
            status = await this.git.status();
            await this.commit(commitMessage);

            this.lastUpdate = Date.now();
            this.displayMessage(`Committed ${status.staged.length} files`);
        } else {
            this.displayMessage("No changes to commit");
        }

        if (!this.settings.disablePush) {
            const trackingBranch = status.tracking;
            const currentBranch = status.current;

            if (!trackingBranch) {
                this.displayError("Did not push. No upstream branch is set! See README for instructions", 10000);
                this.setState(PluginState.idle);
                return;
            }

            const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch])).changed;

            // Prevent plugin to pull/push at every call of createBackup. Only if unpushed commits are present
            if (remoteChangedFiles > 0) {
                if (this.settings.pullBeforePush) {
                    const pulledFilesLength = await this.pull();
                    if (pulledFilesLength > 0) {
                        this.displayMessage(`Pulled ${pulledFilesLength} files from remote`);
                    }
                }

                // Refresh because of pull
                status = await this.git.status();

                if (status.conflicted.length > 0) {
                    this.displayError(`Cannot push. You have ${status.conflicted.length} conflict files`);
                    this.handleConflict(status.conflicted);
                    return;
                } else {
                    const remoteChangedFiles = (await this.git.diffSummary([currentBranch, trackingBranch])).changed;

                    await this.push();
                    this.displayMessage(`Pushed ${remoteChangedFiles} files to remote`);
                }
            } else {
                this.displayMessage("No changes to push");
            }
        }
        this.setState(PluginState.idle);
    }


    // region: main methods

    isGitInstalled(): boolean {
        // https://github.com/steveukx/git-js/issues/402
        const command = spawnSync('git', ['--version'], {
            stdio: 'ignore'
        });

        if (command.error) {
            console.error(command.error);
            return false;
        }
        return true;
    }

    async add(): Promise<void> {
        this.setState(PluginState.add);
        await this.git.add(
            "./*",
            (err: Error | null) =>
                err && this.displayError(`Cannot add files: ${err.message}`)
        );
    }

    async commit(message?: string): Promise<void> {
        this.setState(PluginState.commit);
        let commitMessage: string | string[] = message ?? await this.formatCommitMessage(this.settings.commitMessage);
        if (this.settings.listChangedFilesInMessageBody) {
            commitMessage = [commitMessage, "Affected files:", (await this.git.status()).staged.join("\n")];
        }
        await this.git.commit(commitMessage);
    }

    async push(): Promise<void> {
        this.setState(PluginState.push);
        await this.git.env({ ...process.env, "OBSIDIAN_GIT": 1 }).push(
            (err: Error | null) => {
                err && this.displayError(`Push failed ${err.message}`);
            }
        );

        this.lastUpdate = Date.now();
    }

    async pull(): Promise<number> {
        this.setState(PluginState.pull);
        const pullResult = await this.git.pull(["--no-rebase"],
            async (err: Error | null) => {
                if (err) {
                    this.displayError(`Pull failed ${err.message}`);
                    const status = await this.git.status();
                    if (status.conflicted.length > 0) {
                        this.handleConflict(status.conflicted);
                    }
                }
            }
        );
        this.lastUpdate = Date.now();
        return pullResult.files.length;
    }

    // endregion: main methods

    startAutoBackup(minutes?: number) {
        this.timeoutIDBackup = window.setTimeout(
            () => {
                this.promiseQueue.addTask(() => this.createBackup(true));
                this.saveLastAuto(new Date(), "backup");
                this.saveSettings();
                this.startAutoBackup();
            },
            (minutes ?? this.settings.autoSaveInterval) * 60000
        );
    }

    startAutoPull(minutes?: number) {
        this.timeoutIDPull = window.setTimeout(
            () => {
                this.promiseQueue.addTask(() => this.pullChangesFromRemote());
                this.saveLastAuto(new Date(), "pull");
                this.saveSettings();
                this.startAutoPull();
            },
            (minutes ?? this.settings.autoPullInterval) * 60000
        );
    }

    clearAutoBackup(): boolean {
        if (this.timeoutIDBackup) {
            window.clearTimeout(this.timeoutIDBackup);
            return true;
        }
        return false;
    }

    clearAutoPull(): boolean {
        if (this.timeoutIDPull) {
            window.clearTimeout(this.timeoutIDPull);
            return true;
        }
        return false;
    }

    async handleConflict(conflicted: string[]): Promise<void> {
        this.setState(PluginState.conflicted);
        const lines = [
            "# Conflict files",
            "Please resolve them and commit per command (This file will be deleted before the commit).",
            ...conflicted.map(e => {
                const file = this.app.vault.getAbstractFileByPath(e);
                if (file instanceof TFile) {
                    const link = this.app.metadataCache.fileToLinktext(file, "/");
                    return `- [[${link}]]`;
                } else {
                    return `- Not a file: ${e}`;
                }
            })
        ];
        this.writeAndOpenFile(lines.join("\n"));
    }

    async writeAndOpenFile(text: string) {
        await this.app.vault.adapter.write(this.conflictOutputFile, text);

        let fileIsAlreadyOpened = false;
        this.app.workspace.iterateAllLeaves(leaf => {
            if (leaf.getDisplayText() != "" && this.conflictOutputFile.startsWith(leaf.getDisplayText())) {
                fileIsAlreadyOpened = true;
            }
        });
        if (!fileIsAlreadyOpened) {
            this.app.workspace.openLinkText(this.conflictOutputFile, "/", true);
        }
    }

    // region: displaying / formatting messages
    displayMessage(message: string, timeout: number = 4 * 1000): void {
        this.statusBar?.displayMessage(message.toLowerCase(), timeout);

        if (!this.settings.disablePopups) {
            new Notice(message);
        }

        console.log(`git obsidian message: ${message}`);
    }
    displayError(message: string, timeout: number = 0): void {
        new Notice(message);
        console.log(`git obsidian error: ${message}`);
        this.statusBar?.displayMessage(message.toLowerCase(), timeout);
    }

    async formatCommitMessage(template: string): Promise<string> {
        if (template.includes("{{numFiles}}")) {
            let status = await this.git.status();
            let numFiles = status.files.length;
            template = template.replace("{{numFiles}}", String(numFiles));
        }

        if (template.includes("{{files}}")) {
            let status = await this.git.status();

            let changeset: { [key: string]: string[]; } = {};
            status.files.forEach((value: FileStatusResult) => {
                if (value.index in changeset) {
                    changeset[value.index].push(value.path);
                } else {
                    changeset[value.index] = [value.path];
                }
            });

            let chunks = [];
            for (let [action, files] of Object.entries(changeset)) {
                chunks.push(action + " " + files.join(" "));
            }

            let files = chunks.join(", ");

            template = template.replace("{{files}}", files);
        }

        let moment = (window as any).moment;
        return template.replace(
            "{{date}}",
            moment().format(this.settings.commitDateFormat)
        );
    }

    // endregion: displaying / formatting stuff
}


class ObsidianGitSettingsTab extends PluginSettingTab {
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
                    let commitMessagePreview = await plugin.formatCommitMessage(
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
                        plugin.settings.listChangedFilesInMessageBody = value;
                        plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Current branch")
            .setDesc("Switch to a different branch")
            .addDropdown(async (dropdown) => {
                const branchInfo = await plugin.git.branchLocal();
                for (const branch of branchInfo.all) {
                    dropdown.addOption(branch, branch);
                }
                dropdown.setValue(branchInfo.current);
                dropdown.onChange(async (option) => {
                    await plugin.git.checkout(
                        option,
                        [],
                        async (err: Error) => {
                            if (err) {
                                new Notice(err.message);
                                dropdown.setValue(branchInfo.current);
                            } else {
                                new Notice(`Checked out to ${option}`);
                            }
                        }
                    );
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
    }
}

interface StatusBarMessage {
    message: string;
    timeout: number;
}

class StatusBar {
    public messages: StatusBarMessage[] = [];
    public currentMessage: StatusBarMessage;
    public lastMessageTimestamp: number;

    private statusBarEl: HTMLElement;
    private plugin: ObsidianGit;

    constructor(statusBarEl: HTMLElement, plugin: ObsidianGit) {
        this.statusBarEl = statusBarEl;
        this.plugin = plugin;
    }

    public displayMessage(message: string, timeout: number) {
        this.messages.push({
            message: `git: ${message.slice(0, 100)}`,
            timeout: timeout,
        });
        this.display();
    }

    public display() {
        if (this.messages.length > 0 && !this.currentMessage) {
            this.currentMessage = this.messages.shift();
            this.statusBarEl.setText(this.currentMessage.message);
            this.lastMessageTimestamp = Date.now();
        } else if (this.currentMessage) {
            const messageAge = Date.now() - this.lastMessageTimestamp;
            if (messageAge >= this.currentMessage.timeout) {
                this.currentMessage = null;
                this.lastMessageTimestamp = null;
            }
        } else {
            this.displayState();
        }
    }

    private displayState() {
        switch (this.plugin.state) {
            case PluginState.idle:
                this.displayFromNow(this.plugin.lastUpdate);
                break;
            case PluginState.status:
                this.statusBarEl.setText("git: checking repo status..");
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
                this.statusBarEl.setText("git: pulling changes..");
                break;
            case PluginState.conflicted:
                this.statusBarEl.setText("git: you have conflict files..");
                break;
            default:
                this.statusBarEl.setText("git: failed on initialization!");
                break;
        }
    }

    private displayFromNow(timestamp: number): void {
        if (timestamp) {
            let moment = (window as any).moment;
            let fromNow = moment(timestamp).fromNow();
            this.statusBarEl.setText(`git: last update ${fromNow}..`);
        } else {
            this.statusBarEl.setText(`git: ready`);
        }
    }
}
class CustomMessageModal extends SuggestModal<string> {
    plugin: ObsidianGit;

    constructor(plugin: ObsidianGit) {
        super(plugin.app);
        this.plugin = plugin;
        this.setPlaceholder("Type your message and select optional the version with the added date.");
    }


    getSuggestions(query: string): string[] {
        const date = (window as any).moment().format(this.plugin.settings.commitDateFormat);
        if (query == "") query = "...";
        return [query, `${date}: ${query}`, `${query}: ${date}`];
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.innerText = value;
    }

    onChooseSuggestion(item: string, _: MouseEvent | KeyboardEvent): void {
        this.plugin.promiseQueue.addTask(() => this.plugin.createBackup(false, item));
    }

}
class ChangedFilesModal extends FuzzySuggestModal<FileStatusResult> {
    plugin: ObsidianGit;
    changedFiles: FileStatusResult[];

    constructor(plugin: ObsidianGit, changedFiles: FileStatusResult[]) {
        super(plugin.app);
        this.plugin = plugin;
        this.changedFiles = changedFiles;
        this.setPlaceholder("Not supported files will be opened by default app!");
    }

    getItems(): FileStatusResult[] {
        return this.changedFiles;
    }

    getItemText(item: FileStatusResult): string {
        if (item.index == "?" && item.working_dir == "?") {
            return `Untracked | ${item.path}`;
        }

        let working_dir = "";
        let index = "";

        if (item.working_dir != " ") working_dir = `Working dir: ${item.working_dir} `;
        if (item.index != " ") index = `Index: ${item.index}`;

        return `${working_dir}${index} | ${item.path}`;
    }

    onChooseItem(item: FileStatusResult, _: MouseEvent | KeyboardEvent): void {
        if (this.plugin.app.metadataCache.getFirstLinkpathDest(item.path, "") == null) {
            (this.app as any).openWithDefaultApp(item.path);
        } else {
            this.plugin.app.workspace.openLinkText(item.path, "/");
        }
    }
}

class PromiseQueue {
    tasks: (() => Promise<any>)[] = [];

    addTask(task: () => Promise<any>) {
        this.tasks.push(task);
        if (this.tasks.length === 1) {
            this.handleTask();
        }
    }
    async handleTask() {
        if (this.tasks.length > 0) {
            this.tasks[0]().finally(() => {
                this.tasks.shift();
                this.handleTask();
            });
        }
    }
}