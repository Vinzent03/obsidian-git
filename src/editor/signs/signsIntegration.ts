import type { Extension } from "@codemirror/state";
import type { EventRef, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { MarkdownView, Platform, TFile } from "obsidian";
import { SimpleGit } from "src/gitManager/simpleGit";
import type ObsidianGit from "src/main";
import { enabledSignsExtensions, SignsProvider } from "./signsProvider";

/**
 * Manages the interaction between Obsidian (file-open event, modification event, etc.)
 * and the signs feature. It also manages the (de-) activation of the
 * signs functionality.
 */
export class SignsFeature {
    private signsProvider?: SignsProvider;
    private fileOpenEvent?: EventRef;
    private workspaceLeafChangeEvent?: EventRef;
    private fileRenameEvent?: EventRef;
    private pluginRefreshedEvent?: EventRef;
    private gutterContextMenuEvent?: EventRef;
    private codeMirrorExtensions: Extension[] = [];

    constructor(private plg: ObsidianGit) {}

    // ========================= INIT and DE-INIT ==========================

    public onLoadPlugin() {
        this.plg.registerEditorExtension(this.codeMirrorExtensions);
    }

    public conditionallyActivateBySettings() {
        if (this.plg.settings.signs.enabled) {
            this.activateFeature();
        }
    }

    public activateFeature() {
        try {
            if (!this.isAvailableOnCurrentPlatform().available) return;

            this.signsProvider = new SignsProvider(this.plg);

            this.createEventHandlers();

            this.activateCodeMirrorExtensions();

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

        this.signsProvider?.destroy();
        this.signsProvider = undefined;
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
        if (this.plg.settings.signs.enabled) {
            this.plg.app.workspace.iterateAllLeaves(this.handleWorkspaceLeaf);
        }
    }

    // ========================= CODEMIRROR EXTENSIONS ==========================

    private activateCodeMirrorExtensions() {
        // Yes, we need to directly modify the array and notify the change to have
        // toggleable Codemirror extensions.
        this.codeMirrorExtensions.push(enabledSignsExtensions);
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
        this.fileOpenEvent = this.createFileOpenEvent();
        this.workspaceLeafChangeEvent = this.createWorkspaceLeafChangeEvent();
        this.fileRenameEvent = this.createFileRenameEvent();
        this.pluginRefreshedEvent = this.createPluginRefreshedEvent();

        this.plg.registerEvent(this.fileOpenEvent);
        this.plg.registerEvent(this.workspaceLeafChangeEvent);
        this.plg.registerEvent(this.fileRenameEvent);
        this.plg.registerEvent(this.pluginRefreshedEvent);
    }

    private destroyEventHandlers() {
        this.plg.app.workspace.offref(this.fileOpenEvent!);
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

    private createFileOpenEvent(): EventRef {
        return this.plg.app.workspace.on(
            "file-open",
            (file: TFile) =>
                void this.signsProvider?.trackChanged(file).catch(console.error)
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
                file instanceof TFile && this.signsProvider?.trackChanged(file)
        );
    }

    private createPluginRefreshedEvent(): EventRef {
        return this.plg.app.workspace.on("obsidian-git:refreshed", () => {
            this.refresh();
        });
    }
}
