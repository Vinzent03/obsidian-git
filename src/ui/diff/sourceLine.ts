import type { Chunk } from "@codemirror/merge";
import type { Text } from "@codemirror/state";
import { rawHunkFromChunk } from "src/editor/signs/diff";

export type DiffHunkRanges = {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
};

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiffHunks(diff: string): DiffHunkRanges[] {
    const hunks: DiffHunkRanges[] = [];
    let current: DiffHunkRanges | undefined;
    let oldLine = 0;
    let newLine = 0;
    let inHunk = false;

    const flush = () => {
        if (current) hunks.push(current);
        current = undefined;
    };

    for (const line of diff.split("\n")) {
        const header = HUNK_HEADER.exec(line);
        if (header) {
            flush();
            inHunk = true;
            oldLine = Number(header[1]);
            newLine = Number(header[3]);
            continue;
        }
        if (!inHunk) continue;
        if (line.startsWith("diff ")) {
            flush();
            inHunk = false;
            continue;
        }
        if (line.startsWith("\\")) continue;
        if (line.startsWith(" ")) {
            flush();
            oldLine += 1;
            newLine += 1;
            continue;
        }
        if (line.startsWith("-")) {
            current ??= {
                oldStart: oldLine,
                oldLines: 0,
                newStart: newLine,
                newLines: 0,
            };
            current.oldLines += 1;
            oldLine += 1;
            continue;
        }
        if (line.startsWith("+")) {
            current ??= {
                oldStart: oldLine,
                oldLines: 0,
                newStart: newLine,
                newLines: 0,
            };
            current.newLines += 1;
            newLine += 1;
        }
    }
    flush();

    return hunks.sort((a, b) => a.oldStart - b.oldStart);
}

export function hunksFromChunks(
    chunks: readonly Chunk[],
    aDoc: Text,
    bDoc: Text
): DiffHunkRanges[] {
    return chunks
        .map((chunk) => rawHunkFromChunk(chunk, aDoc, bDoc))
        .map((hunk) => ({
            oldStart: hunk.oldStart,
            oldLines: hunk.oldLines,
            newStart: hunk.newStart,
            newLines: hunk.newLines,
        }))
        .sort((a, b) => a.oldStart - b.oldStart);
}

export function mapOldLineToNewLine(
    oldLine: number,
    hunks: readonly DiffHunkRanges[],
    newLineCount?: number
): number {
    if (!Number.isInteger(oldLine) || oldLine < 1) return oldLine;

    let mapped = oldLine;
    for (const hunk of hunks) {
        if (hunk.oldLines === 0) {
            if (oldLine > hunk.oldStart) mapped += hunk.newLines;
            continue;
        }

        const oldEnd = hunk.oldStart + hunk.oldLines - 1;
        if (oldLine < hunk.oldStart) break;

        if (oldLine <= oldEnd) {
            mapped =
                hunk.newLines === 0
                    ? hunk.newStart + 1
                    : hunk.newStart +
                      Math.min(oldLine - hunk.oldStart, hunk.newLines - 1);
            if (newLineCount !== undefined) {
                mapped = Math.min(mapped, newLineCount);
            }
            return Math.max(1, mapped);
        }

        mapped += hunk.newLines - hunk.oldLines;
    }

    if (newLineCount !== undefined) mapped = Math.min(mapped, newLineCount);
    return Math.max(1, mapped);
}

export function sourceLineForDiffSide(
    side: "a" | "b",
    line: number,
    hunks: readonly DiffHunkRanges[],
    newLineCount?: number
): number {
    if (side === "a") {
        return mapOldLineToNewLine(line, hunks, newLineCount);
    }
    if (newLineCount !== undefined) return Math.min(line, newLineCount);
    return line;
}
