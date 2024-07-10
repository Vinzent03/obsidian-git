import type { LineAuthoring } from "src/lineAuthor/model";
import type { BlameCommit } from "src/types";

/**
 * Chooses the newest commit from the {@link LineAuthoring} for the
 * lines {@link startLine} to {@link endLine} (inclusive).
 */
export function chooseNewestCommit(
    lineAuthoring: Exclude<LineAuthoring, "untracked">,
    startLine: number,
    endLine: number
): BlameCommit {
    let newest: BlameCommit = undefined!;

    for (let line = startLine; line <= endLine; line++) {
        const currentHash = lineAuthoring.hashPerLine[line];
        const currentCommit = lineAuthoring.commits.get(currentHash)!;

        if (
            !newest ||
            currentCommit.isZeroCommit ||
            isNewerThan(currentCommit, newest)
        ) {
            newest = currentCommit;
        }
    }

    return newest;
}

function isNewerThan(left: BlameCommit, right: BlameCommit): boolean {
    const l = left.author?.epochSeconds ?? 0;
    const r = right.author?.epochSeconds ?? 0;
    return l > r;
}
