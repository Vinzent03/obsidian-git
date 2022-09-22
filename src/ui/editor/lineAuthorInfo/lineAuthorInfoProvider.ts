import { Extension, Prec } from "@codemirror/state";
import { TFile } from "obsidian";
import ObsidianGit from "src/main";
import {
    settingsStateField,
    subscribeNewEditor
} from "src/ui/editor/lineAuthorInfo/control";
import { eventsPerFilePathSingleton } from "src/ui/editor/lineAuthorInfo/eventsPerFilepath";
import {
    LineAuthoring,
    lineAuthoringId,
    LineAuthoringId,
    LineAuthorSettings,
    lineAuthorState,
    settingsFrom
} from "src/ui/editor/lineAuthorInfo/model";
import { clearViewCache, lineAuthorGutter, previewColor as previewColor2 } from "src/ui/editor/lineAuthorInfo/view";
export const previewColor = previewColor2;

/**
 * * handles changes in git head, filesystem, etc. by initiating computation
 * * Initiates the line authoring computation via
 * <a href="https://git-scm.com/docs/git-blame">git-blame</a>
 * * notifies computation results and settings to subscribers (editors)
 * * deytroys cache and editor-subscribers when plugin is deactivated
*/
export class LineAuthorInfoProvider {
    /**
     * Saves all computed line authoring results.
     * 
     * See {@link LineAuthoringId}
     */
    private lineAuthorings: Map<LineAuthoringId, LineAuthoring> = new Map();

    constructor(private plugin: ObsidianGit) { }

    public async trackChanged(file: TFile) {
        this.trackChangedHelper(file)
            .catch(reason => {
                console.warn("Obsidian Git: Error in trackChanged." + reason);
                return Promise.reject(reason);
            });
    }

    private async trackChangedHelper(file: TFile) {
        if (!file) return;

        if (file.path === undefined) {
            console.warn("Obsidian Git: Attempted to track change of undefined filepath. Unforeseen situation.");
            return;
        }

        this.notifySettingsToSubscribers(settingsFrom(this.plugin.settings));

        this.computeLineAuthorInfo(file.path);
    }

    public destroy() {
        this.lineAuthorings.clear();
        eventsPerFilePathSingleton.clear();
        clearViewCache();
    }

    private async computeLineAuthorInfo(filepath: string) {
        const gitManager = this.plugin.lineAuthoringFeature.isAvailableOnCurrentPlatform().gitManager;

        const headRevision = await gitManager.headRevision();

        const fileHash = await gitManager.hashObject(filepath);

        const key = lineAuthoringId(headRevision, fileHash, filepath);

        if (key === undefined) {
            return;
        }

        if (this.lineAuthorings.has(key)) {
            // already computed. just tell the editor to update to the key's state
        } else {
            const gitAuthorResult = await gitManager.blame(filepath, this.plugin.settings.followMovementLineAuthorInfo);
            this.lineAuthorings.set(key, gitAuthorResult);
        }

        this.notifyComputationResultToSubscribers(filepath, key);
    }

    private notifyComputationResultToSubscribers(filepath: string, key: string) {
        eventsPerFilePathSingleton.ifFilepathDefinedTransformSubscribers(filepath, async (subs) =>
            subs.forEach((sub) =>
                sub.notifyLineAuthoring(key, this.lineAuthorings.get(key)!)
            )
        );
    }

    private notifySettingsToSubscribers(settings: LineAuthorSettings) {
        eventsPerFilePathSingleton.forEachSubscriber(async (las) => las.notifySettings(settings));
    }
}

// =========================================================

export const enabledLineAuthorInfoExtensions: Extension = Prec.high([
    subscribeNewEditor,
    settingsStateField,
    lineAuthorState,
    lineAuthorGutter,
]);
