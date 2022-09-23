import { Errors } from "isomorphic-git";
import { debounce, Debouncer, EventRef, Menu, normalizePath, Notice, Platform, Plugin, TAbstractFile, TFile } from "obsidian";
import { LineAuthoringFeature } from "src/lineAuthor/lineAuthorIntegration";
import { PromiseQueue } from "src/promiseQueue";
import { ObsidianGitSettingsTab } from "src/settings";
import { StatusBar } from "src/statusBar";
import { ChangedFilesModal } from "src/ui/modals/changedFilesModal";
import { CustomMessageModal } from "src/ui/modals/customMessageModal";
import { DEFAULT_SETTINGS, DIFF_VIEW_CONFIG, GIT_VIEW_CONFIG } from "./constants";
import { GitManager } from "./gitManager";
import { IsomorphicGit } from "./isomorphicGit";
import { LocalStorageSettings } from "./localStorageSettings";
import { openHistoryInGitHub, openLineInGitHub } from "./openInGitHub";
import { SimpleGit } from "./simpleGit";
import { FileStatusResult, mergeSettingsByPriority, ObsidianGitSettings, PluginState, Status, UnstagedFile } from "./types";
import DiffView from "./ui/diff/diffView";
import { BranchModal } from "./ui/modals/branchModal";
import { GeneralModal } from "./ui/modals/generalModal";
import { IgnoreModal } from "./ui/modals/ignoreModal";
import GitView from "./ui/sidebar/sidebarView";
import { BranchStatusBar } from "./ui/statusBar/branchStatusBar";
import { getNewLeaf } from "./utils";

export default class ObsidianGit extends Plugin {
    gitManager: GitManager;
    localStorage: LocalStorageSettings;
    settings: ObsidianGitSettings;
    statusBar?: StatusBar;
    branchBar?: BranchStatusBar;
    state: PluginState;
    timeoutIDBackup?: number;
    timeoutIDPush?: number;
    timeoutIDPull?: number;
    lastUpdate: number;
    lastPulledFiles: FileStatusResult[];
    gitReady = false;
    promiseQueue: PromiseQueue = new PromiseQueue();
    conflictOutputFile = "conflict-files-obsidian-git.md";
    autoBackupDebouncer: Debouncer<any, void>;
    onFileModifyEventRef?: EventRef;
    offlineMode = false;
    loading = false;
    cachedStatus: Status | undefined;
    modifyEvent: EventRef;
    deleteEvent: EventRef;
    createEvent: EventRef;
    renameEvent: EventRef;
    lineAuthoringFeature: LineAuthoringFeature = new LineAuthoringFeature(this);

    debRefresh: Debouncer<any, void>;

    setState(state: PluginState): void {
        this.state = state;
        this.statusBar?.display();
    }

    async updateCachedStatus(): Promise<Status> {
        this.cachedStatus = await this.gitManager.status();
        return this.cachedStatus;
    }

    async refresh() {
        const gitView = this.app.workspace.getLeavesOfType(GIT_VIEW_CONFIG.type);

        if (this.settings.changedFilesInStatusBar || gitView.length > 0) {
            this.loading = true;
            dispatchEvent(new CustomEvent("git-view-refresh"));

            await this.updateCachedStatus();
            this.loading = false;
            dispatchEvent(new CustomEvent("git-view-refresh"));
        }

        // We don't put a line authoring refresh here, as it would force a re-loading
        // of the line authoring feature - which would lead to a jumpy editor-view in the
        // ui after every rename event.
    }

    async refreshUpdatedHead() {
        this.lineAuthoringFeature.refreshLineAuthorViews();
    }

    async onload() {
        console.log('loading ' + this.manifest.name + " plugin");
        this.localStorage = new LocalStorageSettings(this);

        this.localStorage.migrate();
        await this.loadSettings();
        this.migrateSettings();

        this.addSettingTab(new ObsidianGitSettingsTab(this.app, this));

        if (!this.localStorage.getPluginDisabled()) {
            this.loadPlugin();
        }
    }

    async loadPlugin() {
        addEventListener("git-refresh", this.refresh.bind(this));
        addEventListener("git-head-update", this.refreshUpdatedHead.bind(this));

        this.registerView(GIT_VIEW_CONFIG.type, (leaf) => {
            return new GitView(leaf, this);
        });

        this.registerView(DIFF_VIEW_CONFIG.type, (leaf) => {
            return new DiffView(leaf, this);
        });

        this.lineAuthoringFeature.onLoadPlugin();

        (this.app.workspace as any).registerHoverLinkSource(GIT_VIEW_CONFIG.type, {
            display: 'Git View',
            defaultMod: true,
        });

        this.setRefreshDebouncer();

        this.addCommand({
            id: 'edit-gitignore',
            name: 'Edit .gitignore',
            callback: async () => {
                const content = await this.app.vault.adapter.read(this.gitManager.getVaultPath(".gitignore"));
                const modal = new IgnoreModal(this.app, content);
                const res = await modal.open();
                if (res !== undefined) {
                    await this.app.vault.adapter.write(this.gitManager.getVaultPath(".gitignore"), res);
                    this.refresh();
                }
            },
        });
        this.addCommand({
            id: 'open-git-view',
            name: 'Open source control view',
            callback: async () => {
                const leafs = this.app.workspace.getLeavesOfType(GIT_VIEW_CONFIG.type);
                if (leafs.length === 0) {
                    await this.app.workspace.getRightLeaf(false).setViewState({
                        type: GIT_VIEW_CONFIG.type,
                    });
                }
                this.app.workspace.revealLeaf(leafs.first()!);

                dispatchEvent(new CustomEvent("git-refresh"));

            },
        });

        this.addCommand({
            id: 'open-diff-view',
            name: 'Open diff view',
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (checking) {
                    return file !== null;
                } else {
                    getNewLeaf().setViewState({ type: DIFF_VIEW_CONFIG.type, state: { staged: false, file: file!.path } });
                }
            }

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
            id: "add-to-gitignore",
            name: "Add file to gitignore",
            checkCallback: (checking) => {
                const file = app.workspace.getActiveFile();
                if (checking) {
                    return file !== null;
                } else {
                    app.vault.adapter.append(this.gitManager.getVaultPath(".gitignore"), "\n" + this.gitManager.asRepositoryRelativePath(file!.path, true))
                        .then(() => {
                            this.refresh();
                        });
                }
            },
        });

        this.addCommand({
            id: "push",
            name: "Create backup",
            callback: () => this.promiseQueue.addTask(() => this.createBackup(false))
        });

        this.addCommand({
            id: "backup-and-close",
            name: "Create backup and close",
            callback: () => this.promiseQueue.addTask(async () => {
                await this.createBackup(false);
                window.close();
            })
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
            id: "commit-staged",
            name: "Commit staged",
            callback: () => this.promiseQueue.addTask(() => this.commit(false, false, true))
        });

        this.addCommand({
            id: "commit-staged-specified-message",
            name: "Commit staged with specific message",
            callback: () => this.promiseQueue.addTask(() => this.commit(false, true, true))
        });

        this.addCommand({
            id: "push2",
            name: "Push",
            callback: () => this.promiseQueue.addTask(() => this.push())
        });

        this.addCommand({
            id: "stage-current-file",
            name: "Stage current file",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (checking) {
                    return file !== null;
                } else {
                    this.promiseQueue.addTask(() => this.stageFile(file!));
                }
            }
        });

        this.addCommand({
            id: "unstage-current-file",
            name: "Unstage current file",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (checking) {
                    return file !== null;
                } else {
                    this.promiseQueue.addTask(() => this.unstageFile(file!));
                }
            }
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
            id: "delete-repo",
            name: "CAUTION: Delete repository",
            callback: async () => {
                const repoExists = await this.app.vault.adapter.exists(`${this.settings.basePath}/.git`);
                if (repoExists) {
                    const modal = new GeneralModal(this.app, ["NO", "YES"], "Do you really want to delete the repository (.git directory)? This action cannot be undone.", false, true);
                    const shouldDelete = await modal.open() === "YES";
                    if (shouldDelete) {
                        await this.app.vault.adapter.rmdir(`${this.settings.basePath}/.git`, true);
                        new Notice("Successfully deleted repository. Reloading plugin...");
                        this.unloadPlugin();
                        this.init();

                    }
                } else {
                    new Notice("No repository found");
                }
            }
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
                if (!await this.isAllInitialized()) return;

                const status = await this.gitManager.status();
                this.setState(PluginState.idle);
                if (status.changed.length + status.staged.length > 500) {
                    this.displayError("Too many changes to display");
                    return;
                }

                new ChangedFilesModal(this, status.changed).open();
            }
        });

        this.addCommand({
            id: "switch-branch",
            name: "Switch branch",
            callback: () => {
                this.switchBranch();
            }
        });

        this.addCommand({
            id: "create-branch",
            name: "Create new branch",
            callback: () => {
                this.createBranch();
            }
        });

        this.addCommand({
            id: "delete-branch",
            name: "Delete branch",
            callback: () => {
                this.deleteBranch();
            }
        });

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file, source) => {
                this.handleFileMenu(menu, file, source);
            }));


        if (this.settings.showStatusBar) {
            // init statusBar
            const statusBarEl = this.addStatusBarItem();
            this.statusBar = new StatusBar(statusBarEl, this);
            this.registerInterval(
                window.setInterval(() => this.statusBar?.display(), 1000)
            );
        }


        if (Platform.isDesktop && this.settings.showBranchStatusBar) {
            const branchStatusBarEl = this.addStatusBarItem();
            this.branchBar = new BranchStatusBar(branchStatusBarEl, this);
            this.registerInterval(
                window.setInterval(() => this.branchBar?.display(), 60000)
            );
        }

        this.app.workspace.onLayoutReady(() => this.init());

    }

    setRefreshDebouncer(): void {
        this.debRefresh?.cancel();
        this.debRefresh = debounce(
            () => {
                if (this.settings.refreshSourceControl) {
                    this.refresh();
                }
            },
            this.settings.refreshSourceControlTimer,
            true
        );
    }

    async showNotices(): Promise<void> {
        const length = 10000;
        if (this.manifest.id === "obsidian-git" && Platform.isDesktopApp && !this.settings.showedMobileNotice) {
            new Notice("Obsidian Git is now available on mobile! Please read the plugin's README for more information.", length);
            this.settings.showedMobileNotice = true;
            await this.saveSettings();
        }
        if (this.manifest.id === "obsidian-git-isomorphic") {
            new Notice("Obsidian Git Mobile is now deprecated. Please uninstall it and install Obsidian Git instead.", length);
        }
    }

    handleFileMenu(menu: Menu, file: TAbstractFile, source: string): void {
        if (source !== "file-explorer-context-menu") {
            return;
        }
        if (!file) {
            return;
        }
        if (!this.gitReady) return;
        menu.addItem((item) => {
            item
                .setTitle(`Git: Stage`)
                .setIcon('plus-circle')
                .setSection("action")
                .onClick((_) => {
                    this.promiseQueue.addTask(async () => {
                        if (file instanceof TFile) {
                            await this.gitManager.stage(file.path, true);
                        } else {
                            await this.gitManager.stageAll({ dir: this.gitManager.asRepositoryRelativePath(file.path, true) });
                        }
                        this.displayMessage(`Staged ${file.path}`);
                    });
                });
        });
        menu.addItem((item) => {
            item
                .setTitle(`Git: Unstage`)
                .setIcon('minus-circle')
                .setSection("action")
                .onClick((_) => {
                    this.promiseQueue.addTask(async () => {
                        if (file instanceof TFile) {
                            await this.gitManager.unstage(file.path, true);
                        } else {
                            await this.gitManager.unstageAll({ dir: this.gitManager.asRepositoryRelativePath(file.path, true) });
                        }
                        this.displayMessage(`Unstaged ${file.path}`);
                    });
                });
        });
    }

    async migrateSettings(): Promise<void> {
        if (this.settings.mergeOnPull != undefined) {
            this.settings.syncMethod = this.settings.mergeOnPull ? 'merge' : 'rebase';
            this.settings.mergeOnPull = undefined;
            await this.saveSettings();
        }
        if (this.settings.autoCommitMessage === undefined) {
            this.settings.autoCommitMessage = this.settings.commitMessage;
            await this.saveSettings();
        }
        if (this.settings.gitPath != undefined) {
            this.localStorage.setGitPath(this.settings.gitPath);
            this.settings.gitPath = undefined;
            await this.saveSettings();
        }
    }

    unloadPlugin() {
        this.gitReady = false;
        dispatchEvent(new CustomEvent('git-refresh'));

        this.lineAuthoringFeature.deactivateFeature();
        this.clearAutoPull();
        this.clearAutoPush();
        this.clearAutoBackup();
        removeEventListener("git-refresh", this.refresh.bind(this));
        removeEventListener("git-head-update", this.refreshUpdatedHead.bind(this));
        this.app.metadataCache.offref(this.modifyEvent);
        this.app.metadataCache.offref(this.deleteEvent);
        this.app.metadataCache.offref(this.createEvent);
        this.app.metadataCache.offref(this.renameEvent);
        this.debRefresh.cancel();
    }

    async onunload() {
        (this.app.workspace as any).unregisterHoverLinkSource(GIT_VIEW_CONFIG.type);
        this.app.workspace.detachLeavesOfType(GIT_VIEW_CONFIG.type);
        this.app.workspace.detachLeavesOfType(DIFF_VIEW_CONFIG.type);

        this.unloadPlugin();

        console.log('unloading ' + this.manifest.name + " plugin");
    }

    async loadSettings() {
        let data: ObsidianGitSettings = await this.loadData();
        //Check for existing settings
        if (data == undefined) {
            data = <ObsidianGitSettings>{ showedMobileNotice: true };
        }
        this.settings = mergeSettingsByPriority(DEFAULT_SETTINGS, data);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async saveLastAuto(date: Date, mode: "backup" | "pull" | "push") {
        if (mode === "backup") {
            this.localStorage.setLastAutoBackup(date.toString());
        } else if (mode === "pull") {
            this.localStorage.setLastAutoPull(date.toString());
        } else if (mode === "push") {
            this.localStorage.setLastAutoPush(date.toString());
        }
    }

    async loadLastAuto(): Promise<{ "backup": Date, "pull": Date; "push": Date; }> {
        return {
            "backup": new Date(this.localStorage.getLastAutoBackup() ?? ""),
            "pull": new Date(this.localStorage.getLastAutoPull() ?? ""),
            "push": new Date(this.localStorage.getLastAutoPush() ?? ""),
        };
    }

    get useSimpleGit(): boolean {
        return Platform.isDesktopApp;
    }

    async init(): Promise<void> {
        this.showNotices();

        try {
            if (this.useSimpleGit) {
                this.gitManager = new SimpleGit(this);
                await (this.gitManager as SimpleGit).setGitInstance();

            } else {
                this.gitManager = new IsomorphicGit(this);
            }

            const result = await this.gitManager.checkRequirements();
            switch (result) {
                case "missing-git":
                    this.displayError("Cannot run git command");
                    break;
                case "missing-repo":
                    new Notice("Can't find a valid git repository. Please create one via the given command or clone an existing repo.");
                    break;
                case "valid":
                    this.gitReady = true;
                    this.setState(PluginState.idle);

                    this.modifyEvent = this.app.vault.on("modify", () => {
                        this.debRefresh();
                    });
                    this.deleteEvent = this.app.vault.on("delete", () => {
                        this.debRefresh();
                    });
                    this.createEvent = this.app.vault.on("create", () => {
                        this.debRefresh();
                    });
                    this.renameEvent = this.app.vault.on("rename", () => {
                        this.debRefresh();
                    });

                    this.registerEvent(this.modifyEvent);
                    this.registerEvent(this.deleteEvent);
                    this.registerEvent(this.createEvent);
                    this.registerEvent(this.renameEvent);

                    this.branchBar?.display();

                    this.lineAuthoringFeature.conditionallyActivateBySettings();

                    dispatchEvent(new CustomEvent('git-refresh'));

                    if (this.settings.autoPullOnBoot) {
                        this.promiseQueue.addTask(() => this.pullChangesFromRemote());
                    }
                    const lastAutos = await this.loadLastAuto();

                    if (this.settings.autoSaveInterval > 0) {
                        const now = new Date();

                        const diff = this.settings.autoSaveInterval - (Math.round(((now.getTime() - lastAutos.backup.getTime()) / 1000) / 60));
                        this.startAutoBackup(diff <= 0 ? 0 : diff);
                    }
                    if (this.settings.differentIntervalCommitAndPush && this.settings.autoPushInterval > 0) {
                        const now = new Date();

                        const diff = this.settings.autoPushInterval - (Math.round(((now.getTime() - lastAutos.push.getTime()) / 1000) / 60));
                        this.startAutoPush(diff <= 0 ? 0 : diff);
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
        await this.init();
    }

    async cloneNewRepo() {
        const modal = new GeneralModal(this.app, [], "Enter remote URL");
        const url = await modal.open();
        if (url) {
            const confirmOption = "Vault Root";
            let dir = await new GeneralModal(this.app, [confirmOption], "Enter directory for clone. It needs to be empty or not existent.", this.gitManager instanceof IsomorphicGit).open();
            if (dir !== undefined) {
                if (dir === confirmOption) {
                    dir = ".";
                }

                dir = normalizePath(dir);
                if (dir === "/") {
                    dir = ".";
                }

                if (dir === ".") {
                    const modal = new GeneralModal(this.app, ["NO", "YES"], `Does your remote repo contain a ${app.vault.configDir} directory at the root?`, false, true);
                    const containsConflictDir = await modal.open();
                    if (containsConflictDir === undefined) {
                        new Notice("Aborted clone");
                        return;
                    } else if (containsConflictDir === "YES") {
                        const confirmOption = "DELETE ALL YOUR LOCAL CONFIG AND PLUGINS";
                        const modal = new GeneralModal(this.app, ["Abort clone", confirmOption], `To avoid conflicts, the local ${app.vault.configDir} directory needs to be deleted.`, false, true);
                        const shouldDelete = await modal.open() === confirmOption;
                        if (shouldDelete) {
                            await this.app.vault.adapter.rmdir(app.vault.configDir, true);
                        } else {
                            new Notice("Aborted clone");
                            return;
                        }
                    }
                }
                new Notice(`Cloning new repo into "${dir}"`);
                await this.gitManager.clone(url, dir);
                new Notice("Cloned new repo.");
                new Notice("Please restart Obsidian");

                if (dir && dir !== ".") {
                    this.settings.basePath = dir;
                    this.saveSettings();
                }
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

        const filesUpdated = await this.pull();
        if (!filesUpdated) {
            this.displayMessage("Everything is up-to-date");
        }

        if (this.gitManager instanceof SimpleGit) {
            const status = await this.gitManager.status();
            if (status.conflicted.length > 0) {
                this.displayError(`You have ${status.conflicted.length} conflict ${status.conflicted.length > 1 ? 'files' : 'file'}`);
                this.handleConflict(status.conflicted);
            }
        }

        dispatchEvent(new CustomEvent('git-refresh'));
        this.lastUpdate = Date.now();
        this.setState(PluginState.idle);
    }

    async createBackup(fromAutoBackup: boolean, requestCustomMessage = false): Promise<void> {
        if (!await this.isAllInitialized()) return;

        if (this.settings.syncMethod == "reset" && this.settings.pullBeforePush) {
            await this.pull();
        }

        if (!(await this.commit(fromAutoBackup, requestCustomMessage))) return;

        if (!this.settings.disablePush) {
            // Prevent plugin to pull/push at every call of createBackup. Only if unpushed commits are present
            if (await this.gitManager.canPush()) {
                if (this.settings.syncMethod != "reset" && this.settings.pullBeforePush) {
                    await this.pull();
                }

                await this.push();
            } else {
                this.displayMessage("No changes to push");
            }
        }
        this.setState(PluginState.idle);
    }

    // Returns true if commit was successfully
    async commit(fromAutoBackup: boolean, requestCustomMessage = false, onlyStaged = false): Promise<boolean> {
        if (!await this.isAllInitialized()) return false;

        const hadConflict = this.localStorage.getConflict() === "true";

        let changedFiles: { vault_path: string; }[];
        let status: Status | undefined;
        let unstagedFiles: UnstagedFile[] | undefined;

        if (this.gitManager instanceof SimpleGit) {
            const file = this.app.vault.getAbstractFileByPath(this.conflictOutputFile);
            if (file != null)
                await this.app.vault.delete(file);
            status = await this.updateCachedStatus();

            // check for conflict files on auto backup
            if (fromAutoBackup && status.conflicted.length > 0) {
                this.displayError(`Did not commit, because you have ${status.conflicted.length} conflict ${status.conflicted.length > 1 ? 'files' : 'file'}. Please resolve them and commit per command.`);
                this.handleConflict(status.conflicted);
                return false;
            }
            changedFiles = [...status.changed, ...status.staged];
        } else if (fromAutoBackup && hadConflict) {
            this.setState(PluginState.conflicted);
            this.displayError(`Did not commit, because you have conflict files. Please resolve them and commit per command.`);
            return false;
        } else if (hadConflict) {
            const file = this.app.vault.getAbstractFileByPath(this.conflictOutputFile);
            if (file != null)
                await this.app.vault.delete(file);
            status = await this.updateCachedStatus();
            changedFiles = [...status.changed, ...status.staged];
        } else {
            if (onlyStaged) {
                changedFiles = await (this.gitManager as IsomorphicGit).getStagedFiles();
            } else {
                unstagedFiles = await (this.gitManager as IsomorphicGit).getUnstagedFiles();
                changedFiles = unstagedFiles.map(({ filepath }) => ({ vault_path: this.gitManager.getVaultPath(filepath) }));
            }
        }


        if (await this.hasTooBigFiles(changedFiles)) {
            this.setState(PluginState.idle);
            return false;
        }


        if (changedFiles.length !== 0 || hadConflict) {
            let commitMessage = fromAutoBackup ? this.settings.autoCommitMessage : this.settings.commitMessage;
            if ((fromAutoBackup && this.settings.customMessageOnAutoBackup) || requestCustomMessage) {
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
            let committedFiles: number | undefined;
            if (onlyStaged) {
                committedFiles = await this.gitManager.commit(commitMessage);
            } else {
                committedFiles = await this.gitManager.commitAll({ message: commitMessage, status, unstagedFiles });
            }
            let roughly = false;
            if (committedFiles === undefined) {
                roughly = true;
                committedFiles = changedFiles.length;
            }
            this.displayMessage(`Committed${roughly ? " approx." : ""} ${committedFiles} ${committedFiles > 1 ? 'files' : 'file'}`);
        } else {
            this.displayMessage("No changes to commit");
        }
        dispatchEvent(new CustomEvent('git-head-update'));
        dispatchEvent(new CustomEvent('git-refresh'));

        this.setState(PluginState.idle);
        return true;
    }

    async hasTooBigFiles(files: ({ vault_path: string; })[]): Promise<boolean> {
        const branchInfo = await this.gitManager.branchInfo();
        const remote = branchInfo.tracking?.split("/")[0];

        if (remote) {
            const remoteUrl = await this.gitManager.getRemoteUrl(remote);

            //Check for files >100mb on GitHub remote
            if (remoteUrl?.includes("github.com")) {

                const tooBigFiles = files.filter(f => {
                    const file = this.app.vault.getAbstractFileByPath(f.vault_path);
                    if (file instanceof TFile) {
                        return file.stat.size >= 100000000;
                    }
                    return false;
                });
                if (tooBigFiles.length > 0) {
                    this.displayError(`Did not commit, because following files are too big: ${tooBigFiles.map((e) => e.vault_path)}. Please remove them.`);

                    return true;
                }
            }
        }
        return false;
    }

    async push(): Promise<boolean> {
        if (!await this.isAllInitialized()) return false;
        if (!await this.remotesAreSet()) {
            return false;
        }

        const file = this.app.vault.getAbstractFileByPath(this.conflictOutputFile);
        const hadConflict = this.localStorage.getConflict() === "true";
        if (this.gitManager instanceof SimpleGit && file) await this.app.vault.delete(file);

        // Refresh because of pull
        let status: any;
        if (this.gitManager instanceof SimpleGit && (status = await this.updateCachedStatus()).conflicted.length > 0) {
            this.displayError(`Cannot push. You have ${status.conflicted.length} conflict ${status.conflicted.length > 1 ? 'files' : 'file'}`);
            this.handleConflict(status.conflicted);
            return false;
        } else if (this.gitManager instanceof IsomorphicGit && hadConflict) {
            this.displayError(`Cannot push. You have conflict files`);
            this.setState(PluginState.conflicted);
            return false;
        } {
            console.log("Pushing....");
            const pushedFiles = await this.gitManager.push();
            console.log("Pushed!", pushedFiles);
            this.lastUpdate = Date.now();
            if (pushedFiles > 0) {
                this.displayMessage(`Pushed ${pushedFiles} ${pushedFiles > 1 ? 'files' : 'file'} to remote`);
            } else {
                this.displayMessage(`No changes to push`);
            }
            this.offlineMode = false;
            this.setState(PluginState.idle);

            return true;
        }
    }

    /// Used for internals
    /// Returns whether the pull added a commit or not.
    async pull(): Promise<boolean> {
        if (!await this.remotesAreSet()) {
            return false;
        }
        const pulledFiles = (await this.gitManager.pull()) || [];
        this.offlineMode = false;

        if (pulledFiles.length > 0) {
            this.displayMessage(`Pulled ${pulledFiles.length} ${pulledFiles.length > 1 ? 'files' : 'file'} from remote`);
            this.lastPulledFiles = pulledFiles;
            dispatchEvent(new CustomEvent("git-head-update"));
        }
        return pulledFiles.length != 0;
    }

    async stageFile(file: TFile): Promise<boolean> {
        if (!await this.isAllInitialized()) return false;

        await this.gitManager.stage(file.path, true);
        this.displayMessage(`Staged ${file.path}`);

        dispatchEvent(new CustomEvent('git-refresh'));

        this.setState(PluginState.idle);
        return true;
    }

    async unstageFile(file: TFile): Promise<boolean> {
        if (!await this.isAllInitialized()) return false;

        await this.gitManager.unstage(file.path, true);
        this.displayMessage(`Unstaged ${file.path}`);

        dispatchEvent(new CustomEvent('git-refresh'));

        this.setState(PluginState.idle);
        return true;
    }

    async switchBranch(): Promise<string | undefined> {
        if (!await this.isAllInitialized()) return;

        const branchInfo = await this.gitManager.branchInfo();
        const selectedBranch = await new BranchModal(branchInfo.branches).open();

        if (selectedBranch != undefined) {
            await this.gitManager.checkout(selectedBranch);
            this.displayMessage(`Switched to ${selectedBranch}`);
            this.branchBar?.display();
            return selectedBranch;
        }
    }

    async createBranch(): Promise<string | undefined> {
        if (!await this.isAllInitialized()) return;

        const newBranch = await new GeneralModal(app, [], "Create new branch", false).open();
        if (newBranch != undefined) {
            await this.gitManager.createBranch(newBranch);
            this.displayMessage(`Created new branch ${newBranch}`);
            this.branchBar?.display();
            return newBranch;
        }
    }

    async deleteBranch(): Promise<string | undefined> {
        if (!await this.isAllInitialized()) return;

        const branchInfo = await this.gitManager.branchInfo();
        if (branchInfo.current)
            branchInfo.branches.remove(branchInfo.current);
        const branch = await new GeneralModal(app, branchInfo.branches, "Delete branch", false, true).open();
        if (branch != undefined) {
            let force = false;
            if (!await this.gitManager.branchIsMerged(branch)) {
                const forceAnswer = await new GeneralModal(app, ["YES", "NO"], "This branch isn't merged into HEAD. Force delete?", false, true).open();
                if (forceAnswer !== "YES") {
                    return;
                }
                force = forceAnswer === "YES";
            }
            await this.gitManager.deleteBranch(branch, force);
            this.displayMessage(`Deleted branch ${branch}`);
            this.branchBar?.display();
            return branch;
        }
    }

    async remotesAreSet(): Promise<boolean> {
        if (!(await this.gitManager.branchInfo()).tracking) {
            new Notice("No upstream branch is set. Please select one.");
            const remoteBranch = await this.selectRemoteBranch();

            if (remoteBranch == undefined) {
                this.displayError("Aborted. No upstream-branch is set!", 10000);
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

    // This is used for both auto backup and commit
    doAutoBackup(): void {
        this.promiseQueue.addTask(() => {
            if (this.settings.differentIntervalCommitAndPush) {
                return this.commit(true);
            } else {
                return this.createBackup(true);
            }
        });
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

    startAutoPush(minutes?: number) {
        this.timeoutIDPush = window.setTimeout(
            () => {
                this.promiseQueue.addTask(() => this.push());
                this.saveLastAuto(new Date(), "push");
                this.saveSettings();
                this.startAutoPush();
            },
            (minutes ?? this.settings.autoPushInterval) * 60000
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

    clearAutoPush(): boolean {
        if (this.timeoutIDPush) {
            window.clearTimeout(this.timeoutIDPush);
            this.timeoutIDPush = undefined;
            return true;
        }
        return false;
    }

    async handleConflict(conflicted?: string[]): Promise<void> {
        this.setState(PluginState.conflicted);

        this.localStorage.setConflict("true");
        let lines: string[] | undefined;
        if (conflicted !== undefined) {
            lines = [
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
        }
        this.writeAndOpenFile(lines?.join("\n"));
    }

    async editRemotes(): Promise<string | undefined> {
        if (!await this.isAllInitialized()) return;

        const remotes = await this.gitManager.getRemotes();

        const nameModal = new GeneralModal(this.app, remotes, "Select or create a new remote by typing its name and selecting it");
        const remoteName = await nameModal.open();

        if (remoteName) {
            const urlModal = new GeneralModal(this.app, [], "Enter the remote URL");
            const remoteURL = await urlModal.open();
            if (remoteURL) {
                await this.gitManager.setRemote(remoteName, remoteURL);
                return remoteName;
            }
        }
    }

    async selectRemoteBranch(): Promise<string | undefined> {
        let remotes = await this.gitManager.getRemotes();
        let selectedRemote: string | undefined;
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

    async writeAndOpenFile(text?: string) {
        if (text !== undefined) {
            await this.app.vault.adapter.write(this.conflictOutputFile, text);
        }
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
    displayError(message: any, timeout: number = 10 * 1000): void {
        if (message instanceof Errors.UserCanceledError) {
            new Notice("Aborted");
            return;
        }
        // Some errors might not be of type string
        message = message.toString();
        new Notice(message, timeout);
        console.log(`git obsidian error: ${message}`);
        this.statusBar?.displayMessage(message.toLowerCase(), timeout);
    }
}
