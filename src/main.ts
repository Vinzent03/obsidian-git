import { Notice, Plugin, TFile } from "obsidian";
import * as path from "path";
import { ChangedFilesModal } from "src/modals/changedFilesModal";
import { CustomMessageModal } from "src/modals/customMessageModal";
import { PromiseQueue } from "src/promiseQueue";
import { ObsidianGitSettingsTab } from "src/settings";
import { StatusBar } from "src/statusBar";
import { GitManager } from "./gitManager";
import { GeneralModal } from "./modals/generalModal";
import { SimpleGit } from "./simpleGit";
import { PluginState } from "./types";

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
    updateSubmodules: boolean;
    gitPath: string;
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
    updateSubmodules: false,
    gitPath: ""
};

export default class ObsidianGit extends Plugin {
    gitManager: GitManager;
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
            name: "Create backup",
            callback: () => this.promiseQueue.addTask(() => this.createBackup(false))
        });

        this.addCommand({
            id: "edit-remotes",
            name: "Edit remotes",
            callback: async () => this.editRemotes()
        });

        this.addCommand({
            id: "remove-remote",
            name: "Remove remote",
            callback: async () => this.removeRemote()
        });

        this.addCommand({
            id: "init-repo",
            name: "Initialize a new repo",
            callback: async () => this.createNewRepo()
        });

        this.addCommand({
            id: "clone-repo",
            name: "Clone an existing remote repo",
            callback: async () => this.cloneNewRepo()
        });

        this.addCommand({
            id: "commit-push-specified-message",
            name: "Create backup with specified message",
            callback: () => new CustomMessageModal(this).open()
        });

        this.addCommand({
            id: "list-changed-files",
            name: "List changed files",
            callback: async () => {
                const status = await this.gitManager.status();
                this.setState(PluginState.idle);

                new ChangedFilesModal(this, status.changed).open();
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
        this.app.workspace.onLayoutReady(() => this.init());

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
        if (mode === "backup") {
            window.localStorage.setItem(this.manifest.id + ":lastAutoBackup", date.toString());
        } else if (mode === "pull") {
            window.localStorage.setItem(this.manifest.id + ":lastAutoPull", date.toString());
        }
    }

    async loadLastAuto(): Promise<{ "backup": Date, "pull": Date; }> {
        return {
            "backup": new Date(window.localStorage.getItem(this.manifest.id + ":lastAutoBackup") ?? ""),
            "pull": new Date(window.localStorage.getItem(this.manifest.id + ":lastAutoPull") ?? "")
        };
    }

    async init(): Promise<void> {
        try {
            this.gitManager = new SimpleGit(this);

            const result = await this.gitManager.checkRequirements();
            switch (result) {
                case "missing-git":
                    this.displayError("Cannot run git command");
                    break;
                case "missing-repo":
                    new Notice("Can't find a valid git repository. Please create one via the given command.");
                    break;
                case "valid":
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
                    break;
                default:
                    console.log("Something weird happened. The 'checkRequirements' result is " + result);
            }

        } catch (error) {
            this.displayError(error);
            console.error(error);
        }
    }

    async createNewRepo() {
        await this.gitManager.init();
        new Notice("Initialized new repo");
    }

    async cloneNewRepo() {
        const modal = new GeneralModal(this.app, [], "Enter remote URL");
        const url = await modal.open();
        if (url) {
            let dir = await new GeneralModal(this.app, [], "Enter directory for clone. It needs to be empty or not existent.").open();
            if (dir) {
                dir = path.normalize(dir);
                new Notice(`Cloning new repo into "${dir}"`);
                await this.gitManager.clone(url, dir);
                new Notice("Cloned new repo");
            }
        }
    }

    /**
     * Retries to call `this.init()` if necessary, otherwise returns directly
     * @returns true if `this.gitManager` is ready to be used, false if not.
     */
    async isAllInitialized(): Promise<boolean> {
        if (!this.gitReady) {
            await this.init();
        }
        return this.gitReady;
    }

    async pullChangesFromRemote(): Promise<void> {

        if (!await this.isAllInitialized()) return;

        const filesUpdated = await this.gitManager.pull();
        if (filesUpdated > 0) {
            this.displayMessage(`Pulled new changes. ${filesUpdated} files updated`);
        } else {
            this.displayMessage("Everything is up-to-date");
        }

        if (this.gitManager instanceof SimpleGit) {
            const status = await this.gitManager.status();
            if (status.conflicted.length > 0) {
                this.displayError(`You have ${status.conflicted.length} conflict files`);
            }
        }

        this.lastUpdate = Date.now();
        this.setState(PluginState.idle);
    }

    async createBackup(fromAutoBackup: boolean, commitMessage?: string): Promise<void> {
        if (!await this.isAllInitialized()) return;


        if (!fromAutoBackup) {
            const file = this.app.vault.getAbstractFileByPath(this.conflictOutputFile);
            await this.app.vault.delete(file);
        }
        if (this.gitManager instanceof SimpleGit) {
            const status = await this.gitManager.status();

            // check for conflict files on auto backup
            if (fromAutoBackup && status.conflicted.length > 0) {
                this.setState(PluginState.idle);
                this.displayError(`Did not commit, because you have ${status.conflicted.length} conflict files. Please resolve them and commit per command.`);
                this.handleConflict(status.conflicted);
                return;
            }
        }

        const changedFiles = (await this.gitManager.status()).changed;

        if (changedFiles.length !== 0) {
            const commitedFiles = await this.gitManager.commitAll(commitMessage);
            this.displayMessage(`Committed ${commitedFiles} files`);
        } else {
            this.displayMessage("No changes to commit");
        }

        if (!this.settings.disablePush) {
            if (!(await this.gitManager.branchInfo()).tracking) {
                new Notice("No upstream branch is set. Please select one.");
                const remoteBranch = await this.selectRemoteBranch();

                if (remoteBranch == undefined) {
                    this.displayError("Did not push. No upstream-branch is set!", 10000);
                    this.setState(PluginState.idle);
                    return;
                } else {
                    await this.gitManager.updateUpstreamBranch(remoteBranch);
                }
            }


            // Prevent plugin to pull/push at every call of createBackup. Only if unpushed commits are present
            if (await this.gitManager.canPush()) {
                if (this.settings.pullBeforePush) {
                    const pulledFilesLength = await this.gitManager.pull();
                    if (pulledFilesLength > 0) {
                        this.displayMessage(`Pulled ${pulledFilesLength} files from remote`);
                    }
                }

                // Refresh because of pull
                let status: any;
                if (this.gitManager instanceof SimpleGit && (status = await this.gitManager.status()).conflicted.length > 0) {
                    this.displayError(`Cannot push. You have ${status.conflicted.length} conflict files`);
                    this.handleConflict(status.conflicted);
                    return;
                } else {
                    const pushedFiles = await this.gitManager.push();
                    this.lastUpdate = Date.now();
                    this.displayMessage(`Pushed ${pushedFiles} files to remote`);
                }
            } else {
                this.displayMessage("No changes to push");
            }
        }
        this.setState(PluginState.idle);
    }

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

    async editRemotes(): Promise<string | undefined> {
        if (!await this.isAllInitialized()) return;

        const remotes = await this.gitManager.getRemotes();

        const nameModal = new GeneralModal(this.app, remotes, "Select or create a new remote by typing its name and selecting it");
        const remoteName = await nameModal.open();

        if (remoteName) {
            const urlModal = new GeneralModal(this.app, [], "Enter the remote URL");
            const remoteURL = await urlModal.open();
            await this.gitManager.setRemote(remoteName, remoteURL);
            return remoteName;
        }

    }

    async selectRemoteBranch(): Promise<string | undefined> {
        let remotes = await this.gitManager.getRemotes();
        let selectedRemote: string;
        if (remotes.length === 0) {
            selectedRemote = await this.editRemotes();
            if (selectedRemote == undefined) {
                remotes = await this.gitManager.getRemotes();
            }
        }

        const nameModal = new GeneralModal(this.app, remotes, "Select or create a new remote by typing its name and selecting it");
        const remoteName = selectedRemote ?? await nameModal.open();

        if (remoteName) {
            this.displayMessage("Fetching remote branches");
            await this.gitManager.fetch(remoteName);
            const branches = await this.gitManager.getRemoteBranches(remoteName);
            const branchModal = new GeneralModal(this.app, branches, "Select or create a new remote branch by typing its name and selecting it");
            return await branchModal.open();
        }
    }

    async removeRemote() {
        if (!await this.isAllInitialized()) return;


        const remotes = await this.gitManager.getRemotes();

        const nameModal = new GeneralModal(this.app, remotes, "Select a remote");
        const remoteName = await nameModal.open();

        if (remoteName) {
            this.gitManager.removeRemote(remoteName);
        }
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
    displayError(message: any, timeout: number = 0): void {
        // Some errors might not be of type string
        message = message.toString();
        new Notice(message);
        console.log(`git obsidian error: ${message}`);
        this.statusBar?.displayMessage(message.toLowerCase(), timeout);
    }
}