import { debounce, Debouncer, EventRef, Notice, Plugin, TFile } from "obsidian";
import * as path from "path";
import { PromiseQueue } from "src/promiseQueue";
import { ObsidianGitSettingsTab } from "src/settings";
import { StatusBar } from "src/statusBar";
import { ChangedFilesModal } from "src/ui/modals/changedFilesModal";
import { CustomMessageModal } from "src/ui/modals/customMessageModal";
import { DEFAULT_SETTINGS, DIFF_VIEW_CONFIG, GIT_VIEW_CONFIG } from "./constants";
import { GitManager } from "./gitManager";
import { IsomorphicGit } from "./isomorphicGit";
import { ObsidianGitSettings, PluginState } from "./types";
import DiffView from "./ui/diff/diffView";
import addIcons from "./ui/icons";
import { GeneralModal } from "./ui/modals/generalModal";
import GitView from "./ui/sidebar/sidebarView";

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
    autoBackupDebouncer: Debouncer<undefined>;
    onFileModifyEventRef: EventRef;

    setState(state: PluginState) {
        this.state = state;
        this.statusBar?.display();
    }

    async onload() {
        console.log('loading ' + this.manifest.name + " plugin");
        await this.loadSettings();

        addIcons();

        this.registerView(GIT_VIEW_CONFIG.type, (leaf) => {
            return new GitView(leaf, this);
        });

        this.registerView(DIFF_VIEW_CONFIG.type, (leaf) => {
            return new DiffView(leaf, this);
        });
        (this.app.workspace as any).registerHoverLinkSource(GIT_VIEW_CONFIG.type, {
            display: 'Git View',
            defaultMod: true,
        });

        this.addSettingTab(new ObsidianGitSettingsTab(this.app, this));

        this.addCommand({
            id: 'open-git-view',
            name: 'Open source control view',
            callback: async () => {
                if (this.app.workspace.getLeavesOfType(GIT_VIEW_CONFIG.type).length === 0) {
                    await this.app.workspace.getRightLeaf(false).setViewState({
                        type: GIT_VIEW_CONFIG.type,
                    });
                }
                this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType(GIT_VIEW_CONFIG.type).first());
            },
        });

        this.addCommand({
            id: 'open-diff-view',
            name: 'Open diff view',
            editorCallback: async (editor, view) => {
                this.app.workspace.createLeafBySplit(view.leaf).setViewState({ type: DIFF_VIEW_CONFIG.type });
                dispatchEvent(new CustomEvent('diff-update', { detail: { path: view.file.path } }));
            },
        });

        this.addCommand({
            id: 'view-file-on-github',
            name: 'Open file on GitHub',
            editorCallback: (editor, { file }) => openLineInGitHub(editor, file, this.gitManager),
        });

        this.addCommand({
            id: 'view-history-on-github',
            name: 'Open file history on GitHub',
            editorCallback: (_, { file }) => openHistoryInGitHub(file, this.gitManager),
        });

        this.addCommand({
            id: "pull",
            name: "Pull",
            callback: () => this.promiseQueue.addTask(() => this.pullChangesFromRemote()),
        });

        this.addCommand({
            id: "push",
            name: "Create backup",
            callback: () => this.promiseQueue.addTask(() => this.createBackup(false))
        });
        this.addCommand({
            id: "commit-push-specified-message",
            name: "Create backup with specific message",
            callback: () => this.promiseQueue.addTask(() => this.createBackup(false, true))
        });

        this.addCommand({
            id: "commit",
            name: "Commit all changes",
            callback: () => this.promiseQueue.addTask(() => this.commit(false))
        });

        this.addCommand({
            id: "commit-specified-message",
            name: "Commit all changes with specific message",
            callback: () => this.promiseQueue.addTask(() => this.commit(false, true))
        });

        this.addCommand({
            id: "push2",
            name: "Push",
            callback: () => this.promiseQueue.addTask(() => this.push())
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
        (this.app.workspace as any).unregisterHoverLinkSource(GIT_VIEW_CONFIG.type);
        this.app.workspace.detachLeavesOfType(GIT_VIEW_CONFIG.type);
        this.app.workspace.detachLeavesOfType(DIFF_VIEW_CONFIG.type);
        this.clearAutoPull();
        this.clearAutoBackup();
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
            this.gitManager = new IsomorphicGit(this);

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

    ///Used for command
    async pullChangesFromRemote(): Promise<void> {

        if (!await this.isAllInitialized()) return;

        await this.gitManager.pull()
        this.displayMessage("Pulled");

        if (this.gitManager instanceof IsomorphicGit) {
            const status = await this.gitManager.status();
            if (status.conflicted.length > 0) {
                this.displayError(`You have ${status.conflicted.length} conflict ${status.conflicted.length > 1 ? 'files' : 'file'}`);
            }
        }

        this.lastUpdate = Date.now();
        this.setState(PluginState.idle);
    }

    async createBackup(fromAutoBackup: boolean, requestCustomMessage: boolean = false): Promise<void> {
        if (!await this.isAllInitialized()) return;

        if (!fromAutoBackup) {
            const file = this.app.vault.getAbstractFileByPath(this.conflictOutputFile);
            await this.app.vault.delete(file);
        }
        if (this.gitManager instanceof IsomorphicGit) {
            const status = await this.gitManager.status();

            // check for conflict files on auto backup
            if (fromAutoBackup && status.conflicted.length > 0) {
                this.setState(PluginState.idle);
                this.displayError(`Did not commit, because you have ${status.conflicted.length} conflict ${status.conflicted.length > 1 ? 'files' : 'file'}. Please resolve them and commit per command.`);
                this.handleConflict(status.conflicted);
                return;
            }
        }

        if (!(await this.commit(fromAutoBackup, requestCustomMessage))) return;

        if (!this.settings.disablePush) {
            // Prevent plugin to pull/push at every call of createBackup. Only if unpushed commits are present
            if (await this.gitManager.canPush()) {
                if (this.settings.pullBeforePush) {
                    await this.gitManager.pull()
                }

                if (!(await this.push())) return;
            } else {
                this.displayMessage("No changes to push");
            }
        }
        this.setState(PluginState.idle);
    }

    async commit(fromAutoBackup: boolean, requestCustomMessage: boolean = false): Promise<boolean> {
        if (!await this.isAllInitialized()) return false;

        const changedFiles = (await this.gitManager.status()).changed;

        if (changedFiles.length !== 0) {
            let commitMessage: string | undefined;
            if ((fromAutoBackup && this.settings.customMessageOnAutoBackup || requestCustomMessage)) {
                if (!this.settings.disablePopups && fromAutoBackup) {
                    new Notice("Auto backup: Please enter a custom commit message. Leave empty to abort",);
                }
                const tempMessage = await new CustomMessageModal(this, true).open();

                if (tempMessage != undefined && tempMessage != "" && tempMessage != "...") {
                    commitMessage = tempMessage;
                } else {
                    this.setState(PluginState.idle);
                    return false;
                }
            }
            const committedFiles = await this.gitManager.commitAll(commitMessage);
            this.displayMessage(`Committed ${committedFiles} ${committedFiles == 0 ? 'file' : 'files'}`);
        } else {
            this.displayMessage("No changes to commit");
        }
        this.setState(PluginState.idle);
        return true;
    }

    async push(): Promise<boolean> {
        if (!await this.isAllInitialized()) return false;
        if (!this.remotesAreSet()) {
            return false;
        }
        // Refresh because of pull
        let status: any;
        if (this.gitManager instanceof IsomorphicGit && (status = await this.gitManager.status()).conflicted.length > 0) {
            this.displayError(`Cannot push. You have ${status.conflicted.length} conflict files`);
            this.handleConflict(status.conflicted);
            return false;
        } else {
            console.log("Pushign....")
            const pushedFiles = await this.gitManager.push();
            console.log("Pushed!", pushedFiles)
            this.lastUpdate = Date.now();
            this.displayMessage(`Pushed ${pushedFiles} ${pushedFiles > 1 ? 'files' : 'file'} to remote`);
            this.setState(PluginState.idle);
            return true;
        }
    }

    async remotesAreSet(): Promise<boolean> {
        if (!(await this.gitManager.branchInfo()).tracking) {
            new Notice("No upstream branch is set. Please select one.");
            const remoteBranch = await this.selectRemoteBranch();

            if (remoteBranch == undefined) {
                this.displayError("Did not push. No upstream-branch is set!", 10000);
                this.setState(PluginState.idle);
                return false;
            } else {
                await this.gitManager.updateUpstreamBranch(remoteBranch);
                return true;
            }
        }
        return true;
    }

    startAutoBackup(minutes?: number) {
        const time = (minutes ?? this.settings.autoSaveInterval) * 60000;
        if (this.settings.autoBackupAfterFileChange) {
            if (minutes === 0) {
                this.doAutoBackup();
            } else {
                this.onFileModifyEventRef = this.app.vault.on("modify", () => this.autoBackupDebouncer());
                this.autoBackupDebouncer = debounce(() => this.doAutoBackup(), time, true);
            }
        } else {
            this.timeoutIDBackup = window.setTimeout(() => this.doAutoBackup(), time);
        }
    }

    doAutoBackup() {
        this.promiseQueue.addTask(() => this.createBackup(true));
        this.saveLastAuto(new Date(), "backup");
        this.saveSettings();
        this.startAutoBackup();
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
        let wasActive = false;
        if (this.timeoutIDBackup) {
            window.clearTimeout(this.timeoutIDBackup);
            this.timeoutIDBackup = undefined;
            wasActive = true;
        }
        if (this.onFileModifyEventRef) {
            this.autoBackupDebouncer?.cancel();
            this.app.vault.offref(this.onFileModifyEventRef);
            this.onFileModifyEventRef = undefined;
            wasActive = true;
        }
        return wasActive;
    }

    clearAutoPull(): boolean {
        if (this.timeoutIDPull) {
            window.clearTimeout(this.timeoutIDPull);
            this.timeoutIDPull = undefined;
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
            new Notice(message, 5 * 1000);
        }

        console.log(`git obsidian message: ${message}`);
    }
    displayError(message: any, timeout: number = 0): void {
        // Some errors might not be of type string
        message = message.toString();
        new Notice(message, 15 * 1000);
        console.log(`git obsidian error: ${message}`);
        this.statusBar?.displayMessage(message.toLowerCase(), timeout);
    }
}
