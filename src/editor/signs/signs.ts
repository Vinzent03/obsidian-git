import {
    EditorState,
    StateEffect,
    StateField,
    Transaction,
} from "@codemirror/state";
import { Hunks, type Hunk } from "../signs/hunks";
import { computeHunks } from "./diff";

export const hunksState: StateField<HunksData | undefined> = StateField.define<
    HunksData | undefined
>({
    create: (_state) => undefined,
    update: (previous, transaction) => {
        const prev: HunksData = previous
            ? { ...previous }
            : {
                  hunks: [],
                  stagedHunks: [],
              };
        let newCompare = false;

        for (const effect of transaction.effects) {
            if (effect.is(GitCompareResultEffectType)) {
                newCompare = true;
                prev.compareText = effect.value.compareText;
                prev.compareTextHead = effect.value.compareTextHead;
            }
        }
        if (prev.compareText) {
            const editorText = transaction.state.doc.toString();
            if (newCompare || transaction.docChanged) {
                const hunks = computeHunks(prev.compareText, editorText);
                const headHunks = computeHunks(
                    prev.compareTextHead ?? "",
                    editorText
                );
                prev.hunks = hunks;
                prev.stagedHunks = Hunks.filterCommon(headHunks, hunks)!;
            }
        }
        return prev;
    },
});

export const GitCompareResultEffectType =
    StateEffect.define<GitCompareResult>();

export type HunksData = {
    hunks: Hunk[];
    stagedHunks: Hunk[];
} & GitCompareResult;

export type GitCompareResult = {
    compareText?: string;
    compareTextHead?: string;
};

export function newGitCompareResultAsTransaction(
    data: GitCompareResult,
    state: EditorState
): Transaction {
    return state.update({
        effects: GitCompareResultEffectType.of(data),
    });
}
