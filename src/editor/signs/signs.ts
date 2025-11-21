import {
    ChangeDesc,
    EditorState,
    StateEffect,
    StateField,
    Text,
    Transaction,
} from "@codemirror/state";
import { Hunks, type Hunk } from "../signs/hunks";
import { computeHunks } from "./diff";
import type { Chunk } from "@codemirror/merge";
import { pluginRef } from "src/pluginGlobalRef";
import {
    debounce,
    editorEditorField,
    editorInfoField,
    type Debouncer,
} from "obsidian";

/**
 * Given a document and a position, return the corresponding line number in the
 * file.
 */
export function lineFromPos(doc: Text, pos: number): number {
    const lineData = doc.lineAt(pos);
    const no_nl_at_eof = !(
        lineData.text.length == 0 && lineData.number == doc.lines
    );
    const fileLine = no_nl_at_eof ? lineData.number : lineData.number - 1;
    return fileLine;
}

export abstract class HunksStateHelper {
    static hasHunksData(state: EditorState): boolean {
        const data = state.field(hunksState, false);
        return !!data && !data.isDirty;
    }

    static getHunks(state: EditorState, staged: boolean): Hunk[] {
        const data = state.field(hunksState);
        if (!data) return [];
        return staged ? data.stagedHunks : data.hunks;
    }

    static getHunkAtPos(
        state: EditorState,
        pos: number,
        staged: boolean
    ): Hunk | undefined {
        const data = state.field(hunksState);
        if (!data) return undefined;
        const line = state.doc.lineAt(pos).number;

        const hunks = this.getHunks(state, staged);
        return Hunks.findHunk(line, hunks)[0];
    }

    static getCursorHunk(
        state: EditorState,
        staged: boolean
    ): Hunk | undefined {
        const data = state.field(hunksState);
        if (!data) return undefined;
        const cursorLine = state.selection.main.head;
        return this.getHunkAtPos(state, cursorLine, staged);
    }

    static getHunk(
        state: EditorState,
        staged: boolean,
        pos?: number
    ): Hunk | undefined {
        if (pos != undefined) {
            return this.getHunkAtPos(state, pos, staged);
        }
        if (state.selection.main.empty) {
            return this.getCursorHunk(state, staged);
        }

        const from = state.selection.main.from;
        const to = state.selection.main.to;
        const fromLine = state.doc.lineAt(from).number;
        const toLine = lineFromPos(state.doc, to);

        const hunks = this.getHunks(state, staged);
        const hunk = Hunks.createPartialHunk(hunks, fromLine, toLine);
        if (!hunk) {
            return undefined;
        }

        const data = state.field(hunksState)!;

        if (staged) {
            let stagedTop = fromLine;
            let stagedBot = toLine;
            for (const h of data.hunks) {
                if (fromLine > h.vend) {
                    stagedTop = stagedTop - (h.added.count - h.removed.count);
                }
                if (toLine > h.vend) {
                    stagedBot = stagedBot - (h.added.count - h.removed.count);
                }
            }
            hunk.added.lines = data
                .compareText!.split("\n")
                .slice(stagedTop - 1, stagedBot);
            if (data.compareTextHead) {
                hunk.removed.lines = data.compareTextHead
                    .split("\n")
                    .slice(
                        hunk.removed.start - 1,
                        hunk.removed.start - 1 + hunk.removed.count
                    );
            } else {
                hunk.removed.lines = [];
            }
        } else {
            hunk.added.lines = state.doc
                .toString()
                .split("\n")
                .slice(fromLine - 1, toLine);
            const no_nl_at_eof =
                toLine === state.doc.lines &&
                !state.doc.toString().endsWith("\n");
            if (no_nl_at_eof) {
                hunk.added.no_nl_at_eof = true;
            }
            hunk.removed.lines = data
                .compareText!.split("\n")
                .slice(
                    hunk.removed.start - 1,
                    hunk.removed.start - 1 + hunk.removed.count
                );
            if (
                hunk.removed.start + hunk.removed.count - 1 ===
                    data.compareText!.split("\n").length &&
                !data.compareText!.endsWith("\n")
            ) {
                hunk.removed.no_nl_at_eof = true;
            }
        }
        return hunk;
    }
}

export const hunksState: StateField<HunksData | undefined> = StateField.define<
    HunksData | undefined
>({
    create: (_state) => undefined,
    update: (previous, transaction) => {
        const hunksData: HunksData = previous
            ? { ...previous }
            : {
                  maxDiffTimeMs: 0,
                  hunks: [],
                  stagedHunks: [],
                  chunks: undefined,
                  isDirty: false,
              };
        let newCompare = false;

        for (const effect of transaction.effects) {
            if (effect.is(GitCompareResultEffectType)) {
                hunksData.compareText = effect.value.compareText;
                hunksData.compareTextHead = effect.value.compareTextHead;

                // Only issue new hunk computation if compareText has changed
                newCompare = previous?.compareText !== effect.value.compareText;
                if (newCompare) {
                    hunksData.chunks = undefined;
                }
            }
            if (effect.is(DebouncedComputeHunksEffectType)) {
                applyHunkComputation(
                    hunksData,
                    effect.value,
                    transaction.state
                );
            }
        }
        if (hunksData.compareText !== undefined) {
            if (newCompare || transaction.docChanged) {
                hunksData.isDirty = true;
                const res = scheduleHunkComputation(
                    transaction,
                    hunksData.compareText,
                    hunksData.chunks,
                    hunksData.maxDiffTimeMs
                );
                if (res) {
                    applyHunkComputation(hunksData, res, transaction.state);
                }
            }
        } else {
            hunksData.compareText = undefined;
            hunksData.compareTextHead = undefined;
            hunksData.chunks = undefined;
            hunksData.hunks = [];
            hunksData.stagedHunks = [];
            hunksData.isDirty = false;
        }
        return hunksData;
    },
});

function applyHunkComputation(
    hunkData: HunksData,
    computeData: ComputedHunksData,
    state: EditorState
) {
    hunkData.hunks = computeData.hunks;
    hunkData.chunks = computeData.chunks;
    hunkData.isDirty = false;
    hunkData.maxDiffTimeMs = Math.max(
        0.95 * hunkData.maxDiffTimeMs,
        computeData.diffDuration
    );
    const file = state.field(editorInfoField).file;
    pluginRef.plugin?.editorIntegration.signsFeature.changeStatusBar?.display(
        hunkData.hunks,
        file
    );
}

export const computeHunksDebouncerStateField = StateField.define<{
    changeDesc?: ChangeDesc;
    debouncer: Debouncer<
        [
            {
                state: EditorState;
                compareText: string;
                previousChunks: readonly Chunk[] | undefined;
                changeDesc: ChangeDesc | undefined;
            },
        ],
        void
    >;
}>({
    create: () => {
        return {
            debouncer: debounce(
                (data) => {
                    const { state, compareText, previousChunks, changeDesc } =
                        data;
                    const res = computeHunksTimed(
                        state,
                        compareText,
                        previousChunks,
                        changeDesc
                    );
                    state.field(editorEditorField).dispatch({
                        effects: DebouncedComputeHunksEffectType.of(res),
                    });
                },
                1000,
                true
            ),
            maxDiffTimeMs: 0,
        };
    },
    update: (data, transaction) => {
        for (const effect of transaction.effects) {
            if (effect.is(DebouncedComputeHunksEffectType)) {
                data.changeDesc = undefined;
                return data;
            }
        }
        if (!data.changeDesc && transaction.changes) {
            data.changeDesc = transaction.changes;
        } else {
            data.changeDesc = data.changeDesc?.composeDesc(transaction.changes);
        }
        return data;
    },
});

function computeHunksTimed(
    state: EditorState,
    compareText: string,
    previousChunks: readonly Chunk[] | undefined,
    changeDesc: ChangeDesc | undefined
): ComputedHunksData {
    const editorText = state.doc.toString();

    const startTime = performance.now();
    const { hunks, chunks } = computeHunks(
        compareText,
        editorText,
        previousChunks,
        changeDesc
    );
    const diffDuration = performance.now() - startTime;
    return { hunks, chunks, diffDuration };
}

function scheduleHunkComputation(
    transaction: Transaction,
    compareText: string,
    previousChunks: readonly Chunk[] | undefined,
    maxDiffTimeMs: number
): ComputedHunksData | undefined {
    const state = transaction.state;
    const changeLength = Math.abs(
        transaction.changes.length - transaction.changes.newLength
    );

    const debouncerField = state.field(computeHunksDebouncerStateField);

    // Debounce large changes or if a previous diff took long time
    if (changeLength > 1000 || maxDiffTimeMs > 16) {
        debouncerField.debouncer({
            state,
            compareText,
            previousChunks,
            changeDesc: debouncerField.changeDesc,
        });
    } else {
        // This technically breaks the immutability of the StateField, but I
        // think it's acceptable here. The debouncer itself is not very
        // immutable either way.
        debouncerField.changeDesc = undefined;

        return computeHunksTimed(
            state,
            compareText,
            previousChunks,
            transaction.changes
        );
    }
}

export const GitCompareResultEffectType =
    StateEffect.define<GitCompareResult>();

export const DebouncedComputeHunksEffectType =
    StateEffect.define<ComputedHunksData>();

export type ComputedHunksData = {
    hunks: Hunk[];
    chunks: readonly Chunk[] | undefined;
    diffDuration: number;
};

export type HunksData = {
    hunks: Hunk[];
    stagedHunks: Hunk[];
    chunks: readonly Chunk[] | undefined;
    isDirty: boolean;
    maxDiffTimeMs: number;
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
