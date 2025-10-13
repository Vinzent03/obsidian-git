import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import type { TFile } from "obsidian";
import { eventsPerFilePathSingleton } from "src/editor/eventsPerFilepath";
import { clearViewCache } from "src/editor/lineAuthor/view/cache";
import type ObsidianGit from "src/main";
import { hunksState, type GitCompareResult } from "../signs/signs";
import { signsGutter, signsMarker } from "../signs/gutter";
import { subscribeNewEditor } from "../control";

export { previewColor } from "src/editor/lineAuthor/view/gutter/coloring";
export class SignsProvider {
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

        return this.computeSigns(file.path);
    }

    public destroy() {
        eventsPerFilePathSingleton.clear();
        clearViewCache();
    }

    private async computeSigns(filepath: string) {
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

export const enabledSignsExtensions: Extension = Prec.default([
    subscribeNewEditor,
    hunksState,
    signsGutter,
    signsMarker,
]);
