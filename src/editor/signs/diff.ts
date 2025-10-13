import { Hunks, type Hunk } from "../signs/hunks";
import { makeDiff, cleanupSemantic } from "@sanity/diff-match-patch";
import * as diff from "diff";
import { charsToLines, linesToChars } from "./diffMatchPatchHelper";

function diffMatchPatch(
    text1: string,
    text2: string
): diff.ChangeObject<string>[] {
    const toChars = linesToChars(text1, text2);
    const lineText1 = toChars.chars1;
    const lineText2 = toChars.chars2;
    const lineArray = toChars.lineArray;
    let diffs = makeDiff(lineText1, lineText2, {
        checkLines: false,
    });
    diffs = cleanupSemantic(diffs);
    charsToLines(diffs, lineArray);
    const res: diff.ChangeObject<string>[] = [];
    for (let i = 0; i < diffs.length; i++) {
        res.push({
            added: diffs[i][0] == 1 ? true : false,
            removed: diffs[i][0] == -1 ? true : false,
            value: diffs[i][1],
            count: diffs[i][1].split("\n").length - 1,
        });
    }

    return res;
}

type RawHunk = {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
};
export interface ChangeObject {
    /**
     * The concatenated content of all the tokens represented by this change object - i.e. generally the text that is either added, deleted, or common, as a single string.
     * In cases where tokens are considered common but are non-identical (e.g. because an option like `ignoreCase` or a custom `comparator` was used), the value from the *new* string will be provided here.
     */
    value: string;
    /**
     * true if the value was inserted into the new string, otherwise false
     */
    added: boolean;
    /**
     * true if the value was removed from the old string, otherwise false
     */
    removed: boolean;
}

function changesToRawHunks(diff: ChangeObject[]): RawHunk[] {
    diff.push({ value: "", added: false, removed: false }); // Append an empty value to make cleanup easier

    const hunks = [];
    let oldRangeStart = 0,
        newRangeStart = 0,
        oldLine = 1,
        newLine = 1;
    for (let i = 0; i < diff.length; i++) {
        const current = diff[i];
        const linesCount =
            current.value.match(new RegExp(`\n`, "g"))?.length ?? 0;

        if (current.added || current.removed) {
            // If we have previous context, start with that
            if (!oldRangeStart) {
                oldRangeStart = oldLine;
                newRangeStart = newLine;
            }

            // Track the updated file position
            if (current.added) {
                newLine += linesCount;
                if (!current.value.endsWith("\n") && i + 2 == diff.length) {
                    newLine += 1;
                }
            } else {
                oldLine += linesCount;
                if (!current.value.endsWith("\n") && i + 3 == diff.length) {
                    oldLine += 1;
                }
            }
        } else {
            if (oldRangeStart) {
                // if (current.value.startsWith("\n")) {
                // }
                const hunk = {
                    oldStart: oldRangeStart,
                    oldLines: oldLine - oldRangeStart,
                    newStart: newRangeStart,
                    newLines: newLine - newRangeStart,
                };
                hunks.push(hunk);

                // oldLine += 1;
                // newLine += 1;
                oldRangeStart = 0;
                newRangeStart = 0;
                // if (current.value.startsWith("\n")) {
                //     oldLine += linesCount - 1;
                //     newLine += linesCount - 1;
                // } else {
                oldLine += linesCount;
                newLine += linesCount;
                /* } */
            } else {
                oldLine += linesCount;
                newLine += linesCount;
            }
        }
    }
    return hunks;
}

export function rawHunksToHunks(
    textA: string,
    textB: string,
    rawHunks: RawHunk[]
): Hunk[] {
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
        hunks.push(hunk);
    }
    return hunks;
}

export function computeHunks(textA: string, textB: string): Hunk[] {
    // const lineDiff = diff.diffLines(textA, textB, {
    //     newlineIsToken: true,
    // });
    // const lineDiff2 = diffLines(
    //     prev.compareText,
    //     transaction.newDoc.toString(),
    //     {
    //         newlineIsToken: false,
    //     }
    // );
    // console.log("lineDiff", lineDiff);
    // console.log("lineDiff2", lineDiff2);
    // const rawHunks = toRawHunks(lineDiff);
    // const rawHunks2 = structuredPatch(
    //     "fileA",
    //     "fileB",
    //     prev.compareText,
    //     transaction.newDoc.toString(),
    //     "",
    //     "",
    //     { context: 0 }
    // ).hunks;
    const linediff2 = diffMatchPatch(textA, textB);
    const rawHunks = changesToRawHunks(linediff2);
    // console.log("rawHunks", rawHunks);
    // console.log("rawHunks3", rawHunks3);
    // console.log("rawHunks2", rawHunks2);
    // Adjust newStart for hunks which do not add any lines
    // This is more in the style of git diff
    for (const hunk of rawHunks) {
        if (hunk.newLines == 0) {
            hunk.newStart -= 1;
        }
    }
    // console.log("linediff2", linediff2);
    // console.log("rawHunks", rawHunks);
    const hunks = rawHunksToHunks(textA, textB, rawHunks);
    // console.log("hunks", hunks);
    return hunks;
}
