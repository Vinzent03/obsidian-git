import { Errors } from "isomorphic-git";
import type {
    Debouncer,
    EventRef,
    Menu,
    TAbstractFile,
    WorkspaceLeaf,
} from "obsidian";
import {
    debounce,
    MarkdownView,
    normalizePath,
    Notice,
    Platform,
    Plugin,
    TFile,
} from "obsidian";
import { LineAuthoringFeature } from "src/lineAuthor/lineAuthorIntegration";
import { pluginRef } from "src/pluginGlobalRef";
import { PromiseQueue } from "src/promiseQueue";
import { ObsidianGitSettingsTab } from "src/setting/settings";
import { StatusBar } from "src/statusBar";
import { CustomMessageModal } from "src/ui/modals/customMessageModal";
import AutomaticsManager from "./automaticsManager";
import { addCommmands } from "./commands";
import {
    CONFLICT_OUTPUT_FILE,
    DEFAULT_SETTINGS,
    DIFF_VIEW_CONFIG,
    HISTORY_VIEW_CONFIG,
    SOURCE_CONTROL_VIEW_CONFIG,
} from "./constants";
import type { GitManager } from "./gitManager/gitManager";
import { IsomorphicGit } from "./gitManager/isomorphicGit";
import { SimpleGit } from "./gitManager/simpleGit";
import { LocalStorageSettings } from "./setting/localStorageSettings";
import type {
    DiffViewState,
    FileStatusResult,
    ObsidianGitSettings,
    Status,
    UnstagedFile,
} from "./types";
import { mergeSettingsByPriority, PluginState } from "./types";
import DiffView from "./ui/diff/diffView";
import HistoryView from "./ui/history/historyView";
import { BranchModal } from "./ui/modals/branchModal";
import { GeneralModal } from "./ui/modals/generalModal";
import GitView from "./ui/sourceControl/sourceControl";
import { BranchStatusBar } from "./ui/statusBar/branchStatusBar";
import { splitRemoteBranch } from "./utils";
import Tools from "./tools";

export default class ObsidianGit extends Plugin {
    gitManager: GitManager;
    automaticsManager: AutomaticsManager;
    tools = new Tools(this);
    localStorage: LocalStorageSettings;
    settings: ObsidianGitSettings;
    settingsTab?: ObsidianGitSettingsTab;
    statusBar?: StatusBar;
    branchBar?: BranchStatusBar;
    state: PluginState;
    lastPulledFiles: FileStatusResult[];
    gitReady = false;
    promiseQueue: PromiseQueue = new PromiseQueue();
    autoCommitDebouncer: Debouncer<any, void> | undefined;
    offlineMode = false;
    loading = false;
    cachedStatus: Status | undefined;
    // Used to store the path of the file that is currently shown in the diff view.
    lastDiffViewState: Record<string, unknown> | undefined;
    openEvent: EventRef;
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
        if (!this.gitReady) return;

        const gitView = this.app.workspace.getLeavesOfType(
            SOURCE_CONTROL_VIEW_CONFIG.type
        );
        const historyView = this.app.workspace.getLeavesOfType(
            HISTORY_VIEW_CONFIG.type
        );

        if (
            this.settings.changedFilesInStatusBar ||
            gitView.length > 0 ||
            historyView.length > 0
        ) {
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
        console.log(
            "loading " +
                this.manifest.name +
                " plugin: v" +
                this.manifest.version
        );

        pluginRef.plugin = this;

        this.localStorage = new LocalStorageSettings(this);

        this.localStorage.migrate();
        await this.loadSettings();
        this.migrateSettings();

        this.settingsTab = new ObsidianGitSettingsTab(this.app, this);
        this.addSettingTab(this.settingsTab);

        if (!this.localStorage.getPluginDisabled()) {
            this.loadPlugin();
        }
    }

    async loadPlugin() {
        addEventListener("git-refresh", this.refresh.bind(this));
        addEventListener("git-head-update", this.refreshUpdatedHead.bind(this));

        this.registerView(SOURCE_CONTROL_VIEW_CONFIG.type, (leaf) => {
            return new GitView(leaf, this);
        });
        this.registerView(HISTORY_VIEW_CONFIG.type, (leaf) => {
            return new HistoryView(leaf, this);
        });

        this.registerView(DIFF_VIEW_CONFIG.type, (leaf) => {
            return new DiffView(leaf, this);
        });

        this.addRibbonIcon(
            "git-pull-request",
            "Open Git source control",
            async () => {
                const leafs = this.app.workspace.getLeavesOfType(
                    SOURCE_CONTROL_VIEW_CONFIG.type
                );
                let leaf: WorkspaceLeaf;
                if (leafs.length === 0) {
                    leaf =
                        this.app.workspace.getRightLeaf(false) ??
                        this.app.workspace.getLeaf();
                    await leaf.setViewState({
                        type: SOURCE_CONTROL_VIEW_CONFIG.type,
                    });
                } else {
                    leaf = leafs.first()!;
                }
                this.app.workspace.revealLeaf(leaf);

                dispatchEvent(new CustomEvent("git-refresh"));
            }
        );

        this.lineAuthoringFeature.onLoadPlugin();

        this.registerHoverLinkSource(SOURCE_CONTROL_VIEW_CONFIG.type, {
            display: "Git View",
            defaultMod: true,
        });

        this.setRefreshDebouncer();

        addCommmands(this);

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file, source) => {
                this.handleFileMenu(menu, file, source);
            })
        );

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

    async addFileToGitignore(file: TAbstractFile): Promise<void> {
        await this.app.vault.adapter.append(
            this.gitManager.getRelativeVaultPath(".gitignore"),
            "\n" + this.gitManager.getRelativeRepoPath(file!.path, true)
        );
        this.refresh();
    }

    handleFileMenu(menu: Menu, file: TAbstractFile, source: string): void {
        if (!this.gitReady) return;
        if (!this.settings.showFileMenu) return;
        if (!file) return;

        if (
            this.settings.showFileMenu &&
            source == "file-explorer-context-menu"
        ) {
            menu.addItem((item) => {
                item.setTitle(`Git: Stage`)
                    .setIcon("plus-circle")
                    .setSection("action")
                    .onClick((_) => {
                        this.promiseQueue.addTask(async () => {
                            if (file instanceof TFile) {
                                await this.gitManager.stage(file.path, true);
                            } else {
                                await this.gitManager.stageAll({
                                    dir: this.gitManager.getRelativeRepoPath(
                                        file.path,
                                        true
                                    ),
                                });
                            }
                            this.displayMessage(`Staged ${file.path}`);
                        });
                    });
            });
            menu.addItem((item) => {
                item.setTitle(`Git: Unstage`)
                    .setIcon("minus-circle")
                    .setSection("action")
                    .onClick((_) => {
                        this.promiseQueue.addTask(async () => {
                            if (file instanceof TFile) {
                                await this.gitManager.unstage(file.path, true);
                            } else {
                                await this.gitManager.unstageAll({
                                    dir: this.gitManager.getRelativeRepoPath(
                                        file.path,
                                        true
                                    ),
                                });
                            }
                            this.displayMessage(`Unstaged ${file.path}`);
                        });
                    });
            });
            menu.addItem((item) => {
                item.setTitle(`Git: Add to .gitignore`)
                    .setIcon("file-x")
                    .setSection("action")
                    .onClick((_) => {
                        this.addFileToGitignore(file);
                    });
            });
        }

        if (source == "git-source-control") {
            menu.addItem((item) => {
                item.setTitle(`Git: Add to .gitignore`)
                    .setIcon("file-x")
                    .setSection("action")
                    .onClick((_) => {
                        this.addFileToGitignore(file);
                    });
            });
        }
    }

    async migrateSettings(): Promise<void> {
        if (this.settings.mergeOnPull != undefined) {
            this.settings.syncMethod = this.settings.mergeOnPull
                ? "merge"
                : "rebase";
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
        if (this.settings.username != undefined) {
            this.localStorage.setPassword(this.settings.username);
            this.settings.username = undefined;
            await this.saveSettings();
        }
    }

    unloadPlugin() {
        this.gitReady = false;
        dispatchEvent(new CustomEvent("git-refresh"));

        this.lineAuthoringFeature.deactivateFeature();
        this.automaticsManager.unload();
        removeEventListener("git-refresh", this.refresh.bind(this));
        removeEventListener(
            "git-head-update",
            this.refreshUpdatedHead.bind(this)
        );
        this.app.workspace.offref(this.openEvent);
        this.app.metadataCache.offref(this.modifyEvent);
        this.app.metadataCache.offref(this.deleteEvent);
        this.app.metadataCache.offref(this.createEvent);
        this.app.metadataCache.offref(this.renameEvent);
        this.debRefresh.cancel();
    }

    async onunload() {
        (this.app.workspace as any).unregisterHoverLinkSource(
            SOURCE_CONTROL_VIEW_CONFIG.type
        );

        this.unloadPlugin();

        console.log("unloading " + this.manifest.name + " plugin");
    }

    async loadSettings() {
        // At first startup, `data` is `null` because data.json does not exist.
        let data = (await this.loadData()) as ObsidianGitSettings | null;
        //Check for existing settings
        if (data == undefined) {
            data = <ObsidianGitSettings>{ showedMobileNotice: true };
        }
        this.settings = mergeSettingsByPriority(DEFAULT_SETTINGS, data);
    }

    async saveSettings() {
        this.settingsTab?.beforeSaveSettings();
        await this.saveData(this.settings);
    }

    get useSimpleGit(): boolean {
        return Platform.isDesktopApp;
    }

    async init(): Promise<void> {
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
                    this.displayError(
                        `Cannot run git command. Trying to run: '${this.localStorage.getGitPath() || "git"}' .`
                    );
                    break;
                case "missing-repo":
                    new Notice(
                        "Can't find a valid git repository. Please create one via the given command or clone an existing repo.",
                        10000
                    );
                    break;
                case "valid":
                    this.gitReady = true;
                    this.setState(PluginState.idle);

                    this.openEvent = this.app.workspace.on(
                        "active-leaf-change",
                        (leaf) => this.handleViewActiveState(leaf)
                    );

                    this.modifyEvent = this.app.vault.on("modify", () => {
                        this.debRefresh();
                        this.autoCommitDebouncer?.();
                    });
                    this.deleteEvent = this.app.vault.on("delete", () => {
                        this.debRefresh();
                        this.autoCommitDebouncer?.();
                    });
                    this.createEvent = this.app.vault.on("create", () => {
                        this.debRefresh();
                        this.autoCommitDebouncer?.();
                    });
                    this.renameEvent = this.app.vault.on("rename", () => {
                        this.debRefresh();
                        this.autoCommitDebouncer?.();
                    });

                    this.registerEvent(this.modifyEvent);
                    this.registerEvent(this.deleteEvent);
                    this.registerEvent(this.createEvent);
                    this.registerEvent(this.renameEvent);

                    this.branchBar?.display();

                    this.lineAuthoringFeature.conditionallyActivateBySettings();

                    dispatchEvent(new CustomEvent("git-refresh"));

                    if (this.settings.autoPullOnBoot) {
                        this.promiseQueue.addTask(() =>
                            this.pullChangesFromRemote()
                        );
                    }
                    this.automaticsManager = new AutomaticsManager(this);
                    await this.automaticsManager.init();
                    break;
                default:
                    this.log(
                        "Something weird happened. The 'checkRequirements' result is " +
                            result
                    );
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
        const modal = new GeneralModal(this, {
            placeholder: "Enter remote URL",
        });
        const url = await modal.open();
        if (url) {
            const confirmOption = "Vault Root";
            let dir = await new GeneralModal(this, {
                options:
                    this.gitManager instanceof IsomorphicGit
                        ? [confirmOption]
                        : [],
                placeholder:
                    "Enter directory for clone. It needs to be empty or not existent.",
                allowEmpty: this.gitManager instanceof IsomorphicGit,
            }).open();
            if (dir !== undefined) {
                if (dir === confirmOption) {
                    dir = ".";
                }

                dir = normalizePath(dir);
                if (dir === "/") {
                    dir = ".";
                }

                if (dir === ".") {
                    const modal = new GeneralModal(this, {
                        options: ["NO", "YES"],
                        placeholder: `Does your remote repo contain a ${this.app.vault.configDir} directory at the root?`,
                        onlySelection: true,
                    });
                    const containsConflictDir = await modal.open();
                    if (containsConflictDir === undefined) {
                        new Notice("Aborted clone");
                        return;
                    } else if (containsConflictDir === "YES") {
                        const confirmOption =
                            "DELETE ALL YOUR LOCAL CONFIG AND PLUGINS";
                        const modal = new GeneralModal(this, {
                            options: ["Abort clone", confirmOption],
                            placeholder: `To avoid conflicts, the local ${this.app.vault.configDir} directory needs to be deleted.`,
                            onlySelection: true,
                        });
                        const shouldDelete =
                            (await modal.open()) === confirmOption;
                        if (shouldDelete) {
                            await this.app.vault.adapter.rmdir(
                                this.app.vault.configDir,
                                true
                            );
                        } else {
                            new Notice("Aborted clone");
                            return;
                        }
                    }
                }
                const depth = await new GeneralModal(this, {
                    placeholder:
                        "Specify depth of clone. Leave empty for full clone.",
                    allowEmpty: true,
                }).open();
                let depthInt = undefined;
                if (depth !== "") {
                    depthInt = parseInt(depth);
                    if (isNaN(depthInt)) {
                        new Notice("Invalid depth. Aborting clone.");
                        return;
                    }
                }
                new Notice(`Cloning new repo into "${dir}"`);
                const oldBase = this.settings.basePath;
                const customDir = dir && dir !== ".";
                //Set new base path before clone to ensure proper .git/index file location in isomorphic-git
                if (customDir) {
                    this.settings.basePath = dir;
                }
                try {
                    await this.gitManager.clone(url, dir, depthInt);
                } catch (error) {
                    this.settings.basePath = oldBase;
                    this.saveSettings();
                    throw error;
                }
                new Notice("Cloned new repo.");
                new Notice("Please restart Obsidian");

                if (customDir) {
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
        if (!(await this.isAllInitialized())) return;

        const filesUpdated = await this.pull();
        this.automaticsManager.setUpAutoCommitAndSync();
        if (filesUpdated === false) {
            return;
        }
        if (!filesUpdated) {
            this.displayMessage("Everything is up-to-date");
        }

        if (this.gitManager instanceof SimpleGit) {
            const status = await this.gitManager.status();
            if (status.conflicted.length > 0) {
                this.displayError(
                    `You have conflicts in ${status.conflicted.length} ${
                        status.conflicted.length == 1 ? "file" : "files"
                    }`
                );
                this.handleConflict(status.conflicted);
            }
        }

        dispatchEvent(new CustomEvent("git-refresh"));
        this.setState(PluginState.idle);
    }

    async commitAndSync(
        fromAutoBackup: boolean,
        requestCustomMessage = false,
        commitMessage?: string
    ): Promise<void> {
        if (!(await this.isAllInitialized())) return;

        if (
            this.settings.syncMethod == "reset" &&
            this.settings.pullBeforePush
        ) {
            await this.pull();
        }

        if (
            !(await this.commit({
                fromAuto: fromAutoBackup,
                requestCustomMessage,
                commitMessage,
            }))
        ) {
            return;
        }

        if (!this.settings.disablePush) {
            // Prevent plugin to pull/push at every call of createBackup. Only if unpushed commits are present
            if (
                (await this.remotesAreSet()) &&
                (await this.gitManager.canPush())
            ) {
                if (
                    this.settings.syncMethod != "reset" &&
                    this.settings.pullBeforePush
                ) {
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
    async commit({
        fromAuto,
        requestCustomMessage = false,
        onlyStaged = false,
        commitMessage,
        amend = false,
    }: {
        fromAuto: boolean;
        requestCustomMessage?: boolean;
        onlyStaged?: boolean;
        commitMessage?: string;
        amend?: boolean;
    }): Promise<boolean> {
        if (!(await this.isAllInitialized())) return false;

        let hadConflict = this.localStorage.getConflict();

        let changedFiles: { vault_path: string }[];
        let status: Status | undefined;
        let unstagedFiles: UnstagedFile[] | undefined;

        if (this.gitManager instanceof SimpleGit) {
            this.mayDeleteConflictFile();
            status = await this.updateCachedStatus();

            //Should not be necessary, but just in case
            if (status.conflicted.length == 0) {
                this.localStorage.setConflict(false);
                hadConflict = false;
            }

            // check for conflict files on auto backup
            if (fromAuto && status.conflicted.length > 0) {
                this.displayError(
                    `Did not commit, because you have conflicts in ${
                        status.conflicted.length
                    } ${
                        status.conflicted.length == 1 ? "file" : "files"
                    }. Please resolve them and commit per command.`
                );
                this.handleConflict(status.conflicted);
                return false;
            }
            changedFiles = [...status.changed, ...status.staged];
        } else if (fromAuto && hadConflict) {
            this.setState(PluginState.conflicted);
            this.displayError(
                `Did not commit, because you have conflicts. Please resolve them and commit per command.`
            );
            return false;
        } else if (hadConflict) {
            await this.mayDeleteConflictFile();
            status = await this.updateCachedStatus();
            changedFiles = [...status.changed, ...status.staged];
        } else {
            if (onlyStaged) {
                changedFiles = await (
                    this.gitManager as IsomorphicGit
                ).getStagedFiles();
            } else {
                unstagedFiles = await (
                    this.gitManager as IsomorphicGit
                ).getUnstagedFiles();
                changedFiles = unstagedFiles.map(({ filepath }) => ({
                    vault_path: this.gitManager.getRelativeVaultPath(filepath),
                }));
            }
        }

        if (await this.tools.hasTooBigFiles(changedFiles)) {
            this.setState(PluginState.idle);
            return false;
        }

        if (changedFiles.length !== 0 || hadConflict) {
            let cmtMessage = (commitMessage ??= fromAuto
                ? this.settings.autoCommitMessage
                : this.settings.commitMessage);
            if (
                (fromAuto && this.settings.customMessageOnAutoBackup) ||
                requestCustomMessage
            ) {
                if (!this.settings.disablePopups && fromAuto) {
                    new Notice(
                        "Auto backup: Please enter a custom commit message. Leave empty to abort"
                    );
                }
                const tempMessage = await new CustomMessageModal(
                    this,
                    true
                ).open();

                if (
                    tempMessage != undefined &&
                    tempMessage != "" &&
                    tempMessage != "..."
                ) {
                    cmtMessage = tempMessage;
                } else {
                    this.setState(PluginState.idle);
                    return false;
                }
            }
            let committedFiles: number | undefined;
            if (onlyStaged) {
                committedFiles = await this.gitManager.commit({
                    message: cmtMessage,
                    amend,
                });
            } else {
                committedFiles = await this.gitManager.commitAll({
                    message: cmtMessage,
                    status,
                    unstagedFiles,
                    amend,
                });
            }

            //Handle resolved conflict after commit
            if (this.gitManager instanceof SimpleGit) {
                if ((await this.updateCachedStatus()).conflicted.length == 0) {
                    this.localStorage.setConflict(false);
                }
            }

            let roughly = false;
            if (committedFiles === undefined) {
                roughly = true;
                committedFiles = changedFiles.length;
            }
            this.automaticsManager.setUpAutoCommitAndSync();
            this.displayMessage(
                `Committed${roughly ? " approx." : ""} ${committedFiles} ${
                    committedFiles == 1 ? "file" : "files"
                }`
            );
        } else {
            this.displayMessage("No changes to commit");
        }
        dispatchEvent(new CustomEvent("git-refresh"));

        this.setState(PluginState.idle);
        return true;
    }

    async push(): Promise<boolean> {
        if (!(await this.isAllInitialized())) return false;
        if (!(await this.remotesAreSet())) {
            return false;
        }
        const hadConflict = this.localStorage.getConflict();
        if (this.gitManager instanceof SimpleGit)
            await this.mayDeleteConflictFile();

        // Refresh because of pull
        let status: any;
        if (
            this.gitManager instanceof SimpleGit &&
            (status = await this.updateCachedStatus()).conflicted.length > 0
        ) {
            this.displayError(
                `Cannot push. You have conflicts in ${
                    status.conflicted.length
                } ${status.conflicted.length == 1 ? "file" : "files"}`
            );
            this.handleConflict(status.conflicted);
            return false;
        } else if (this.gitManager instanceof IsomorphicGit && hadConflict) {
            this.displayError(`Cannot push. You have conflicts`);
            this.setState(PluginState.conflicted);
            return false;
        }
        this.log("Pushing....");
        const pushedFiles = await this.gitManager.push();

        if (pushedFiles !== undefined) {
            this.log("Pushed!", pushedFiles);
            if (pushedFiles > 0) {
                this.displayMessage(
                    `Pushed ${pushedFiles} ${
                        pushedFiles == 1 ? "file" : "files"
                    } to remote`
                );
            } else {
                this.displayMessage(`No changes to push`);
            }
        }
        this.offlineMode = false;
        this.setState(PluginState.idle);
        dispatchEvent(new CustomEvent("git-refresh"));

        return true;
    }

    /** Used for internals
    Returns whether the pull added a commit or not.

    See {@link pullChangesFromRemote} for the command version. */
    async pull(): Promise<false | number> {
        if (!(await this.remotesAreSet())) {
            return false;
        }
        const pulledFiles = (await this.gitManager.pull()) || [];
        this.offlineMode = false;

        if (pulledFiles.length > 0) {
            this.displayMessage(
                `Pulled ${pulledFiles.length} ${
                    pulledFiles.length == 1 ? "file" : "files"
                } from remote`
            );
            this.lastPulledFiles = pulledFiles;
        }
        return pulledFiles.length;
    }

    async fetch(): Promise<void> {
        if (!(await this.remotesAreSet())) {
            return;
        }
        await this.gitManager.fetch();

        this.displayMessage(`Fetched from remote`);
        this.offlineMode = false;
        dispatchEvent(new CustomEvent("git-refresh"));
    }

    async mayDeleteConflictFile(): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(CONFLICT_OUTPUT_FILE);
        if (file) {
            this.app.workspace.iterateAllLeaves((leaf) => {
                if (
                    leaf.view instanceof MarkdownView &&
                    leaf.view.file?.path == file.path
                ) {
                    leaf.detach();
                }
            });
            await this.app.vault.delete(file);
        }
    }

    async stageFile(file: TFile): Promise<boolean> {
        if (!(await this.isAllInitialized())) return false;

        await this.gitManager.stage(file.path, true);
        this.displayMessage(`Staged ${file.path}`);

        dispatchEvent(new CustomEvent("git-refresh"));

        this.setState(PluginState.idle);
        return true;
    }

    async unstageFile(file: TFile): Promise<boolean> {
        if (!(await this.isAllInitialized())) return false;

        await this.gitManager.unstage(file.path, true);
        this.displayMessage(`Unstaged ${file.path}`);

        dispatchEvent(new CustomEvent("git-refresh"));

        this.setState(PluginState.idle);
        return true;
    }

    async switchBranch(): Promise<string | undefined> {
        if (!(await this.isAllInitialized())) return;

        const branchInfo = await this.gitManager.branchInfo();
        const selectedBranch = await new BranchModal(
            this,
            branchInfo.branches
        ).open();

        if (selectedBranch != undefined) {
            await this.gitManager.checkout(selectedBranch);
            this.displayMessage(`Switched to ${selectedBranch}`);
            this.branchBar?.display();
            return selectedBranch;
        }
    }

    async switchRemoteBranch(): Promise<string | undefined> {
        if (!(await this.isAllInitialized())) return;

        const selectedBranch = (await this.selectRemoteBranch()) || "";

        const [remote, branch] = splitRemoteBranch(selectedBranch);

        if (branch != undefined && remote != undefined) {
            await this.gitManager.checkout(branch, remote);
            this.displayMessage(`Switched to ${selectedBranch}`);
            this.branchBar?.display();
            return selectedBranch;
        }
    }

    async createBranch(): Promise<string | undefined> {
        if (!(await this.isAllInitialized())) return;

        const newBranch = await new GeneralModal(this, {
            placeholder: "Create new branch",
        }).open();
        if (newBranch != undefined) {
            await this.gitManager.createBranch(newBranch);
            this.displayMessage(`Created new branch ${newBranch}`);
            this.branchBar?.display();
            return newBranch;
        }
    }

    async deleteBranch(): Promise<string | undefined> {
        if (!(await this.isAllInitialized())) return;

        const branchInfo = await this.gitManager.branchInfo();
        if (branchInfo.current) branchInfo.branches.remove(branchInfo.current);
        const branch = await new GeneralModal(this, {
            options: branchInfo.branches,
            placeholder: "Delete branch",
            onlySelection: true,
        }).open();
        if (branch != undefined) {
            let force = false;
            const merged = await this.gitManager.branchIsMerged(branch);
            // Using await inside IF throws exception
            if (!merged) {
                const forceAnswer = await new GeneralModal(this, {
                    options: ["YES", "NO"],
                    placeholder:
                        "This branch isn't merged into HEAD. Force delete?",
                    onlySelection: true,
                }).open();
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

    // Ensures that the upstream branch is set.
    // If not, it will prompt the user to set it.
    //
    // An exception is when the user has submodules enabled.
    // In this case, the upstream branch is not required,
    // to allow pulling/pushing only the submodules and not the outer repo.
    async remotesAreSet(): Promise<boolean> {
        if (this.settings.updateSubmodules) {
            return true;
        }
        if (!(await this.gitManager.branchInfo()).tracking) {
            new Notice("No upstream branch is set. Please select one.");
            return await this.setUpstreamBranch();
        }
        return true;
    }

    async setUpstreamBranch(): Promise<boolean> {
        const remoteBranch = await this.selectRemoteBranch();

        if (remoteBranch == undefined) {
            this.displayError("Aborted. No upstream-branch is set!", 10000);
            this.setState(PluginState.idle);
            return false;
        } else {
            await this.gitManager.updateUpstreamBranch(remoteBranch);
            this.displayMessage(`Set upstream branch to ${remoteBranch}`);
            this.setState(PluginState.idle);
            return true;
        }
    }

    async discardAll() {
        await this.gitManager.discardAll({
            status: this.cachedStatus,
        });
        new Notice(
            "All local changes have been discarded. New files remain untouched."
        );
    }

    async handleConflict(conflicted?: string[]): Promise<void> {
        this.setState(PluginState.conflicted);

        this.localStorage.setConflict(true);
        let lines: string[] | undefined;
        if (conflicted !== undefined) {
            lines = [
                "# Conflicts",
                "Please resolve them and commit them using the commands `Git: Commit all changes` followed by `Git: Push`",
                "(This file will automatically be deleted before commit)",
                "[[#Additional Instructions]] available below file list",
                "",
                ...conflicted.map((e) => {
                    const file = this.app.vault.getAbstractFileByPath(e);
                    if (file instanceof TFile) {
                        const link = this.app.metadataCache.fileToLinktext(
                            file,
                            "/"
                        );
                        return `- [[${link}]]`;
                    } else {
                        return `- Not a file: ${e}`;
                    }
                }),
                `
# Additional Instructions
I strongly recommend to use "Source mode" for viewing the conflicted files. For simple conflicts, in each file listed above replace every occurrence of the following text blocks with the desired text.

\`\`\`diff
<<<<<<< HEAD
    File changes in local repository
=======
    File changes in remote repository
>>>>>>> origin/main
\`\`\``,
            ];
        }
        this.tools.writeAndOpenFile(lines?.join("\n"));
    }

    async editRemotes(): Promise<string | undefined> {
        if (!(await this.isAllInitialized())) return;

        const remotes = await this.gitManager.getRemotes();

        const nameModal = new GeneralModal(this, {
            options: remotes,
            placeholder:
                "Select or create a new remote by typing its name and selecting it",
        });
        const remoteName = await nameModal.open();

        if (remoteName) {
            const oldUrl = await this.gitManager.getRemoteUrl(remoteName);

            const urlModal = new GeneralModal(this, { initialValue: oldUrl });
            // urlModal.inputEl.setText(oldUrl ?? "");
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

        const nameModal = new GeneralModal(this, {
            options: remotes,
            placeholder:
                "Select or create a new remote by typing its name and selecting it",
        });
        const remoteName = selectedRemote ?? (await nameModal.open());

        if (remoteName) {
            this.displayMessage("Fetching remote branches");
            await this.gitManager.fetch(remoteName);
            const branches =
                await this.gitManager.getRemoteBranches(remoteName);
            const branchModal = new GeneralModal(this, {
                options: branches,
                placeholder:
                    "Select or create a new remote branch by typing its name and selecting it",
            });
            return await branchModal.open();
        }
    }

    async removeRemote() {
        if (!(await this.isAllInitialized())) return;

        const remotes = await this.gitManager.getRemotes();

        const nameModal = new GeneralModal(this, {
            options: remotes,
            placeholder: "Select a remote",
        });
        const remoteName = await nameModal.open();

        if (remoteName) {
            this.gitManager.removeRemote(remoteName);
        }
    }

    handleViewActiveState(leaf: WorkspaceLeaf | null): void {
        // Prevent removing focus when switching to other panes than file panes like search or GitView
        if (!leaf?.view.getState().file) return;

        const sourceControlLeaf = this.app.workspace
            .getLeavesOfType(SOURCE_CONTROL_VIEW_CONFIG.type)
            .first();
        const historyLeaf = this.app.workspace
            .getLeavesOfType(HISTORY_VIEW_CONFIG.type)
            .first();

        // Clear existing active state
        sourceControlLeaf?.view.containerEl
            .querySelector(`div.nav-file-title.is-active`)
            ?.removeClass("is-active");
        historyLeaf?.view.containerEl
            .querySelector(`div.nav-file-title.is-active`)
            ?.removeClass("is-active");

        if (leaf?.view instanceof DiffView) {
            const path = leaf.view.state.file;
            this.lastDiffViewState = leaf.view.getState();
            let el: Element | undefined | null;
            if (sourceControlLeaf && leaf.view.state.staged) {
                el = sourceControlLeaf.view.containerEl.querySelector(
                    `div.staged div.nav-file-title[data-path='${path}']`
                );
            } else if (
                sourceControlLeaf &&
                leaf.view.state.staged === false &&
                !leaf.view.state.hash
            ) {
                el = sourceControlLeaf.view.containerEl.querySelector(
                    `div.changes div.nav-file-title[data-path='${path}']`
                );
            } else if (historyLeaf && leaf.view.state.hash) {
                el = historyLeaf.view.containerEl.querySelector(
                    `div.nav-file-title[data-path='${path}']`
                );
            }
            el?.addClass("is-active");
        } else {
            this.lastDiffViewState = undefined;
        }
    }

    // region: displaying / formatting messages
    displayMessage(message: string, timeout: number = 4 * 1000): void {
        this.statusBar?.displayMessage(message.toLowerCase(), timeout);

        if (!this.settings.disablePopups) {
            if (
                !this.settings.disablePopupsForNoChanges ||
                !message.startsWith("No changes")
            ) {
                new Notice(message, 5 * 1000);
            }
        }

        this.log(message);
    }

    displayError(message: any, timeout: number = 10 * 1000): void {
        if (message instanceof Errors.UserCanceledError) {
            new Notice("Aborted");
            return;
        }
        // Some errors might not be of type string
        message = message.toString();
        new Notice(message, timeout);
        this.log(`error: ${message}`);
        this.statusBar?.displayMessage(message.toLowerCase(), timeout);
    }

    log(...data: any[]) {
        console.log(`${this.manifest.id}:`, ...data);
    }
}
