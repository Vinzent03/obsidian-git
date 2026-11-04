import type ObsidianGit from "src/main";
import type { Extension } from "@codemirror/state";
import { LineAuthoringFeature } from "./lineAuthor/lineAuthorIntegration";
import { SignsFeature } from "./signs/signsIntegration";
import { conflictExtensions, conflictResolutionMode } from "./conflicts/view";
import { subscribeNewEditor } from "./control";
import { eventsPerFilePathSingleton } from "./eventsPerFilepath";

export class EditorIntegration {
    constructor(private plg: ObsidianGit) {}

    private conflictEditorExtensions: Extension[] = [];

    lineAuthoringFeature: LineAuthoringFeature = new LineAuthoringFeature(
        this.plg
    );
    signsFeature: SignsFeature = new SignsFeature(this.plg);

    onUnloadPlugin() {
        this.lineAuthoringFeature.deactivateFeature();
        this.signsFeature.deactivateFeature();
        eventsPerFilePathSingleton.clear();
    }

    onLoadPlugin() {
        eventsPerFilePathSingleton.init();
        this.plg.registerEditorExtension(subscribeNewEditor);
        this.conflictEditorExtensions = this.getConflictExtensions();
        this.plg.registerEditorExtension(this.conflictEditorExtensions);
        this.lineAuthoringFeature.onLoadPlugin();
        this.signsFeature.onLoadPlugin();
    }

    onReady() {
        this.lineAuthoringFeature.conditionallyActivateBySettings();
        this.signsFeature.conditionallyActivateBySettings();
    }

    activateLineAuthoring() {
        this.lineAuthoringFeature.activateFeature();
    }
    deactiveLineAuthoring() {
        this.lineAuthoringFeature.deactivateFeature();
    }

    refreshSignsSettings() {
        const hunkSettings = this.plg.settings.hunks;
        if (
            hunkSettings.showSigns ||
            hunkSettings.statusBar != "disabled" ||
            hunkSettings.hunkCommands
        ) {
            this.signsFeature.deactivateFeature();
            this.signsFeature.activateFeature();
        } else {
            this.signsFeature.deactivateFeature();
        }
    }

    refreshConflictSettings() {
        this.conflictEditorExtensions.splice(
            0,
            this.conflictEditorExtensions.length,
            ...this.getConflictExtensions()
        );
        this.plg.app.workspace.updateOptions();
    }

    private getConflictExtensions(): Extension[] {
        const mode = this.plg.settings.conflictResolutionMode;
        return mode === "disabled"
            ? []
            : [conflictResolutionMode.of(mode), conflictExtensions];
    }
}
