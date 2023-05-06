import { Extension, Prec } from "@codemirror/state";
import { TFile } from "obsidian";
import { subscribeNewEditor } from "src/lineAuthor/control";
import { eventsPerFilePathSingleton } from "src/lineAuthor/eventsPerFilepath";
import {
    LineAuthoring,
    lineAuthoringId,
    LineAuthoringId,
    lineAuthorState,
} from "src/lineAuthor/model";
import { clearViewCache } from "src/lineAuthor/view/cache";
import { lineAuthorGutter } from "src/lineAuthor/view/view";
import ObsidianGit from "src/main";

export { previewColor } from "src/lineAuthor/view/gutter/coloring";
/**
 * * handles changes in git head, filesystem, etc. by initiating computation
 * * Initiates the line authoring computation via
 * <a href="https://git-scm.com/docs/git-blame">git-blame</a>
 * * notifies computation results and settings to subscribers (editors)
 * * deytroys cache and editor-subscribers when plugin is deactivated
 */
export class LineAuthorProvider {
    /**
     * Saves all computed line authoring results.
     *
     * See {@link LineAuthoringId}
     */
    private lineAuthorings: Map<LineAuthoringId, LineAuthoring> = new Map();

    constructor(private plugin: ObsidianGit) {}

    public async trackChanged(file: TFile) {
        this.trackChangedHelper(file).catch((reason) => {
            console.warn("Obsidian Git: Error in trackChanged." + reason);
            return Promise.reject(reason);
        });
    }

    private async trackChangedHelper(file: TFile) {
        if (!file) return;

        if (file.path === undefined) {
            console.warn(
                "Obsidian Git: Attempted to track change of undefined filepath. Unforeseen situation."
            );
            return;
        }

        this.computeLineAuthorInfo(file.path);
    }

    public destroy() {
        this.lineAuthorings.clear();
        eventsPerFilePathSingleton.clear();
        clearViewCache();
    }

    private async computeLineAuthorInfo(filepath: string) {
        const gitManager =
            this.plugin.lineAuthoringFeature.isAvailableOnCurrentPlatform()
                .gitManager;

        const headRevision =
            await gitManager.submoduleAwareHeadRevisonInContainingDirectory(
                filepath
            );

        const fileHash = await gitManager.hashObject(filepath);

        const key = lineAuthoringId(headRevision, fileHash, filepath);

        if (key === undefined) {
            return;
        }

        if (this.lineAuthorings.has(key)) {
            // already computed. just tell the editor to update to the key's state
        } else {
            const gitAuthorResult = await gitManager.blame(
                filepath,
                this.plugin.settings.lineAuthor.followMovement,
                this.plugin.settings.lineAuthor.ignoreWhitespace
            );
            this.lineAuthorings.set(key, gitAuthorResult);
        }

        this.notifyComputationResultToSubscribers(filepath, key);
    }

    private notifyComputationResultToSubscribers(
        filepath: string,
        key: string
    ) {
        eventsPerFilePathSingleton.ifFilepathDefinedTransformSubscribers(
            filepath,
            async (subs) =>
                subs.forEach((sub) =>
                    sub.notifyLineAuthoring(key, this.lineAuthorings.get(key)!)
                )
        );
    }
}

// =========================================================

export const enabledLineAuthorInfoExtensions: Extension = Prec.high([
    subscribeNewEditor,
    lineAuthorState,
    lineAuthorGutter,
]);
