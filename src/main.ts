import { Errors } from "isomorphic-git";
import type { Debouncer, Menu, TAbstractFile, WorkspaceLeaf } from "obsidian";
import {
    debounce,
    FileSystemAdapter,
    normalizePath,
    Notice,
    Platform,
    Plugin,
    TFile,
    TFolder,
    moment,
} from "obsidian";
import * as path from "path";
import * as fsPromises from "fs/promises";
import { pluginRef } from "src/pluginGlobalRef";
import { PromiseQueue } from "src/promiseQueue";
import { ObsidianGitSettingsTab } from "src/setting/settings";
import { StatusBar } from "src/statusBar";
import { CustomMessageModal } from "src/ui/modals/customMessageModal";
import AutomaticsManager from "./automaticsManager";
import { addCommmands } from "./commands";
import {
    DEFAULT_SETTINGS,
    DIFF_VIEW_CONFIG,
    HISTORY_VIEW_CONFIG,
    READ_ONLY_FILE_VIEW_CONFIG,
    SOURCE_CONTROL_VIEW_CONFIG,
    SPLIT_DIFF_VIEW_CONFIG,
} from "./constants";
import type { GitManager } from "./gitManager/gitManager";
import { IsomorphicGit } from "./gitManager/isomorphicGit";
import { SimpleGit } from "./gitManager/simpleGit";
import { LocalStorageSettings } from "./setting/localStorageSettings";
import Tools from "./tools";
import type {
    CommitAndSyncResult,
    CommitMode,
    CommitResult,
    CloneRepositoryResult,
    CreateBranchResult,
    DeleteBranchResult,
    DeleteRepositoryResult,
    DiscardActionResult,
    EditRemoteResult,
    ElectronWindow,
    FetchResult,
    FileStatusResult,
    InitRepositoryResult,
    ListChangedFilesResult,
    NotReadyResult,
    ObsidianGitSettings,
    PluginState,
    PullResult,
    PushResult,
    RawCommandResult,
    RemoveRemoteResult,
    SetUpstreamResult,
    Status,
    SwitchBranchResult,
    UnstagedFile,
    FileStateMutationResult,
} from "./types";
import {
    GitConflictError,
    GitOperation,
    mergeSettingsByPriority,
    NoNetworkError,
} from "./types";
import DiffView from "./ui/diff/diffView";
import SplitDiffView from "./ui/diff/splitDiffView";
import HistoryView from "./ui/history/historyView";
import ReadOnlyFileView from "./ui/readOnlyFileView";
import { BranchModal } from "./ui/modals/branchModal";
import { ChangedFilesModal } from "./ui/modals/changedFilesModal";
import { GeneralModal } from "./ui/modals/generalModal";
import { MergeConflictModal } from "./ui/modals/mergeConflictModal";
import GitView from "./ui/sourceControl/sourceControl";
import { BranchStatusBar } from "./ui/statusBar/branchStatusBar";
import {
    assertNever,
    convertPathToAbsoluteGitignoreRule,
    formatRemoteUrl,
    spawnAsync,
    splitRemoteBranch,
} from "./utils";
import { DiscardModal } from "./ui/modals/discardModal";
import { HunkActions } from "./editor/signs/hunkActions";
import { EditorIntegration } from "./editor/editorIntegration";
import { runGitAction, type GitActionResult } from "./gitAction";

type CommitOptions = {
    fromAuto: boolean;
    requestCustomMessage?: boolean;
    mode?: CommitMode;
    commitMessage?: string;
    amend?: boolean;
};

type CommitAndSyncOptions = {
    fromAutoBackup: boolean;
    requestCustomMessage?: boolean;
    commitMessage?: string;
    mode?: CommitMode;
};

export default class ObsidianGit extends Plugin {
    gitManager!: GitManager;
    automaticsManager = new AutomaticsManager(this);
    tools = new Tools(this);
    localStorage = new LocalStorageSettings(this);
    settings!: ObsidianGitSettings;
    settingsTab?: ObsidianGitSettingsTab;
    statusBar?: StatusBar;
    branchBar?: BranchStatusBar;
    state: PluginState = {
        operation: GitOperation.idle,
        offlineMode: false,
        mergeInProgress: false,
    };
    lastPulledFiles!: FileStatusResult[];
    gitReady = false;
    promiseQueue: PromiseQueue = new PromiseQueue();

    /**
     * Debouncer for the auto commit after file changes.
     */
    autoCommitDebouncer: Debouncer<[], void> | undefined;
    cachedStatus: Status | undefined;
    // Used to store the path of the file that is currently shown in the diff view.
    lastDiffViewState: Record<string, unknown> | undefined;
    intervalsToClear: number[] = [];
    editorIntegration: EditorIntegration = new EditorIntegration(this);
    hunkActions = new HunkActions(this);

    /**
     * Debouncer for the refresh of the git status for the source control view after file changes.
     */
    debRefresh!: Debouncer<[], void>;

    setPluginState(state: Partial<PluginState>): void {
        this.state = Object.assign(this.state, state);
        this.statusBar?.display();
    }

    async updateCachedStatus(): Promise<Status> {
        this.app.workspace.trigger("obsidian-git:loading-status");
        this.cachedStatus = await this.gitManager.status();
        const newMergeInProgress = await this.gitManager.isMergeInProgress();
        this.setPluginState({
            mergeInProgress: newMergeInProgress,
        });
        await this.branchBar?.display();

        this.app.workspace.trigger(
            "obsidian-git:status-changed",
            this.cachedStatus
        );
        return this.cachedStatus;
    }

    async refresh() {
        if (!this.gitReady) return;

        const gitViews = this.app.workspace.getLeavesOfType(
            SOURCE_CONTROL_VIEW_CONFIG.type
        );
        const historyViews = this.app.workspace.getLeavesOfType(
            HISTORY_VIEW_CONFIG.type
        );

        if (
            this.settings.changedFilesInStatusBar ||
            gitViews.some((leaf) => !(leaf.isDeferred ?? false)) ||
            historyViews.some((leaf) => !(leaf.isDeferred ?? false))
        ) {
            await this.updateCachedStatus().catch((e) => this.displayError(e));
        }

        this.app.workspace.trigger("obsidian-git:refreshed");

        // We don't put a line authoring refresh here, as it would force a re-loading
        // of the line authoring feature - which would lead to a jumpy editor-view in the
        // ui after every rename event.
    }

    refreshUpdatedHead() {}

    async onload() {
        console.log(
            "loading " +
                this.manifest.name +
                " plugin: v" +
                this.manifest.version
        );

        pluginRef.plugin = this;

        this.localStorage.migrate();
        await this.loadSettings();
        await this.migrateSettings();

        this.settingsTab = new ObsidianGitSettingsTab(this.app, this);
        this.addSettingTab(this.settingsTab);

        if (!this.localStorage.getPluginDisabled()) {
            this.registerStuff();

            this.app.workspace.onLayoutReady(() =>
                this.init({ fromReload: false }).catch((e) =>
                    this.displayError(e)
                )
            );
        }
    }

    onExternalSettingsChange() {
        this.reloadSettings().catch((e) => this.displayError(e));
    }

    /** Reloads the settings from disk and applies them by unloading the plugin
     * and initializing it again.
     */
    async reloadSettings(): Promise<void> {
        const previousSettings = JSON.stringify(this.settings);

        await this.loadSettings();

        const newSettings = JSON.stringify(this.settings);

        // Only reload plugin if the settings have actually changed
        if (previousSettings !== newSettings) {
            this.log("Reloading settings");

            this.unloadPlugin();

            await this.init({ fromReload: true });

            for (const leaf of this.app.workspace.getLeavesOfType(
                SOURCE_CONTROL_VIEW_CONFIG.type
            )) {
                if (!(leaf.isDeferred ?? false)) {
                    await (leaf.view as GitView).reload();
                }
            }

            for (const leaf of this.app.workspace.getLeavesOfType(
                HISTORY_VIEW_CONFIG.type
            )) {
                if (!(leaf.isDeferred ?? false)) {
                    await (leaf.view as HistoryView).reload();
                }
            }
        }
    }

    /** This method only registers events, views, commands and more.
     *
     * This only needs to be called once since the registered events are
     * unregistered when the plugin is unloaded.
     *
     * This mustn't depend on the plugin's settings.
     */
    registerStuff(): void {
        this.registerEvent(
            this.app.workspace.on("obsidian-git:refresh", () => {
                this.refresh().catch((e) => this.displayError(e));
            })
        );
        this.registerEvent(
            this.app.workspace.on("obsidian-git:head-change", () => {
                this.refreshUpdatedHead();
            })
        );

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file, source) => {
                this.handleFileMenu(menu, file, source, "file-manu");
            })
        );

        this.registerEvent(
            this.app.workspace.on("obsidian-git:menu", (menu, path, source) => {
                this.handleFileMenu(menu, path, source, "obsidian-git:menu");
            })
        );

        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                this.onActiveLeafChange(leaf);
            })
        );
        this.registerEvent(
            this.app.vault.on("modify", () => {
                this.debRefresh();
                this.autoCommitDebouncer?.();
            })
        );
        this.registerEvent(
            this.app.vault.on("delete", () => {
                this.debRefresh();
                this.autoCommitDebouncer?.();
            })
        );
        this.registerEvent(
            this.app.vault.on("create", () => {
                this.debRefresh();
                this.autoCommitDebouncer?.();
            })
        );
        this.registerEvent(
            this.app.vault.on("rename", () => {
                this.debRefresh();
                this.autoCommitDebouncer?.();
            })
        );

        this.registerView(SOURCE_CONTROL_VIEW_CONFIG.type, (leaf) => {
            return new GitView(leaf, this);
        });

        this.registerView(HISTORY_VIEW_CONFIG.type, (leaf) => {
            return new HistoryView(leaf, this);
        });

        this.registerView(READ_ONLY_FILE_VIEW_CONFIG.type, (leaf) => {
            return new ReadOnlyFileView(leaf, this);
        });

        this.registerView(DIFF_VIEW_CONFIG.type, (leaf) => {
            return new DiffView(leaf, this);
        });

        this.registerView(SPLIT_DIFF_VIEW_CONFIG.type, (leaf) => {
            return new SplitDiffView(leaf, this);
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
                await this.app.workspace.revealLeaf(leaf);
            }
        );

        this.registerHoverLinkSource(SOURCE_CONTROL_VIEW_CONFIG.type, {
            display: "Git View",
            defaultMod: true,
        });

        this.editorIntegration.onLoadPlugin();

        this.setRefreshDebouncer();

        addCommmands(this);
    }

    setRefreshDebouncer(): void {
        this.debRefresh?.cancel();
        this.debRefresh = debounce(
            () => {
                if (this.settings.refreshSourceControl) {
                    this.refresh().catch(console.error);
                }
            },
            this.settings.refreshSourceControlTimer,
            true
        );
    }

    async addFileToGitignore(
        filePath: string,
        isFolder?: boolean
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(async () => {
            const gitRelativePath = this.gitManager.getRelativeRepoPath(
                filePath,
                true
            );
            // Define an absolute rule that can apply only for this item.
            const gitignoreRule = convertPathToAbsoluteGitignoreRule({
                isFolder,
                gitRelativePath,
            });
            await this.app.vault.adapter.append(
                this.gitManager.getRelativeVaultPath(".gitignore"),
                "\n" + gitignoreRule
            );
        });
    }

    handleFileMenu(
        menu: Menu,
        file: TAbstractFile | string,
        source: string,
        type: "file-manu" | "obsidian-git:menu"
    ): void {
        if (!this.gitReady) return;
        if (!this.settings.showFileMenu) return;
        if (!file) return;
        let filePath: string;
        if (typeof file === "string") {
            filePath = file;
        } else {
            filePath = file.path;
        }

        if (source == "file-explorer-context-menu") {
            menu.addItem((item) => {
                item.setTitle(`Git: Stage`)
                    .setIcon("plus-circle")
                    .setSection("action")
                    .onClick((_) => {
                        this.promiseQueue.addTask(async () => {
                            if (file instanceof TFile) {
                                await this.stageFile(file);
                            } else {
                                await this.stageAll(
                                    this.gitManager.getRelativeRepoPath(
                                        filePath,
                                        true
                                    )
                                );
                            }
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
                                await this.unstageFile(file);
                            } else {
                                await this.unstageAll(
                                    this.gitManager.getRelativeRepoPath(
                                        filePath,
                                        true
                                    )
                                );
                            }
                        });
                    });
            });
            menu.addItem((item) => {
                item.setTitle(`Git: Add to .gitignore`)
                    .setIcon("file-x")
                    .setSection("action")
                    .onClick((_) => {
                        this.promiseQueue.addTask(() =>
                            this.addFileToGitignore(
                                filePath,
                                file instanceof TFolder
                            )
                        );
                    });
            });
        }

        if (source == "git-source-control") {
            menu.addItem((item) => {
                item.setTitle(`Git: Add to .gitignore`)
                    .setIcon("file-x")
                    .setSection("action")
                    .onClick((_) => {
                        this.promiseQueue.addTask(() =>
                            this.addFileToGitignore(
                                filePath,
                                file instanceof TFolder
                            )
                        );
                    });
            });
            const gitManager = this.app.vault.adapter;
            if (
                type === "obsidian-git:menu" &&
                gitManager instanceof FileSystemAdapter
            ) {
                menu.addItem((item) => {
                    item.setTitle("Open in default app")
                        .setIcon("arrow-up-right")
                        .setSection("action")
                        .onClick((_) => {
                            this.app.openWithDefaultApp(filePath);
                        });
                });
                menu.addItem((item) => {
                    item.setTitle("Show in system explorer")
                        .setIcon("arrow-up-right")
                        .setSection("action")
                        .onClick((_) => {
                            (
                                window as unknown as ElectronWindow
                            ).electron.shell.showItemInFolder(
                                path.join(gitManager.getBasePath(), filePath)
                            );
                        });
                });
            }
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

        this.editorIntegration.onUnloadPlugin();
        this.automaticsManager.unload();
        this.branchBar?.remove();
        this.statusBar?.remove();
        this.statusBar = undefined;
        this.branchBar = undefined;
        this.gitManager.unload();
        this.promiseQueue.clear();

        for (const interval of this.intervalsToClear) {
            window.clearInterval(interval);
        }
        this.intervalsToClear = [];

        this.debRefresh.cancel();
    }

    onunload() {
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

    async init({ fromReload = false }): Promise<void> {
        if (this.localStorage.getPluginDisabled()) {
            // This is already guarded in `onload`, but we also guard here to
            // avoid any issues if `init` is called directly.
            return;
        }
        if (this.settings.showStatusBar && !this.statusBar) {
            const statusBarEl = this.addStatusBarItem();
            this.statusBar = new StatusBar(statusBarEl, this);
            this.intervalsToClear.push(
                window.setInterval(() => this.statusBar?.display(), 1000)
            );
        }

        try {
            if (this.useSimpleGit) {
                this.gitManager = new SimpleGit(this);
                await (this.gitManager as SimpleGit).setGitInstance();
            } else {
                this.gitManager = new IsomorphicGit(this);
            }

            const result = await this.gitManager.checkRequirements();
            const pausedAutomatics = this.localStorage.getPausedAutomatics();
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

                    if (
                        Platform.isDesktop &&
                        this.settings.showBranchStatusBar &&
                        !this.branchBar
                    ) {
                        const branchStatusBarEl = this.addStatusBarItem();
                        this.branchBar = new BranchStatusBar(
                            branchStatusBarEl,
                            this
                        );
                        this.intervalsToClear.push(
                            window.setInterval(
                                () =>
                                    void this.branchBar
                                        ?.display()
                                        .catch(console.error),
                                60000
                            )
                        );
                    }
                    await this.branchBar?.display();

                    this.editorIntegration.onReady();

                    this.app.workspace.trigger("obsidian-git:refresh");
                    /// Among other things, this notifies the history view that git is ready
                    this.app.workspace.trigger("obsidian-git:head-change");

                    if (
                        !fromReload &&
                        this.settings.autoPullOnBoot &&
                        !pausedAutomatics
                    ) {
                        this.promiseQueue.addTask(() =>
                            this.pullChangesFromRemote()
                        );
                    }

                    if (!pausedAutomatics) {
                        await this.automaticsManager.init();
                    }

                    if (pausedAutomatics) {
                        new Notice("Automatic routines are currently paused.");
                    }

                    break;
                default:
                    this.log(
                        "Something weird happened. The 'checkRequirements' result is " +
                            String(result)
                    );
            }
        } catch (error) {
            this.displayError(error);
            console.error(error);
        }
    }

    async createNewRepo(): Promise<GitActionResult<InitRepositoryResult>> {
        const actionResult = await runGitAction<InitRepositoryResult>(
            this,
            async () => {
                await this.gitManager.init();
                await this.init({ fromReload: true });
                return { status: "initialized" };
            }
        );
        if (actionResult.status === "success") {
            this.reportInitRepositoryResult(actionResult.value);
        }
        return actionResult;
    }

    private reportInitRepositoryResult(result: InitRepositoryResult): void {
        const status = result.status;
        switch (status) {
            case "initialized":
                this.displayMessage("Initialized new repo");
                return;
            default:
                return assertNever(status);
        }
    }

    async deleteRepository(): Promise<GitActionResult<DeleteRepositoryResult>> {
        const actionResult = await runGitAction<DeleteRepositoryResult>(
            this,
            async () => {
                const repositoryPath = this.settings.basePath
                    ? `${this.settings.basePath}/.git`
                    : ".git";
                if (!(await this.app.vault.adapter.exists(repositoryPath))) {
                    return { status: "not-found" };
                }

                const shouldDelete =
                    (await new GeneralModal(this, {
                        options: ["NO", "YES"],
                        placeholder:
                            "Do you really want to delete the repository (.git directory)? This action cannot be undone.",
                        onlySelection: true,
                    }).openAndGetResult()) === "YES";
                if (!shouldDelete) {
                    return { status: "cancelled" };
                }

                await this.app.vault.adapter.rmdir(repositoryPath, true);
                return { status: "deleted" };
            }
        );
        if (actionResult.status === "success") {
            this.reportDeleteRepositoryResult(actionResult.value);
            if (actionResult.value.status === "deleted") {
                this.unloadPlugin();
                await this.init({ fromReload: true });
            }
        }
        return actionResult;
    }

    private reportDeleteRepositoryResult(result: DeleteRepositoryResult): void {
        switch (result.status) {
            case "deleted":
                this.displayMessage(
                    "Successfully deleted repository. Reloading plugin..."
                );
                return;
            case "not-found":
                this.displayMessage("No repository found");
                return;
            case "cancelled":
                return;
            default:
                return assertNever(result);
        }
    }

    async cloneNewRepo(): Promise<GitActionResult<CloneRepositoryResult>> {
        const actionResult = await runGitAction<CloneRepositoryResult>(
            this,
            () => this.performCloneNewRepo()
        );
        if (actionResult.status === "success") {
            this.reportCloneRepositoryResult(actionResult.value);
        }
        return actionResult;
    }

    private async performCloneNewRepo(): Promise<CloneRepositoryResult> {
        const url = await new GeneralModal(this, {
            placeholder: "Enter remote URL",
        }).openAndGetResult();
        if (!url) {
            return { status: "cancelled", reason: "no-url" };
        }

        const confirmOption = "Vault Root";
        let dir = await new GeneralModal(this, {
            options:
                this.gitManager instanceof IsomorphicGit ? [confirmOption] : [],
            placeholder:
                "Enter directory for clone. It needs to be empty or not existent.",
            allowEmpty: this.gitManager instanceof IsomorphicGit,
        }).openAndGetResult();
        if (dir === undefined) {
            return { status: "cancelled", reason: "no-directory" };
        }
        if (dir === confirmOption) {
            dir = ".";
        }

        dir = normalizePath(dir);
        if (dir === "/") {
            dir = ".";
        }

        if (dir === ".") {
            const containsConflictDir = await new GeneralModal(this, {
                options: ["NO", "YES"],
                placeholder: `Does your remote repo contain a ${this.app.vault.configDir} directory at the root?`,
                onlySelection: true,
            }).openAndGetResult();
            if (containsConflictDir === undefined) {
                return { status: "cancelled", reason: "safety-declined" };
            } else if (containsConflictDir === "YES") {
                const deleteConfirmation =
                    "DELETE ALL YOUR LOCAL CONFIG AND PLUGINS";
                const shouldDelete =
                    (await new GeneralModal(this, {
                        options: ["Abort clone", deleteConfirmation],
                        placeholder: `To avoid conflicts, the local ${this.app.vault.configDir} directory needs to be deleted.`,
                        onlySelection: true,
                    }).openAndGetResult()) === deleteConfirmation;
                if (!shouldDelete) {
                    return { status: "cancelled", reason: "safety-declined" };
                }
                await this.app.vault.adapter.rmdir(
                    this.app.vault.configDir,
                    true
                );
            }
        }

        const depth = await new GeneralModal(this, {
            placeholder: "Specify depth of clone. Leave empty for full clone.",
            allowEmpty: true,
        }).openAndGetResult();
        if (depth === undefined) {
            return { status: "cancelled", reason: "no-depth" };
        }

        let depthInt: number | undefined;
        if (depth !== "") {
            depthInt = parseInt(depth);
            if (isNaN(depthInt)) {
                return { status: "invalid", reason: "depth" };
            }
        }

        new Notice(`Cloning new repo into "${dir}"`);
        const oldBase = this.settings.basePath;
        const customDir = dir !== ".";
        if (customDir) {
            this.settings.basePath = dir;
        }
        try {
            await this.gitManager.clone(formatRemoteUrl(url), dir, depthInt);
            if (customDir) {
                await this.saveSettings();
            }
            return { status: "cloned" };
        } catch (error) {
            this.settings.basePath = oldBase;
            await this.saveSettings();
            throw error;
        }
    }

    private reportCloneRepositoryResult(result: CloneRepositoryResult): void {
        switch (result.status) {
            case "cloned":
                this.displayMessage("Cloned new repo.");
                this.displayMessage("Please restart Obsidian");
                return;
            case "cancelled": {
                const reason = result.reason;
                switch (reason) {
                    case "safety-declined":
                    case "no-depth":
                        this.displayMessage("Aborted clone");
                        return;
                    case "no-url":
                    case "no-directory":
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            case "invalid": {
                const reason = result.reason;
                switch (reason) {
                    case "depth":
                        this.displayMessage("Invalid depth. Aborting clone.");
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            default:
                return assertNever(result);
        }
    }

    /**
     * Retries to call `this.init()` if necessary, otherwise returns directly
     * @returns true if `this.gitManager` is ready to be used, false if not.
     */
    async isAllInitialized(): Promise<boolean> {
        if (!this.gitReady) {
            await this.init({ fromReload: true });
        }
        return this.gitReady;
    }

    private runReadyGitAction<T>(
        action: () => Promise<T>
    ): Promise<GitActionResult<T | NotReadyResult>> {
        return runGitAction(this, async () => {
            if (!(await this.isAllInitialized())) {
                return { status: "skipped", reason: "not-ready" };
            }
            return action();
        });
    }

    async listChangedFiles(): Promise<GitActionResult<ListChangedFilesResult>> {
        const actionResult =
            await this.runReadyGitAction<ListChangedFilesResult>(async () => {
                const status = await this.updateCachedStatus();
                const files = status.changed.length + status.staged.length;
                if (files > 500) {
                    return {
                        status: "blocked",
                        reason: "too-many-changes",
                        files,
                    };
                }

                new ChangedFilesModal(this, status.all).open();
                return { status: "displayed" };
            });
        if (actionResult.status === "success") {
            this.reportListChangedFilesResult(actionResult.value);
        }
        return actionResult;
    }

    private reportListChangedFilesResult(result: ListChangedFilesResult): void {
        switch (result.status) {
            case "displayed":
            case "skipped":
                return;
            case "blocked": {
                const reason = result.reason;
                switch (reason) {
                    case "too-many-changes":
                        this.displayError("Too many changes to display");
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            default:
                return assertNever(result);
        }
    }

    ///Used for command
    async pullChangesFromRemote(): Promise<void> {
        const actionResult = await this.pull();
        if (actionResult.status !== "success") {
            return;
        }
        const pullResult = actionResult.value;
        if (pullResult.status === "skipped") {
            return;
        }
        this.reportPullResult(pullResult);
        this.app.workspace.trigger("obsidian-git:refresh");
    }

    private reportPullResult(result: PullResult): void {
        switch (result.status) {
            case "updated":
                this.displayMessage(
                    `Pulled ${result.files.length} ${
                        result.files.length == 1 ? "file" : "files"
                    } from remote`
                );
                this.lastPulledFiles = result.files;
                return;
            case "up-to-date":
                this.displayMessage("Pull: Everything is up-to-date");
                return;
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "not-ready":
                    case "no-upstream":
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            default:
                return assertNever(result);
        }
    }

    private resolveCommitMode(
        mode: CommitMode,
        stagedCount: number
    ): Exclude<CommitMode, "smart"> | "nothing" {
        if (mode === "all") return "all";
        if (stagedCount > 0) return "staged";
        if (mode === "staged") return "nothing";
        return this.settings.autoStageOnEmptyIndex ? "all" : "nothing";
    }

    async commitAndSync(
        options: CommitAndSyncOptions
    ): Promise<GitActionResult<CommitAndSyncResult>> {
        return this.runReadyGitAction<CommitAndSyncResult>(() =>
            this.performCommitAndSync(options)
        );
    }

    private async performCommitAndSync({
        fromAutoBackup,
        requestCustomMessage = false,
        commitMessage,
        mode = "all",
    }: CommitAndSyncOptions): Promise<CommitAndSyncResult> {
        if (
            this.settings.syncMethod == "reset" &&
            this.settings.pullBeforePush
        ) {
            this.reportPullResult(await this.performPull());
        }

        const commitResult = await this.performCommit({
            fromAuto: fromAutoBackup,
            requestCustomMessage,
            commitMessage,
            mode,
        });
        this.reportCommitResult(commitResult);
        switch (commitResult.status) {
            case "committed":
            case "nothing-to-commit":
                break;
            case "skipped":
                return {
                    status: "skipped",
                    reason: "commit-skipped",
                    commit: commitResult,
                };
            default:
                return assertNever(commitResult);
        }

        if (
            this.settings.syncMethod != "reset" &&
            this.settings.pullBeforePush
        ) {
            this.reportPullResult(await this.performPull());
        }

        if (this.settings.disablePush) {
            return {
                status: "commit-only",
                reason: "push-disabled",
                commit: commitResult,
            };
        }

        if (!(await this.isPushRemoteSet())) {
            return {
                status: "skipped",
                reason: "push-skipped",
                commit: commitResult,
            };
        }

        // Prevent trying to push every time. Only if unpushed commits are present
        if (await this.gitManager.canPush()) {
            const pushResult = await this.performPush();
            this.reportPushResult(pushResult);
            switch (pushResult.status) {
                case "pushed":
                    return { status: "synced", commit: commitResult };
                case "up-to-date":
                    return {
                        status: "nothing-to-push",
                        commit: commitResult,
                    };
                case "blocked":
                case "skipped":
                    return {
                        status: "skipped",
                        reason: "push-skipped",
                        commit: commitResult,
                    };
                default:
                    return assertNever(pushResult);
            }
        }

        this.reportPushResult({ status: "up-to-date" });
        return { status: "nothing-to-push", commit: commitResult };
    }

    async commit(
        options: CommitOptions
    ): Promise<GitActionResult<CommitResult>> {
        const actionResult = await this.runReadyGitAction<CommitResult>(() =>
            this.performCommit(options)
        );
        if (actionResult.status === "success") {
            this.reportCommitResult(actionResult.value);
        }
        return actionResult;
    }

    private async performCommit({
        fromAuto,
        requestCustomMessage = false,
        mode = "all",
        commitMessage,
        amend = false,
    }: CommitOptions): Promise<CommitResult> {
        let stagedFiles: { vaultPath: string; path: string }[] = [];
        let unstagedFiles: (UnstagedFile & { vaultPath: string })[] = [];
        let resolvedMode: Exclude<CommitMode, "smart"> | "nothing" =
            mode === "smart" ? "nothing" : mode;

        const status = await this.updateCachedStatus();
        const mergeInProgress = this.state.mergeInProgress;
        if (this.gitManager instanceof SimpleGit) {
            stagedFiles = status.staged;

            // This typecast is only needed to hide the fact that `type` is missing, but that is only needed for isomorphic-git
            unstagedFiles = status.changed as unknown as (UnstagedFile & {
                vaultPath: string;
            })[];
            resolvedMode = this.resolveCommitMode(mode, stagedFiles.length);
        } else {
            // isomorphic-git section

            const gitManager = this.gitManager as IsomorphicGit;
            stagedFiles = await gitManager.getStagedFiles();
            resolvedMode = this.resolveCommitMode(mode, stagedFiles.length);
            if (resolvedMode === "all") {
                const res = await gitManager.getUnstagedFiles();
                unstagedFiles = res.map(({ path, type }) => ({
                    vaultPath: this.gitManager.getRelativeVaultPath(path),
                    path,
                    type,
                }));
            }
        }

        if (fromAuto && mergeInProgress) {
            if (status.conflicted.length > 0) {
                throw new GitConflictError(
                    status.conflicted,
                    new Error(
                        "Automatic commit stopped because of unresolved conflicts"
                    )
                );
            }
            return { status: "skipped", reason: "merge-in-progress" };
        }

        if (resolvedMode === "nothing") {
            return {
                status: "nothing-to-commit",
                reason: "nothing-staged",
            };
        }

        const onlyStaged = resolvedMode === "staged";

        if (
            await this.tools.hasTooBigFiles(
                onlyStaged ? stagedFiles : [...stagedFiles, ...unstagedFiles]
            )
        ) {
            return { status: "skipped", reason: "files-too-large" };
        }

        const changesCountToCommit =
            (onlyStaged ? 0 : unstagedFiles.length) + stagedFiles.length !== 0;
        if (changesCountToCommit || mergeInProgress) {
            // The commit message from settings or previously set in the
            // source control view
            let cmtMessage = (commitMessage ??= fromAuto
                ? this.settings.autoCommitMessage
                : this.settings.commitMessage);

            // Optionally ask the user via a modal for a commit message
            if (
                (fromAuto && this.settings.customMessageOnAutoBackup) ||
                requestCustomMessage
            ) {
                if (!this.settings.disablePopups && fromAuto) {
                    new Notice(
                        "Auto backup: Please enter a custom commit message. Leave empty to abort"
                    );
                }
                const modalMessage = await new CustomMessageModal(
                    this
                ).openAndGetResult();

                if (
                    modalMessage != undefined &&
                    modalMessage != "" &&
                    modalMessage != "..."
                ) {
                    cmtMessage = modalMessage;
                } else {
                    throw new Errors.UserCanceledError();
                }

                // On desktop may run a script to get the commit message
            } else if (
                this.gitManager instanceof SimpleGit &&
                this.settings.commitMessageScript
            ) {
                cmtMessage = await this.getMessageFromScript(cmtMessage);
            }

            // Check if commit message is empty after all processing
            if (!cmtMessage || cmtMessage.trim() === "") {
                throw new Errors.UserCanceledError();
            }

            let committedFiles: number;
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

            // Handle eventually resolved conflicts
            if (this.gitManager instanceof SimpleGit) {
                await this.updateCachedStatus();
            }

            this.app.workspace.trigger("obsidian-git:refresh");
            if (committedFiles === 0) {
                // simple-git resolves with { changes: 0 } instead of
                // throwing when there is nothing to commit (e.g. the
                // detected change was already committed by a previous run).
                return {
                    status: "nothing-to-commit",
                    reason: "no-changes",
                };
            }
            return { status: "committed", files: committedFiles };
        } else {
            this.app.workspace.trigger("obsidian-git:refresh");
            return {
                status: "nothing-to-commit",
                reason: "no-changes",
            };
        }
    }

    private async getMessageFromScript(cmtMessage: string) {
        const templateScript = this.settings.commitMessageScript;
        const hostname = this.localStorage.getHostname() || "";
        let formattedScript = templateScript.replace("{{hostname}}", hostname);

        formattedScript = formattedScript.replace(
            "{{date}}",
            moment().format(this.settings.commitDateFormat)
        );
        let shPath = "sh";
        if (Platform.isWin) {
            shPath = process.env.PROGRAMFILES + "\\Git\\bin\\sh.exe";
            let shExists = false;
            try {
                await fsPromises.access(shPath, fsPromises.constants.X_OK);
                shExists = true;
            } catch {
                shExists = false;
            }

            if (!shExists) {
                throw new Error(
                    `Cannot find sh.exe at ${shPath}. Please make sure Git is properly installed.`
                );
            }
        }

        const res = await spawnAsync(shPath, ["-c", formattedScript], {
            cwd: (this.gitManager as SimpleGit).absoluteRepoPath,
        });
        if (res.code != 0) {
            throw new Error(
                res.stderr ||
                    `Commit message script exited with code ${res.code}`
            );
        } else if (res.stdout.trim().length == 0) {
            this.displayMessage(
                "Stdout from commit message script is empty. Using default message."
            );
        } else {
            cmtMessage = res.stdout;
        }
        return cmtMessage;
    }

    private reportCommitResult(result: CommitResult): void {
        switch (result.status) {
            case "committed":
                this.displayMessage(
                    `Committed ${result.files} ${
                        result.files == 1 ? "file" : "files"
                    }`
                );
                return;
            case "nothing-to-commit": {
                const reason = result.reason;
                switch (reason) {
                    case "nothing-staged":
                        this.displayMessage(
                            "Nothing staged. Stage changes first or use Commit all changes."
                        );
                        return;
                    case "no-changes":
                        this.displayMessage("No changes to commit");
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "merge-in-progress":
                        this.displayError(
                            "Did not commit automatically because a merge is in progress. Commit it manually."
                        );
                        return;
                    case "not-ready":
                    case "files-too-large":
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            default:
                return assertNever(result);
        }
    }

    async push(): Promise<GitActionResult<PushResult>> {
        const actionResult = await this.runReadyGitAction<PushResult>(() =>
            this.performPush()
        );
        if (actionResult.status === "success") {
            this.reportPushResult(actionResult.value);
        }
        return actionResult;
    }

    private async performPush(): Promise<PushResult> {
        if (!(await this.isPushRemoteSet())) {
            return { status: "skipped", reason: "no-upstream" };
        }
        // Refresh because of pull
        const status = await this.updateCachedStatus();
        if (status.conflicted.length > 0) {
            return {
                status: "blocked",
                reason: "conflicts",
                files: status.conflicted.length,
            };
        } else if (this.state.mergeInProgress) {
            return { status: "blocked", reason: "merge-in-progress" };
        }
        // Squash local unpushed commits into one before pushing, so frequent
        // local commits don't clutter the remote history. Only unpushed
        // history is rewritten (no force-push). Conflicts are excluded above.
        if (
            this.settings.squashCommitsBeforePush &&
            this.gitManager instanceof SimpleGit
        ) {
            await this.gitManager.squashAllUnpushedCommits();
        }
        this.log("Pushing....");
        const result = await this.gitManager.push();
        this.setPluginState({ offlineMode: false });
        this.app.workspace.trigger("obsidian-git:refresh");
        return result;
    }

    private reportPushResult(result: PushResult): void {
        switch (result.status) {
            case "pushed":
                if (result.files === null) {
                    this.displayMessage("Pushed to remote");
                } else {
                    this.displayMessage(
                        `Pushed ${result.files} ${
                            result.files == 1 ? "file" : "files"
                        } to remote`
                    );
                }
                return;
            case "up-to-date":
                this.displayMessage("No commits to push");
                return;
            case "blocked": {
                const reason = result.reason;
                switch (reason) {
                    case "no-branch":
                        this.displayError(
                            "No current branch found. Cannot push."
                        );
                        return;
                    case "conflicts":
                        this.displayError(
                            `Cannot push. You have conflicts in ${
                                result.files
                            } ${result.files == 1 ? "file" : "files"}`
                        );
                        return;
                    case "merge-in-progress":
                        this.displayError(
                            "Cannot push while a merge is still in progress"
                        );
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "not-ready":
                    case "no-upstream":
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            default:
                return assertNever(result);
        }
    }

    async pull(): Promise<GitActionResult<PullResult>> {
        return this.runReadyGitAction<PullResult>(() => this.performPull());
    }

    private async performPull(): Promise<PullResult> {
        if (!(await this.isPullRemoteSet())) {
            return { status: "skipped", reason: "no-upstream" };
        }
        this.log("Pulling....");
        const result = await this.gitManager.pull();
        this.setPluginState({ offlineMode: false });
        return result;
    }

    async fetch(): Promise<GitActionResult<FetchResult>> {
        const actionResult = await this.runReadyGitAction<FetchResult>(
            async () => {
                if (!(await this.isPushRemoteSet())) {
                    return { status: "skipped", reason: "no-upstream" };
                }
                await this.gitManager.fetch();
                this.setPluginState({ offlineMode: false });
                this.app.workspace.trigger("obsidian-git:refresh");
                return { status: "fetched" };
            }
        );
        if (actionResult.status === "success") {
            this.reportFetchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportFetchResult(result: FetchResult): void {
        switch (result.status) {
            case "fetched":
                this.displayMessage("Fetched from remote");
                return;
            case "skipped": {
                const reason = result.reason;
                switch (reason) {
                    case "not-ready":
                    case "no-upstream":
                        return;
                    default:
                        return assertNever(reason);
                }
            }
            default:
                return assertNever(result);
        }
    }

    async stageFile(
        file: TFile
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.stage(file.path, true);
    }

    async stage(
        path: string,
        relativeToVault: boolean
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.gitManager.stage(path, relativeToVault)
        );
    }

    async stageAll(
        path?: string
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.gitManager.stageAll({ dir: path })
        );
    }

    async unstageFile(
        file: TFile
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.unstage(file.path, true);
    }

    async unstage(
        path: string,
        relativeToVault: boolean
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.gitManager.unstage(path, relativeToVault)
        );
    }

    async unstageAll(
        path?: string
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(() =>
            this.gitManager.unstageAll({ dir: path })
        );
    }

    async applyPatch(
        patch: string
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runFileStateMutation(async () => {
            if (!(this.gitManager instanceof SimpleGit)) {
                throw new Error(
                    "Applying a patch is only supported on desktop"
                );
            }
            await this.gitManager.applyPatch(patch);
        });
    }

    private async runFileStateMutation(
        action: () => Promise<void>
    ): Promise<GitActionResult<FileStateMutationResult>> {
        return this.runReadyGitAction<FileStateMutationResult>(async () => {
            await action();
            this.app.workspace.trigger("obsidian-git:refresh");
            return { status: "updated" };
        });
    }

    async setGitConfig(
        path: string,
        value: string | number | boolean | undefined
    ): Promise<GitActionResult<void>> {
        return runGitAction(this, () => this.gitManager.setConfig(path, value));
    }

    async changeGitPath(path: string): Promise<GitActionResult<void>> {
        return runGitAction(this, async () => {
            this.localStorage.setGitPath(path);
            await this.gitManager.updateGitPath(path || "git");
        });
    }

    async reloadGitManager(): Promise<GitActionResult<void>> {
        return runGitAction(this, async () => {
            if (!(this.gitManager instanceof SimpleGit)) {
                throw new Error(
                    "Reloading native Git is only supported on desktop"
                );
            }
            await this.gitManager.setGitInstance();
        });
    }

    async changeBasePath(path: string): Promise<GitActionResult<void>> {
        return runGitAction(this, async () => {
            this.settings.basePath = path;
            await this.saveSettings();
            await this.gitManager.updateBasePath(path);
        });
    }

    async runRawCommand(
        command: string
    ): Promise<GitActionResult<RawCommandResult>> {
        const notice = new Notice(`Running '${command}'...`, 999_999);
        const actionResult = await runGitAction<RawCommandResult>(
            this,
            async () => {
                if (!(this.gitManager instanceof SimpleGit)) {
                    throw new Error(
                        "Raw Git commands are only supported on desktop"
                    );
                }
                return {
                    status: "completed",
                    output: await this.gitManager.rawCommand(command),
                };
            }
        );
        if (actionResult.status === "success" && actionResult.value.output) {
            notice.setMessage(actionResult.value.output);
            window.setTimeout(() => notice.hide(), 5000);
        } else {
            notice.hide();
        }
        return actionResult;
    }

    async switchBranch(): Promise<GitActionResult<SwitchBranchResult>> {
        const actionResult = await this.runReadyGitAction<SwitchBranchResult>(
            async () => {
                const branchInfo = await this.gitManager.branchInfo();
                const selectedBranch = await new BranchModal(
                    this,
                    branchInfo.branches
                ).openAndGetReslt();
                if (selectedBranch === undefined) {
                    return { status: "cancelled" };
                }

                await this.gitManager.checkout(selectedBranch);
                this.app.workspace.trigger("obsidian-git:refresh");
                await this.branchBar?.display();
                return { status: "switched", branch: selectedBranch };
            }
        );
        if (actionResult.status === "success") {
            this.reportSwitchBranchResult(actionResult.value);
        }
        return actionResult;
    }

    async switchRemoteBranch(): Promise<GitActionResult<SwitchBranchResult>> {
        const actionResult = await this.runReadyGitAction<SwitchBranchResult>(
            async () => {
                const selectedBranch = await this.selectRemoteBranch();
                if (selectedBranch === undefined) {
                    return { status: "cancelled" };
                }
                const [remote, branch] = splitRemoteBranch(selectedBranch);
                if (branch === undefined || remote === undefined) {
                    return { status: "cancelled" };
                }

                await this.gitManager.checkout(branch, remote);
                await this.branchBar?.display();
                return { status: "switched", branch: selectedBranch };
            }
        );
        if (actionResult.status === "success") {
            this.reportSwitchBranchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportSwitchBranchResult(result: SwitchBranchResult): void {
        switch (result.status) {
            case "switched":
                this.displayMessage(`Switched to ${result.branch}`);
                return;
            case "cancelled":
            case "skipped":
                return;
            default:
                return assertNever(result);
        }
    }

    async createBranch(): Promise<GitActionResult<CreateBranchResult>> {
        const actionResult = await this.runReadyGitAction<CreateBranchResult>(
            async () => {
                const branch = await new GeneralModal(this, {
                    placeholder: "Create new branch",
                }).openAndGetResult();
                if (branch === undefined) {
                    return { status: "cancelled" };
                }

                await this.gitManager.createBranch(branch);
                await this.branchBar?.display();
                return { status: "created", branch };
            }
        );
        if (actionResult.status === "success") {
            this.reportCreateBranchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportCreateBranchResult(result: CreateBranchResult): void {
        switch (result.status) {
            case "created":
                this.displayMessage(`Created new branch ${result.branch}`);
                return;
            case "cancelled":
            case "skipped":
                return;
            default:
                return assertNever(result);
        }
    }

    async deleteBranch(): Promise<GitActionResult<DeleteBranchResult>> {
        const actionResult = await this.runReadyGitAction<DeleteBranchResult>(
            async () => {
                const branchInfo = await this.gitManager.branchInfo();
                if (branchInfo.current) {
                    branchInfo.branches.remove(branchInfo.current);
                }
                const branch = await new GeneralModal(this, {
                    options: branchInfo.branches,
                    placeholder: "Delete branch",
                    onlySelection: true,
                }).openAndGetResult();
                if (branch === undefined) {
                    return { status: "cancelled" };
                }

                let force = false;
                const merged = await this.gitManager.branchIsMerged(branch);
                if (!merged) {
                    const forceAnswer = await new GeneralModal(this, {
                        options: ["YES", "NO"],
                        placeholder:
                            "This branch isn't merged into HEAD. Force delete?",
                        onlySelection: true,
                    }).openAndGetResult();
                    if (forceAnswer !== "YES") {
                        return { status: "cancelled" };
                    }
                    force = true;
                }
                await this.gitManager.deleteBranch(branch, force);
                await this.branchBar?.display();
                return { status: "deleted", branch };
            }
        );
        if (actionResult.status === "success") {
            this.reportDeleteBranchResult(actionResult.value);
        }
        return actionResult;
    }

    private reportDeleteBranchResult(result: DeleteBranchResult): void {
        switch (result.status) {
            case "deleted":
                this.displayMessage(`Deleted branch ${result.branch}`);
                return;
            case "cancelled":
            case "skipped":
                return;
            default:
                return assertNever(result);
        }
    }

    private async canAutoSetupPushRemote(): Promise<boolean> {
        return (
            this.gitManager instanceof SimpleGit &&
            (await this.gitManager.getConfig("push.autoSetupRemote", "all")) ==
                "true"
        );
    }

    /**
     * A pull needs an existing upstream. When Git is configured to create the
     * upstream on the first push, skip the pull and let that push establish it.
     */
    async isPullRemoteSet(): Promise<boolean> {
        if (this.settings.updateSubmodules) {
            return true;
        }
        if ((await this.gitManager.branchInfo()).tracking) {
            return true;
        }
        if (await this.canAutoSetupPushRemote()) {
            new Notice(
                "Upstream branch will be created on first push. Skipping pull.\nUse set upstream branch command to set it manually if desired."
            );
            return false;
        }
        new Notice("No upstream branch is set. Please select one.");
        const result = await this.performSetUpstreamBranch();
        this.reportSetUpstreamResult(result);
        return result.status === "updated";
    }

    /**
     * A push can proceed without an existing upstream when Git is configured
     * to create it automatically.
     */
    async isPushRemoteSet(): Promise<boolean> {
        if (
            this.settings.updateSubmodules ||
            (await this.canAutoSetupPushRemote())
        ) {
            return true;
        }
        if (!(await this.gitManager.branchInfo()).tracking) {
            new Notice("No upstream branch is set. Please select one.");
            const result = await this.performSetUpstreamBranch();
            this.reportSetUpstreamResult(result);
            return result.status === "updated";
        }
        return true;
    }

    async setUpstreamBranch(): Promise<GitActionResult<SetUpstreamResult>> {
        const actionResult = await this.runReadyGitAction<SetUpstreamResult>(
            async () => {
                return this.performSetUpstreamBranch();
            }
        );
        if (actionResult.status === "success") {
            this.reportSetUpstreamResult(actionResult.value);
        }
        return actionResult;
    }

    private async performSetUpstreamBranch(): Promise<SetUpstreamResult> {
        const remoteBranch = await this.selectRemoteBranch();

        if (remoteBranch == undefined) {
            return { status: "cancelled" };
        }
        await this.gitManager.updateUpstreamBranch(remoteBranch);
        return { status: "updated", branch: remoteBranch };
    }

    private reportSetUpstreamResult(result: SetUpstreamResult): void {
        switch (result.status) {
            case "updated":
                this.displayMessage(`Set upstream branch to ${result.branch}`);
                return;
            case "cancelled":
                this.displayError("Aborted. No upstream-branch is set!", 10000);
                return;
            case "skipped":
                return;
            default:
                return assertNever(result);
        }
    }

    async discardFile(
        file: FileStatusResult
    ): Promise<GitActionResult<DiscardActionResult>> {
        const actionResult = await this.runReadyGitAction<DiscardActionResult>(
            async () => {
                const deleteFile = file.workingDir === "U";
                const selection = await new DiscardModal({
                    app: this.app,
                    filesToDeleteCount: deleteFile ? 1 : 0,
                    filesToDiscardCount: deleteFile ? 0 : 1,
                    path: file.vaultPath,
                }).openAndGetResult();
                if (selection === false) {
                    return { status: "cancelled" };
                }

                if (selection === "delete") {
                    const tFile = this.app.vault.getAbstractFileByPath(
                        file.vaultPath
                    );
                    if (tFile) {
                        await this.app.fileManager.trashFile(tFile);
                    } else {
                        await this.app.vault.adapter.remove(file.vaultPath);
                    }
                } else {
                    await this.gitManager.discard(file.path);
                }
                this.app.workspace.trigger("obsidian-git:refresh");
                return { status: "discarded", target: "file" };
            }
        );
        if (actionResult.status === "success") {
            this.reportDiscardResult(actionResult.value, false);
        }
        return actionResult;
    }

    async discardAll(
        path?: string
    ): Promise<GitActionResult<DiscardActionResult>> {
        const actionResult = await this.runReadyGitAction<DiscardActionResult>(
            async () => {
                const status = await this.gitManager.status({ path });
                let filesToDeleteCount = 0;
                let filesToDiscardCount = 0;
                for (const file of status.changed) {
                    if (file.workingDir == "U") {
                        filesToDeleteCount++;
                    } else {
                        filesToDiscardCount++;
                    }
                }
                if (filesToDeleteCount + filesToDiscardCount == 0) {
                    return { status: "skipped", reason: "no-changes" };
                }

                const selection = await new DiscardModal({
                    app: this.app,
                    filesToDeleteCount,
                    filesToDiscardCount,
                    path: path ?? "",
                }).openAndGetResult();
                if (selection === false) {
                    return { status: "cancelled" };
                }

                await this.gitManager.discardAll({ dir: path, status });
                if (selection === "delete") {
                    const untrackedPaths =
                        await this.gitManager.getUntrackedPaths({
                            path,
                            status,
                        });
                    for (const file of untrackedPaths) {
                        const vaultPath =
                            this.gitManager.getRelativeVaultPath(file);
                        const tFile =
                            this.app.vault.getAbstractFileByPath(vaultPath);

                        if (tFile) {
                            await this.app.fileManager.trashFile(tFile);
                        } else if (file.endsWith("/")) {
                            await this.app.vault.adapter.rmdir(vaultPath, true);
                        } else {
                            await this.app.vault.adapter.remove(vaultPath);
                        }
                    }
                }
                this.app.workspace.trigger("obsidian-git:refresh");
                return {
                    status: "discarded",
                    target: selection === "delete" ? "all" : "tracked",
                };
            }
        );
        if (actionResult.status === "success") {
            this.reportDiscardResult(actionResult.value, path === undefined);
        }
        return actionResult;
    }

    private reportDiscardResult(
        result: DiscardActionResult,
        showSuccess: boolean
    ): void {
        switch (result.status) {
            case "discarded":
                if (!showSuccess || result.target === "file") return;
                this.displayMessage(
                    result.target === "all"
                        ? "Discarded all files."
                        : "Discarded all changes in tracked files."
                );
                return;
            case "cancelled":
            case "skipped":
                return;
            default:
                return assertNever(result);
        }
    }

    handleConflict(conflictedFiles: readonly string[]): void {
        const count = conflictedFiles.length;
        this.displayError(
            count > 0
                ? `Merge conflict in ${count} ${
                      count == 1 ? "file" : "files"
                  }. Resolve conflicts and commit manually.`
                : "Merge conflict. Resolve conflicts and commit manually."
        );
    }

    openMergeConflictHelp(): void {
        new MergeConflictModal(this).open();
    }

    async editRemotes(): Promise<GitActionResult<EditRemoteResult>> {
        const actionResult = await this.runReadyGitAction<EditRemoteResult>(
            async () => {
                return this.performEditRemotes();
            }
        );
        if (actionResult.status === "success") {
            this.reportEditRemoteResult(actionResult.value);
        }
        return actionResult;
    }

    private async performEditRemotes(): Promise<EditRemoteResult> {
        const remotes = await this.gitManager.getRemotes();
        const remoteName = await new GeneralModal(this, {
            options: remotes,
            placeholder:
                "Select or create a new remote by typing its name and selecting it",
        }).openAndGetResult();
        if (!remoteName) {
            return { status: "cancelled" };
        }

        const oldUrl = await this.gitManager.getRemoteUrl(remoteName);
        const remoteURL = await new GeneralModal(this, {
            initialValue: oldUrl,
            placeholder: "Enter remote URL",
        }).openAndGetResult();
        if (!remoteURL) {
            return { status: "cancelled" };
        }

        await this.gitManager.setRemote(remoteName, formatRemoteUrl(remoteURL));
        return { status: "updated", remote: remoteName };
    }

    private reportEditRemoteResult(result: EditRemoteResult): void {
        switch (result.status) {
            case "updated":
            case "cancelled":
            case "skipped":
                return;
            default:
                return assertNever(result);
        }
    }

    private async selectRemoteBranch(): Promise<string | undefined> {
        let remotes = await this.gitManager.getRemotes();
        let selectedRemote: string | undefined;
        if (remotes.length === 0) {
            const editResult = await this.performEditRemotes();
            if (editResult.status === "updated") {
                selectedRemote = editResult.remote;
            }
            if (selectedRemote == undefined) {
                remotes = await this.gitManager.getRemotes();
            }
        }

        const nameModal = new GeneralModal(this, {
            options: remotes,
            placeholder:
                "Select or create a new remote by typing its name and selecting it",
        });
        const remoteName =
            selectedRemote ?? (await nameModal.openAndGetResult());

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
            const branch = await branchModal.openAndGetResult();
            if (branch == undefined) return undefined;
            if (!branch.startsWith(remoteName + "/")) {
                // If the branch does not start with the remote name, prepend it
                return `${remoteName}/${branch}`;
            }
            return branch; // Already in the correct format
        }
        return undefined;
    }

    async removeRemote(): Promise<GitActionResult<RemoveRemoteResult>> {
        const actionResult = await this.runReadyGitAction<RemoveRemoteResult>(
            async () => {
                const remotes = await this.gitManager.getRemotes();
                const remoteName = await new GeneralModal(this, {
                    options: remotes,
                    placeholder: "Select a remote",
                }).openAndGetResult();
                if (!remoteName) {
                    return { status: "cancelled" };
                }

                await this.gitManager.removeRemote(remoteName);
                return { status: "removed", remote: remoteName };
            }
        );
        if (actionResult.status === "success") {
            this.reportRemoveRemoteResult(actionResult.value);
        }
        return actionResult;
    }

    private reportRemoveRemoteResult(result: RemoveRemoteResult): void {
        switch (result.status) {
            case "removed":
            case "cancelled":
            case "skipped":
                return;
            default:
                return assertNever(result);
        }
    }

    onActiveLeafChange(leaf: WorkspaceLeaf | null): void {
        const view = leaf?.view;
        // Prevent removing focus when switching to other panes than file panes like search or GitView
        if (
            !view?.getState().file &&
            !(view instanceof DiffView || view instanceof SplitDiffView)
        )
            return;

        const sourceControlLeaf = this.app.workspace
            .getLeavesOfType(SOURCE_CONTROL_VIEW_CONFIG.type)
            .first();
        const historyLeaf = this.app.workspace
            .getLeavesOfType(HISTORY_VIEW_CONFIG.type)
            .first();

        // Clear existing active state
        sourceControlLeaf?.view.containerEl
            .querySelector(`div.tree-item-self.is-active`)
            ?.removeClass("is-active");
        historyLeaf?.view.containerEl
            .querySelector(`div.tree-item-self.is-active`)
            ?.removeClass("is-active");

        if (
            leaf?.view instanceof DiffView ||
            leaf?.view instanceof SplitDiffView
        ) {
            const path = leaf.view.state.bFile;
            const escapedPath = path.replace(/["\\]/g, "\\$&");
            this.lastDiffViewState = leaf.view.getState();
            let el: Element | undefined | null;
            if (sourceControlLeaf && leaf.view.state.aRef == "HEAD") {
                el = sourceControlLeaf.view.containerEl.querySelector(
                    `div.staged div.tree-item-self[data-path="${escapedPath}"]`
                );
            } else if (sourceControlLeaf && leaf.view.state.aRef == "") {
                el = sourceControlLeaf.view.containerEl.querySelector(
                    `div.changes div.tree-item-self[data-path="${escapedPath}"]`
                );
            } else if (historyLeaf) {
                el = historyLeaf.view.containerEl.querySelector(
                    `div.tree-item-self[data-path='${escapedPath}']`
                );
            }
            el?.addClass("is-active");
        } else {
            this.lastDiffViewState = undefined;
        }
    }

    handleNoNetworkError(_: NoNetworkError): void {
        if (!this.state.offlineMode) {
            this.displayError(
                "Git: Going into offline mode. Future network errors will no longer be displayed.",
                2000
            );
        } else {
            this.log("Encountered network error, but already in offline mode");
        }
        this.setPluginState({
            offlineMode: true,
        });
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

    displayError(data: unknown, timeout: number = 10 * 1000): void {
        if (data instanceof Errors.UserCanceledError) {
            new Notice("Aborted");
            return;
        }
        let error: Error;
        if (data instanceof Error) {
            error = data;
        } else {
            error = new Error(String(data));
        }

        if (this.settings.showErrorNotices) {
            new Notice(error.message, timeout);
        }
        console.error(`${this.manifest.id}:`, error.stack);
        this.statusBar?.displayMessage(error.message.toLowerCase(), timeout);
    }

    log(...data: unknown[]) {
        console.log(`${this.manifest.id}:`, ...data);
    }
}
