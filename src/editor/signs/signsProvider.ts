import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import type { TFile } from "obsidian";
import { eventsPerFilePathSingleton } from "src/editor/eventsPerFilepath";
import type ObsidianGit from "src/main";
import { hunksState, type GitCompareResult } from "../signs/signs";
import { signsGutter, signsMarker } from "../signs/gutter";
import {
    cursorTooltipBaseTheme,
    diffTooltipField,
    selectedHunksState,
} from "./tooltip";
import { unifiedMergeView } from "@codemirror/merge";

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

    public destroy() {}

    private async computeSigns(filepath: string) {
        const gitManager =
            this.plugin.editorIntegration.lineAuthoringFeature.isAvailableOnCurrentPlatform()
                .gitManager;

        // const headRevision =
        //     await gitManager.submoduleAwareHeadRevisonInContainingDirectory(
        //         filepath
        //     );

        const compareText = await gitManager
            .show("", filepath)
            .catch(() => undefined);
        // const compareTextHead = await gitManager
        //     .show(headRevision, filepath)
        //     .catch(() => undefined);
        const compareTextHead = undefined;
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
    diffTooltipField,
    cursorTooltipBaseTheme,
    hunksState,
    signsGutter,
    signsMarker,
    selectedHunksState,
]);
