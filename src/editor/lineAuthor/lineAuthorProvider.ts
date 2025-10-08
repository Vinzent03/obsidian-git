import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import type { TFile } from "obsidian";
import { subscribeNewEditor } from "src/editor/control";
import { eventsPerFilePathSingleton } from "src/editor/eventsPerFilepath";
import type {
    LineAuthoring,
    LineAuthoringId,
} from "src/editor/lineAuthor/model";
import { lineAuthorState, lineAuthoringId } from "src/editor/lineAuthor/model";
import { clearViewCache } from "src/editor/lineAuthor/view/cache";
import { lineAuthorGutter } from "src/editor/lineAuthor/view/view";
import type ObsidianGit from "src/main";
import { signsState, type GitCompareResult } from "../signs/signs";
import { signsGutter } from "../signs/gutter";

export { previewColor } from "src/editor/lineAuthor/view/gutter/coloring";
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
        return this.trackChangedHelper(file).catch((reason) => {
            console.warn("Git: Error in trackChanged." + reason);
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            return Promise.reject(reason);
        });
    }

    private async trackChangedHelper(file: TFile) {
        if (!file) return;

        if (file.path === undefined) {
            console.warn(
                "Git: Attempted to track change of undefined filepath. Unforeseen situation."
            );
            return;
        }

        return this.computeLineAuthorInfo(file.path);
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

        const compareText = await gitManager.show("", filepath);
        const compareTextHead = await gitManager.show(headRevision, filepath);
        this.notifySignComputationResultToSubscribers(filepath, {
            compareText,
            compareTextHead,
        });

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
            (subs) =>
                subs.forEach((sub) =>
                    sub.notifyLineAuthoring(key, this.lineAuthorings.get(key)!)
                )
        );
    }
    private notifySignComputationResultToSubscribers(
        filepath: string,
        data: GitCompareResult
    ) {
        eventsPerFilePathSingleton.ifFilepathDefinedTransformSubscribers(
            filepath,
            (subs) => subs.forEach((sub) => sub.notifyGitCompare(data))
        );
    }
}

// =========================================================

export const enabledLineAuthorInfoExtensions: Extension = Prec.high([
    subscribeNewEditor,
    lineAuthorState,
    signsState,
    lineAuthorGutter,
    signsGutter,
]);
