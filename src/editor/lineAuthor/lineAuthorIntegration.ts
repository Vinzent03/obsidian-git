import type { Extension } from "@codemirror/state";
import type { EventRef, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { MarkdownView, Platform, TFile } from "obsidian";
import { SimpleGit } from "src/gitManager/simpleGit";
import {
    LineAuthorProvider,
    enabledLineAuthorInfoExtensions,
} from "./lineAuthorProvider";
import type { LineAuthorSettings } from "./model";
import { provideSettingsAccess } from "./model";
import { handleContextMenu } from "./view/contextMenu";
import { setTextColorCssBasedOnSetting } from "./view/gutter/coloring";
import { prepareGutterSearchForContextMenuHandling } from "./view/gutter/gutterElementSearch";
import type ObsidianGit from "src/main";
import { LineAuthorStatusBar } from "./lineAuthorStatusBar";

/**
 * Manages the interaction between Obsidian (file-open event, modification event, etc.)
 * and the line authoring feature. It also manages the (de-) activation of the
 * line authoring functionality.
 */
export class LineAuthoringFeature {
    private lineAuthorInfoProvider?: LineAuthorProvider;
    private fileOpenEvent?: EventRef;
    private workspaceLeafChangeEvent?: EventRef;
    private fileModificationEvent?: EventRef;
    private headChangeEvent?: EventRef;
    private refreshOnCssChangeEvent?: EventRef;
    private fileRenameEvent?: EventRef;
    private gutterContextMenuEvent?: EventRef;
    private codeMirrorExtensions: Extension[] = [];
    public lineAuthorStatusBar?: LineAuthorStatusBar;

    constructor(private plg: ObsidianGit) {}

    // ========================= INIT and DE-INIT ==========================

    public onLoadPlugin() {
        this.plg.registerEditorExtension(this.codeMirrorExtensions);
        provideSettingsAccess(
            () => this.plg.settings.lineAuthor,
            (laSettings: LineAuthorSettings) => {
                this.plg.settings.lineAuthor = laSettings;
                void this.plg.saveSettings();
            }
        );
    }

    public conditionallyActivateBySettings() {
        if (this.plg.settings.lineAuthor.show) {
            this.activateFeature();
        }
    }

    public activateFeature() {
        try {
            if (!this.isAvailableOnCurrentPlatform().available) return;

            const displayLocation =
                this.plg.settings.lineAuthor.displayLocation ?? "gutter";

            setTextColorCssBasedOnSetting(this.plg.settings.lineAuthor);

            this.lineAuthorInfoProvider = new LineAuthorProvider(this.plg);

            this.createEventHandlers();

            // Always activate CodeMirror extensions (needed for status bar to read state)
            this.activateCodeMirrorExtensions();

            // Hide gutter if displayLocation is "status-bar" only
            if (displayLocation === "status-bar") {
                document.body.addClass("git-line-author-hide-gutter");
            } else {
                document.body.removeClass("git-line-author-hide-gutter");
            }

            // Create status bar if displayLocation is "status-bar" or "both"
            if (
                displayLocation === "status-bar" ||
                displayLocation === "both"
            ) {
                const statusBarEl = this.plg.addStatusBarItem();
                this.lineAuthorStatusBar = new LineAuthorStatusBar(
                    statusBarEl,
                    this.plg
                );
            }

            console.log(this.plg.manifest.name + ": Enabled line authoring.");
        } catch (e) {
            console.warn("Git: Error while loading line authoring feature.", e);
            this.deactivateFeature();
        }
    }

    /**
     * Deactivates the feature. This function is very defensive, as it is also
     * called to cleanup, if a critical error in the line authoring has occurred.
     */
    public deactivateFeature() {
        this.destroyEventHandlers();

        this.deactivateCodeMirrorExtensions();

        this.lineAuthorInfoProvider?.destroy();
        this.lineAuthorInfoProvider = undefined;

        this.lineAuthorStatusBar?.remove();
        this.lineAuthorStatusBar = undefined;

        document.body.removeClass("git-line-author-hide-gutter");

        console.log(this.plg.manifest.name + ": Disabled line authoring.");
    }

    public isAvailableOnCurrentPlatform(): {
        available: boolean;
        gitManager: SimpleGit;
    } {
        return {
            available: this.plg.useSimpleGit && Platform.isDesktopApp,
            gitManager:
                this.plg.gitManager instanceof SimpleGit
                    ? this.plg.gitManager
                    : undefined!,
        };
    }

    // ========================= REFRESH ==========================

    public refreshLineAuthorViews() {
        if (this.plg.settings.lineAuthor.show) {
            this.deactivateFeature();
            this.activateFeature();
        }
    }

    // ========================= CODEMIRROR EXTENSIONS ==========================

    private activateCodeMirrorExtensions() {
        // Yes, we need to directly modify the array and notify the change to have
        // toggleable Codemirror extensions.
        this.codeMirrorExtensions.push(enabledLineAuthorInfoExtensions);
        this.plg.app.workspace.updateOptions();

        // Handle all already opened files
        this.plg.app.workspace.iterateAllLeaves(this.handleWorkspaceLeaf);
    }

    private deactivateCodeMirrorExtensions() {
        // Yes, we need to directly modify the array and notify the change to have
        // toggleable Codemirror extensions.
        for (const ext of this.codeMirrorExtensions) {
            this.codeMirrorExtensions.remove(ext);
        }
        this.plg.app.workspace.updateOptions();
    }

    // ========================= HANDLERS ==========================

    private createEventHandlers() {
        this.gutterContextMenuEvent = this.createGutterContextMenuHandler();
        this.fileOpenEvent = this.createFileOpenEvent();
        this.workspaceLeafChangeEvent = this.createWorkspaceLeafChangeEvent();
        this.fileModificationEvent = this.createVaultFileModificationHandler();
        this.headChangeEvent = this.createHeadChangeEvent();
        this.refreshOnCssChangeEvent = this.createCssRefreshHandler();
        this.fileRenameEvent = this.createFileRenameEvent();

        prepareGutterSearchForContextMenuHandling();

        this.plg.registerEvent(this.gutterContextMenuEvent);
        this.plg.registerEvent(this.refreshOnCssChangeEvent);
        this.plg.registerEvent(this.fileOpenEvent);
        this.plg.registerEvent(this.workspaceLeafChangeEvent);
        this.plg.registerEvent(this.fileModificationEvent);
        this.plg.registerEvent(this.headChangeEvent);
        this.plg.registerEvent(this.fileRenameEvent);
    }

    private destroyEventHandlers() {
        this.plg.app.workspace.offref(this.gutterContextMenuEvent!);
        this.plg.app.workspace.offref(this.refreshOnCssChangeEvent!);
        this.plg.app.workspace.offref(this.fileOpenEvent!);
        this.plg.app.workspace.offref(this.workspaceLeafChangeEvent!);
        this.plg.app.workspace.offref(this.refreshOnCssChangeEvent!);
        this.plg.app.vault.offref(this.fileModificationEvent!);
        this.plg.app.workspace.offref(this.headChangeEvent!);
        this.plg.app.vault.offref(this.fileRenameEvent!);
    }

    private handleWorkspaceLeaf = (leaf: WorkspaceLeaf) => {
        if (!this.lineAuthorInfoProvider) {
            console.warn(
                "Git: undefined lineAuthorInfoProvider. Unexpected situation."
            );
            return;
        }
        const obsView = leaf?.view;

        if (
            !(obsView instanceof MarkdownView) ||
            obsView.file == null ||
            obsView?.allowNoFile === true
        )
            return;

        this.lineAuthorInfoProvider
            .trackChanged(obsView.file)
            .catch(console.error);
    };

    private createFileOpenEvent(): EventRef {
        return this.plg.app.workspace.on(
            "file-open",
            (file: TFile) =>
                void this.lineAuthorInfoProvider
                    ?.trackChanged(file)
                    .catch(console.error)
        );
    }

    private createWorkspaceLeafChangeEvent(): EventRef {
        return this.plg.app.workspace.on(
            "active-leaf-change",
            this.handleWorkspaceLeaf
        );
    }

    private createFileRenameEvent(): EventRef {
        return this.plg.app.vault.on(
            "rename",
            (file, _old) =>
                file instanceof TFile &&
                this.lineAuthorInfoProvider?.trackChanged(file)
        );
    }

    private createVaultFileModificationHandler() {
        return this.plg.app.vault.on(
            "modify",
            (anyPath: TAbstractFile) =>
                anyPath instanceof TFile &&
                this.lineAuthorInfoProvider?.trackChanged(anyPath)
        );
    }

    private createHeadChangeEvent(): EventRef {
        return this.plg.app.workspace.on("obsidian-git:head-change", () => {
            this.refreshLineAuthorViews();
        });
    }

    private createCssRefreshHandler(): EventRef {
        return this.plg.app.workspace.on("css-change", () =>
            this.refreshLineAuthorViews()
        );
    }

    private createGutterContextMenuHandler() {
        return this.plg.app.workspace.on("editor-menu", handleContextMenu);
    }
}
