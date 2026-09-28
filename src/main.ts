import { Errors } from "isomorphic-git";
import type { Debouncer, Menu, TAbstractFile, WorkspaceLeaf } from "obsidian";
import {
    debounce,
    FileSystemAdapter,
    Notice,
    Platform,
    Plugin,
    TFile,
    TFolder,
} from "obsidian";
import * as path from "path";
import { pluginRef } from "src/pluginGlobalRef";
import { PromiseQueue } from "src/promiseQueue";
import { ObsidianGitSettingsTab } from "src/setting/settings";
import { StatusBar } from "src/statusBar";
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
    ElectronWindow,
    FileStatusResult,
    ObsidianGitSettings,
    PluginState,
    Status,
} from "./types";
import { GitOperation, mergeSettingsByPriority, NoNetworkError } from "./types";
import DiffView from "./ui/diff/diffView";
import SplitDiffView from "./ui/diff/splitDiffView";
import HistoryView from "./ui/history/historyView";
import ReadOnlyFileView from "./ui/readOnlyFileView";
import { MergeConflictModal } from "./ui/modals/mergeConflictModal";
import GitView from "./ui/sourceControl/sourceControl";
import { BranchStatusBar } from "./ui/statusBar/branchStatusBar";
import { HunkActions } from "./editor/signs/hunkActions";
import { coalesce } from "./coalesce";
import { EditorIntegration } from "./editor/editorIntegration";
import { runGitAction, type GitActionResult } from "./gitAction";
import { GitActions } from "./gitActions";

export default class ObsidianGit extends Plugin {
    gitActions = new GitActions(this);
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
    /**
     * Whether the Git repository is missing.
     *
     * This is used to show a notice in the source control view
     */
    repositoryMissing = false;
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

    /**
     * Refreshes the cached status and notifies listeners. Calls made while a
     * refresh is running are coalesced into a single follow-up refresh, so
     * bursts of triggers don't start overlapping `git status` runs.
     */
    refresh = coalesce(() => this.refreshNow());

    private async refreshNow(): Promise<void> {
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
                                await this.gitActions.stageFile(file);
                            } else {
                                await this.gitActions.stageAll(
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
                                await this.gitActions.unstageFile(file);
                            } else {
                                await this.gitActions.unstageAll(
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
                            this.gitActions.addFileToGitignore(
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
                            this.gitActions.addFileToGitignore(
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
        this.repositoryMissing = false;
        this.app.workspace.trigger("obsidian-git:repository-state-changed");

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
        this.gitReady = false;
        this.repositoryMissing = false;
        this.app.workspace.trigger("obsidian-git:repository-state-changed");
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
            this.repositoryMissing = result === "missing-repo";
            if (result === "valid") this.gitReady = true;
            this.app.workspace.trigger("obsidian-git:repository-state-changed");
            const pausedAutomatics = this.localStorage.getPausedAutomatics();
            switch (result) {
                case "missing-git":
                    this.displayError(
                        `Cannot run git command. Trying to run: '${this.localStorage.getGitPath() || "git"}' .`
                    );
                    break;
                case "missing-repo":
                    new Notice(
                        "Cannot find a Git repository. Please create one via the given command, clone an existing repo or configure repo location.",
                        10000
                    );
                    break;
                case "valid":
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
                            this.gitActions.pullChangesFromRemote()
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
