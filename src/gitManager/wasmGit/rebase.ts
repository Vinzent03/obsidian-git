import type { MergeStrategy } from "../../types";
import type { ParsedCommitObject, ParsedNameStatusEntry } from "./parsers";
import { resolveConflictMarkers } from "./parsers";

export class RebaseConflictError extends Error {
    constructor(public readonly conflicted: string[]) {
        super(
            `You have conflicts in ${conflicted.length} ${
                conflicted.length === 1 ? "file" : "files"
            }`
        );
    }
}

/**
 * Filesystem and git primitives the rebase replay needs. Callers keep
 * these on one already-synced in-memory repository so rebase does not
 * bounce through vault I/O between commits.
 */
export interface RebaseHost {
    listCommits(range: string): Promise<string[]>;
    readCommit(hash: string): Promise<ParsedCommitObject | undefined>;
    nameStatus(from: string, to: string): Promise<ParsedNameStatusEntry[]>;
    readBlob(rev: string, path: string): Promise<string | undefined>;
    readWorktree(path: string): string | undefined;
    writeWorktree(path: string, content: string): void;
    unlinkWorktree(path: string): void;
    resetHard(rev: string): Promise<void>;
    add(paths: string[]): Promise<void>;
    commit(message: string): Promise<void>;
}

/**
 * Line-based three-way merge. Identical sides or a one-sided edit are
 * taken as-is; overlapping edits become standard conflict markers.
 */
export function merge3(
    base: string,
    ours: string,
    theirs: string
): { content: string; conflicted: boolean } {
    if (ours === theirs) return { content: ours, conflicted: false };
    if (ours === base) return { content: theirs, conflicted: false };
    if (theirs === base) return { content: ours, conflicted: false };

    const baseLines = toLines(base);
    const oursLines = toLines(ours);
    const theirsLines = toLines(theirs);
    const oursHunks = diffHunks(baseLines, oursLines);
    const theirsHunks = diffHunks(baseLines, theirsLines);

    const result: string[] = [];
    let conflicted = false;
    let basePos = 0;
    let oursIdx = 0;
    let theirsIdx = 0;

    while (oursIdx < oursHunks.length || theirsIdx < theirsHunks.length) {
        const oursHunk = oursHunks[oursIdx];
        const theirsHunk = theirsHunks[theirsIdx];
        if (
            oursHunk &&
            (!theirsHunk || oursHunk.baseStart < theirsHunk.baseStart)
        ) {
            if (theirsHunk && hunksOverlap(oursHunk, theirsHunk)) {
                const group = takeOverlapping(
                    oursHunks,
                    theirsHunks,
                    oursIdx,
                    theirsIdx
                );
                copySlice(result, baseLines, basePos, group.baseStart);
                result.push(
                    ...conflictBlock(group.oursLines, group.theirsLines)
                );
                basePos = group.baseEnd;
                oursIdx = group.nextOurs;
                theirsIdx = group.nextTheirs;
                conflicted = true;
                continue;
            }
            copySlice(result, baseLines, basePos, oursHunk.baseStart);
            result.push(...oursHunk.lines);
            basePos = oursHunk.baseEnd;
            oursIdx += 1;
            continue;
        }
        if (
            theirsHunk &&
            (!oursHunk || theirsHunk.baseStart < oursHunk.baseStart)
        ) {
            if (oursHunk && hunksOverlap(theirsHunk, oursHunk)) {
                const group = takeOverlapping(
                    oursHunks,
                    theirsHunks,
                    oursIdx,
                    theirsIdx
                );
                copySlice(result, baseLines, basePos, group.baseStart);
                result.push(
                    ...conflictBlock(group.oursLines, group.theirsLines)
                );
                basePos = group.baseEnd;
                oursIdx = group.nextOurs;
                theirsIdx = group.nextTheirs;
                conflicted = true;
                continue;
            }
            copySlice(result, baseLines, basePos, theirsHunk.baseStart);
            result.push(...theirsHunk.lines);
            basePos = theirsHunk.baseEnd;
            theirsIdx += 1;
            continue;
        }
        if (
            oursHunk &&
            theirsHunk &&
            oursHunk.baseStart === theirsHunk.baseStart
        ) {
            copySlice(result, baseLines, basePos, oursHunk.baseStart);
            if (sameLines(oursHunk.lines, theirsHunk.lines)) {
                result.push(...oursHunk.lines);
            } else {
                result.push(...conflictBlock(oursHunk.lines, theirsHunk.lines));
                conflicted = true;
            }
            basePos = Math.max(oursHunk.baseEnd, theirsHunk.baseEnd);
            oursIdx += 1;
            theirsIdx += 1;
        }
    }
    copySlice(result, baseLines, basePos, baseLines.length);
    return { content: fromLines(result, base, ours, theirs), conflicted };
}

/**
 * Replays local commits onto `tracking` so history stays linear. Conflicts
 * honor `mergeStrategy` the same way merge-pull does.
 */
export async function rebaseOnto(
    host: RebaseHost,
    tracking: string,
    mergeStrategy: MergeStrategy
): Promise<void> {
    const commits = await host.listCommits(`${tracking}..HEAD`);
    if (commits.length === 0) return;

    await host.resetHard(tracking);
    const unresolved: string[] = [];

    for (const hash of commits) {
        const commit = await host.readCommit(hash);
        if (!commit) continue;
        const parent = commit.parents[0];
        const changes = parent
            ? await host.nameStatus(parent, hash)
            : await host.nameStatus(tracking, hash);

        for (const change of changes) {
            const replayed = await replayChange(host, change, parent, hash);
            if (!replayed.conflicted) continue;
            if (mergeStrategy !== "none") {
                // Plugin "theirs" means the remote/incoming side. After
                // reset --hard onto tracking, that content is merge3 "ours"
                // (HEAD), so the marker strategy is swapped versus merge.
                const resolved = resolveConflictMarkers(
                    replayed.content,
                    mergeStrategy === "theirs" ? "ours" : "theirs"
                );
                if (resolved != undefined) {
                    host.writeWorktree(change.path, resolved);
                    continue;
                }
            }
            host.writeWorktree(change.path, replayed.content);
            if (!unresolved.includes(change.path)) {
                unresolved.push(change.path);
            }
        }

        if (unresolved.length > 0) {
            throw new RebaseConflictError(unresolved);
        }

        await host.add(changes.map((change) => change.path));
        const message = commit.message.replace(/\n+$/, "");
        if (message.length > 0) {
            await host.commit(message);
        }
    }
}

async function replayChange(
    host: RebaseHost,
    change: ParsedNameStatusEntry,
    parent: string | undefined,
    commit: string
): Promise<{ content: string; conflicted: boolean }> {
    if (change.type === "D") {
        host.unlinkWorktree(change.path);
        return { content: "", conflicted: false };
    }

    const theirs = (await host.readBlob(commit, change.path)) ?? "";
    if (change.type === "A" || parent == undefined) {
        const ours = host.readWorktree(change.path);
        if (ours == undefined || ours === theirs) {
            host.writeWorktree(change.path, theirs);
            return { content: theirs, conflicted: false };
        }
        const merged = merge3("", ours, theirs);
        host.writeWorktree(change.path, merged.content);
        return merged;
    }

    const base = (await host.readBlob(parent, change.path)) ?? "";
    const ours = host.readWorktree(change.path) ?? base;
    const merged = merge3(base, ours, theirs);
    host.writeWorktree(change.path, merged.content);
    return merged;
}

interface DiffHunk {
    baseStart: number;
    baseEnd: number;
    lines: string[];
}

function diffHunks(base: string[], other: string[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const script = longestCommonSubsequence(base, other);
    let baseIdx = 0;
    let otherIdx = 0;
    let pending: DiffHunk | undefined;

    const flush = (): void => {
        if (pending) {
            hunks.push(pending);
            pending = undefined;
        }
    };

    for (const [baseMatch, otherMatch] of script) {
        while (baseIdx < baseMatch || otherIdx < otherMatch) {
            if (!pending) {
                pending = { baseStart: baseIdx, baseEnd: baseIdx, lines: [] };
            }
            if (baseIdx < baseMatch) {
                pending.baseEnd += 1;
                baseIdx += 1;
            }
            if (otherIdx < otherMatch) {
                pending.lines.push(other[otherIdx]!);
                otherIdx += 1;
            }
        }
        flush();
        baseIdx = baseMatch + 1;
        otherIdx = otherMatch + 1;
    }
    while (baseIdx < base.length || otherIdx < other.length) {
        if (!pending) {
            pending = { baseStart: baseIdx, baseEnd: baseIdx, lines: [] };
        }
        if (baseIdx < base.length) {
            pending.baseEnd += 1;
            baseIdx += 1;
        }
        if (otherIdx < other.length) {
            pending.lines.push(other[otherIdx]!);
            otherIdx += 1;
        }
    }
    flush();
    return hunks;
}

function longestCommonSubsequence(
    left: string[],
    right: string[]
): [number, number][] {
    const n = left.length;
    const m = right.length;
    const table: number[][] = Array.from({ length: n + 1 }, () =>
        new Array<number>(m + 1).fill(0)
    );
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            table[i]![j] =
                left[i] === right[j]
                    ? table[i + 1]![j + 1]! + 1
                    : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
        }
    }
    const pairs: [number, number][] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (left[i] === right[j]) {
            pairs.push([i, j]);
            i += 1;
            j += 1;
        } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
            i += 1;
        } else {
            j += 1;
        }
    }
    return pairs;
}

function hunksOverlap(a: DiffHunk, b: DiffHunk): boolean {
    return a.baseStart < b.baseEnd && b.baseStart < a.baseEnd;
}

function takeOverlapping(
    oursHunks: DiffHunk[],
    theirsHunks: DiffHunk[],
    oursIdx: number,
    theirsIdx: number
): {
    baseStart: number;
    baseEnd: number;
    oursLines: string[];
    theirsLines: string[];
    nextOurs: number;
    nextTheirs: number;
} {
    let baseStart = Math.min(
        oursHunks[oursIdx]!.baseStart,
        theirsHunks[theirsIdx]!.baseStart
    );
    let baseEnd = Math.max(
        oursHunks[oursIdx]!.baseEnd,
        theirsHunks[theirsIdx]!.baseEnd
    );
    const oursLines: string[] = [];
    const theirsLines: string[] = [];
    let i = oursIdx;
    let j = theirsIdx;
    let changed = true;
    while (changed) {
        changed = false;
        while (i < oursHunks.length && oursHunks[i]!.baseStart < baseEnd) {
            baseStart = Math.min(baseStart, oursHunks[i]!.baseStart);
            baseEnd = Math.max(baseEnd, oursHunks[i]!.baseEnd);
            oursLines.push(...oursHunks[i]!.lines);
            i += 1;
            changed = true;
        }
        while (j < theirsHunks.length && theirsHunks[j]!.baseStart < baseEnd) {
            baseStart = Math.min(baseStart, theirsHunks[j]!.baseStart);
            baseEnd = Math.max(baseEnd, theirsHunks[j]!.baseEnd);
            theirsLines.push(...theirsHunks[j]!.lines);
            j += 1;
            changed = true;
        }
    }
    return {
        baseStart,
        baseEnd,
        oursLines,
        theirsLines,
        nextOurs: i,
        nextTheirs: j,
    };
}

function copySlice(
    target: string[],
    source: string[],
    start: number,
    end: number
): void {
    for (let i = start; i < end; i++) {
        target.push(source[i]!);
    }
}

function conflictBlock(ours: string[], theirs: string[]): string[] {
    return ["<<<<<<< HEAD", ...ours, "=======", ...theirs, ">>>>>>> incoming"];
}

function sameLines(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((line, index) => line === right[index]);
}

function toLines(text: string): string[] {
    if (text === "") return [];
    const lines = text.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    return lines;
}

function fromLines(
    lines: string[],
    base: string,
    ours: string,
    theirs: string
): string {
    if (lines.length === 0) return "";
    const keepNewline =
        base.endsWith("\n") || ours.endsWith("\n") || theirs.endsWith("\n");
    return lines.join("\n") + (keepNewline ? "\n" : "");
}
