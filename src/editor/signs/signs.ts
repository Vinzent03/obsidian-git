import {
    EditorState,
    StateEffect,
    StateField,
    Transaction,
} from "@codemirror/state";
import { Hunks, type Hunk } from "../signs/hunks";
import { diffLines, structuredPatch } from "diff";
import * as diff from "diff";

export const signsState: StateField<HunksData | undefined> = StateField.define<
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
            if (newCompare || transaction.docChanged) {
                const lineDiff = diffLines(
                    prev.compareText,
                    transaction.newDoc.toString(),
                    {
                        newlineIsToken: true,
                    }
                );
                const lineDiff2 = diffLines(
                    prev.compareText,
                    transaction.newDoc.toString(),
                    {
                        newlineIsToken: false,
                    }
                );
                console.log("lineDiff", lineDiff);
                console.log("lineDiff2", lineDiff2);
                const rawHunks = toRawHunks(lineDiff);
                const rawHunks2 = structuredPatch(
                    "fileA",
                    "fileB",
                    prev.compareText,
                    transaction.newDoc.toString(),
                    "",
                    "",
                    { context: 0 }
                ).hunks;
                console.log("rawHunks", rawHunks);
                // console.log("rawHunks2", rawHunks2);
                // Adjust newStart for hunks which do not add any lines
                // This is more in the style of git diff
                for (const hunk of rawHunks2) {
                    if (hunk.newLines == 0) {
                        hunk.newStart -= 1;
                    }
                }
                const hunks = toHunks(
                    prev.compareText,
                    transaction.newDoc.toString(),
                    rawHunks2
                );
                prev.hunks = hunks;
                console.log("hunks", hunks);
            }
        }
        return prev;
    },
});

type RawHunk = {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
};

function toRawHunks(diff: diff.ChangeObject<string>[]): RawHunk[] {
    diff.push({ value: "", added: false, removed: false, count: 0 }); // Append an empty value to make cleanup easier

    const hunks = [];
    let oldRangeStart = 0,
        newRangeStart = 0,
        oldLine = 1,
        newLine = 1;
    for (let i = 0; i < diff.length; i++) {
        const current = diff[i];
        const lines = splitLines(current.value);

        if (current.added || current.removed) {
            // If we have previous context, start with that
            if (!oldRangeStart) {
                oldRangeStart = oldLine;
                newRangeStart = newLine;
            }

            // Track the updated file position
            if (current.added) {
                newLine += lines.length;
                if (!current.value.endsWith("\n") && i + 2 == diff.length) {
                    newLine += 1;
                }
            } else {
                oldLine += lines.length;
                if (!current.value.endsWith("\n") && i + 2 == diff.length) {
                    oldLine += 1;
                }
            }
        } else {
            if (oldRangeStart) {
                if (current.value.startsWith("\n")) {
                    oldLine += 1;
                    newLine += 1;
                }
                const hunk = {
                    oldStart: oldRangeStart,
                    oldLines: oldLine - oldRangeStart,
                    newStart: newRangeStart,
                    newLines: newLine - newRangeStart,
                };
                hunks.push(hunk);

                oldRangeStart = 0;
                newRangeStart = 0;
                if (current.value.startsWith("\n")) {
                    oldLine += lines.length - 1;
                    newLine += lines.length - 1;
                } else {
                    oldLine += lines.length;
                    newLine += lines.length;
                }
            } else {
                oldLine += lines.length;
                newLine += lines.length;
            }
        }
    }
    return hunks;
}

function splitLines(text: string): string[] {
    const count = text.match(new RegExp(`\n`, "g"))?.length ?? 0;
    return Array<string>(count).fill("");
}

function toHunks(textA: string, textB: string, rawHunks: RawHunk[]): Hunk[] {
    const hunks: Hunk[] = [];
    const linesA = textA.split("\n");
    const linesB = textB.split("\n");
    for (const rawHunk of rawHunks) {
        const { oldStart, oldLines, newStart, newLines } = rawHunk;
        const hunk = Hunks.createHunk(oldStart, oldLines, newStart, newLines);
        if (rawHunk.oldLines > 0) {
            for (let i = oldStart; i < oldStart + oldLines; i++) {
                hunk.removed.lines.push(linesA[i - 1]);
            }
            if (oldStart + oldLines >= linesA.length && linesA.last() != "") {
                hunk.removed.no_nl_at_eof = true;
            }
        }
        if (rawHunk.newLines > 0) {
            for (let i = newStart; i < newStart + newLines; i++) {
                hunk.added.lines.push(linesB[i - 1]);
            }
            if (newStart + newLines >= linesB.length && linesB.last() != "") {
                hunk.added.no_nl_at_eof = true;
            }
        }
        // if (hunk.added.lines.length > hunk.removed.lines.length) {
        //     const solelyChangedLinesCount = hunk.removed.lines.length;
        //     const soleyAddedLinesCount =
        //         hunk.added.lines.length - hunk.removed.lines.length;
        //     const oldRemovedHunk = Hunks.createHunk(
        //         hunk.removed.start,
        //         hunk.removed.lines.length,
        //         hunk.added.start,
        //         solelyChangedLinesCount
        //     );
        //     oldRemovedHunk.removed.lines.push(
        //         ...hunk.removed.lines.slice(0, solelyChangedLinesCount)
        //     );
        //     oldRemovedHunk.added.lines.push(
        //         ...hunk.added.lines.slice(0, solelyChangedLinesCount)
        //     );
        //     oldRemovedHunk.removed.no_nl_at_eof = hunk.removed.no_nl_at_eof;
        //     hunks.push(oldRemovedHunk);
        //     const prevHunk = hunk;
        //
        //     const addedHunk = Hunks.createHunk(
        //         hunk.removed.start + solelyChangedLinesCount,
        //         hunk.removed.lines.length - solelyChangedLinesCount,
        //         hunk.added.start + solelyChangedLinesCount,
        //         hunk.added.lines.length - solelyChangedLinesCount
        //     );
        //     addedHunk.removed.lines = prevHunk.removed.lines.slice(
        //         solelyChangedLinesCount
        //     );
        //     addedHunk.added.lines = prevHunk.added.lines.slice(
        //         solelyChangedLinesCount
        //     );
        //     addedHunk.added.no_nl_at_eof = prevHunk.added.no_nl_at_eof;
        //     hunks.push(addedHunk);
        // } else {
        hunks.push(hunk);
        // }
    }
    return hunks;
}

const GitCompareResultEffectType = StateEffect.define<GitCompareResult>();

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
