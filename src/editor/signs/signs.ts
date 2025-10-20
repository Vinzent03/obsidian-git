import {
    EditorState,
    StateEffect,
    StateField,
    Transaction,
} from "@codemirror/state";
import { Hunks, type Hunk } from "../signs/hunks";
import { computeHunks } from "./diff";

export abstract class HunksStateHelper {
    static hasHunksData(state: EditorState): boolean {
        const data = state.field(hunksState, false);
        return !!data;
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
            console.log("Getting hunk at pos:", pos);
            return this.getHunkAtPos(state, pos, staged);
        }
        if (state.selection.main.empty) {
            return this.getCursorHunk(state, staged);
        }

        const from = state.selection.main.from;
        const to = state.selection.main.to;
        const fromLine = state.doc.lineAt(from).number;
        const toLineRaw = state.doc.lineAt(to);

        const no_nl_at_eof = !(
            toLineRaw.text.length == 0 && toLineRaw.number == state.doc.lines
        );
        const toLine = no_nl_at_eof ? toLineRaw.number : toLineRaw.number - 1;

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
        } else {
            prev.compareText = undefined;
            prev.compareTextHead = undefined;
            prev.hunks = [];
            prev.stagedHunks = [];
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
