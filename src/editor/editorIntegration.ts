import type ObsidianGit from "src/main";
import { LineAuthoringFeature } from "./lineAuthor/lineAuthorIntegration";
import { SignsFeature } from "./signs/signsIntegration";
import { subscribeNewEditor } from "./control";

export class EditorIntegration {
    constructor(private plg: ObsidianGit) {}

    lineAuthoringFeature: LineAuthoringFeature = new LineAuthoringFeature(
        this.plg
    );
    signsFeature: SignsFeature = new SignsFeature(this.plg);

    onUnloadPlugin() {
        this.lineAuthoringFeature.deactivateFeature();
        this.signsFeature.deactivateFeature();
    }

    onLoadPlugin() {
        this.plg.registerEditorExtension(subscribeNewEditor);
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
}
