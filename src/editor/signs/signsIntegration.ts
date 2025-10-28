import type { Extension } from "@codemirror/state";
import type { EventRef, WorkspaceLeaf } from "obsidian";
import { MarkdownView, Platform, TFile } from "obsidian";
import { SimpleGit } from "src/gitManager/simpleGit";
import type ObsidianGit from "src/main";
import {
    enabledHunksExtensions,
    enabledSignsExtensions,
    SignsProvider,
} from "./signsProvider";
import { eventsPerFilePathSingleton } from "../eventsPerFilepath";
import { ChangesStatusBar } from "./changesStatusBar";

/**
 * Manages the interaction between Obsidian (file-open event, modification event, etc.)
 * and the signs feature. It also manages the (de-) activation of the
 * signs functionality.
 */
export class SignsFeature {
    private signsProvider?: SignsProvider;
    private workspaceLeafChangeEvent?: EventRef;
    private fileRenameEvent?: EventRef;
    private pluginRefreshedEvent?: EventRef;
    private gutterContextMenuEvent?: EventRef;
    private codeMirrorExtensions: Extension[] = [];
    public changeStatusBar?: ChangesStatusBar;

    constructor(private plg: ObsidianGit) {}

    // ========================= INIT and DE-INIT ==========================

    public onLoadPlugin() {
        this.plg.registerEditorExtension(this.codeMirrorExtensions);
    }

    public conditionallyActivateBySettings() {
        if (
            this.plg.settings.hunks.showSigns ||
            this.plg.settings.hunks.statusBar != "disabled" ||
            this.plg.settings.hunks.hunkCommands
        ) {
            this.activateFeature();
        }
    }

    public activateFeature() {
        try {
            if (!this.isAvailableOnCurrentPlatform().available) return;

            this.signsProvider = new SignsProvider(this.plg);

            this.createEventHandlers();

            this.activateCodeMirrorExtensions();

            if (this.plg.settings.hunks.statusBar != "disabled") {
                const statusBarEl = this.plg.addStatusBarItem();
                this.changeStatusBar = new ChangesStatusBar(
                    statusBarEl,
                    this.plg
                );
            }
        } catch (e) {
            console.warn("Git: Error while loading signs feature.", e);
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

        this.signsProvider?.destroy();
        this.signsProvider = undefined;
        this.changeStatusBar?.remove();
        this.changeStatusBar = undefined;
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

    public refresh() {
        if (this.plg.settings.hunks.showSigns) {
            this.plg.app.workspace.iterateAllLeaves(this.handleWorkspaceLeaf);
        }
    }

    // ========================= CODEMIRROR EXTENSIONS ==========================

    private activateCodeMirrorExtensions() {
        // Yes, we need to directly modify the array and notify the change to have
        // toggleable Codemirror extensions.
        this.codeMirrorExtensions.push(enabledHunksExtensions);
        if (this.plg.settings.hunks.showSigns) {
            this.codeMirrorExtensions.push(enabledSignsExtensions);
        }
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
        this.workspaceLeafChangeEvent = this.createWorkspaceLeafChangeEvent();
        this.fileRenameEvent = this.createFileRenameEvent();
        this.pluginRefreshedEvent = this.createPluginRefreshedEvent();

        this.plg.registerEvent(this.workspaceLeafChangeEvent);
        this.plg.registerEvent(this.fileRenameEvent);
        this.plg.registerEvent(this.pluginRefreshedEvent);
    }

    private destroyEventHandlers() {
        this.plg.app.workspace.offref(this.workspaceLeafChangeEvent!);
        this.plg.app.vault.offref(this.fileRenameEvent!);
        this.plg.app.workspace.offref(this.pluginRefreshedEvent!);
        this.plg.app.workspace.offref(this.gutterContextMenuEvent!);
    }

    private handleWorkspaceLeaf = (leaf: WorkspaceLeaf) => {
        if (!this.signsProvider) {
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

        this.signsProvider.trackChanged(obsView.file).catch(console.error);
    };

    private createWorkspaceLeafChangeEvent(): EventRef {
        return this.plg.app.workspace.on(
            "active-leaf-change",
            this.handleWorkspaceLeaf
        );
    }

    private createFileRenameEvent(): EventRef {
        return this.plg.app.vault.on("rename", (file, _old) => {
            // Notify all subscribers of the old filepath to resubscribe to the new filepath
            eventsPerFilePathSingleton.ifFilepathDefinedTransformSubscribers(
                _old,
                (subs) => {
                    return subs.forEach((las) => {
                        las.changeToNewFilepath(file.path);
                    });
                }
            );
            return (
                file instanceof TFile && this.signsProvider?.trackChanged(file)
            );
        });
    }

    private createPluginRefreshedEvent(): EventRef {
        return this.plg.app.workspace.on("obsidian-git:refreshed", () => {
            this.refresh();
        });
    }

    //TODO do we need this?
    private createHeadChangeEvent(): EventRef {
        return this.plg.app.workspace.on("obsidian-git:head-change", () => {
            this.refresh();
        });
    }
}
