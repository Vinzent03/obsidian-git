import { LineAuthorSettings } from "src/lineAuthor/model";
import { LineAuthoringGutter } from "src/lineAuthor/view/gutter/gutter";
import { zeroCommit } from "src/simpleGit";
import { Blame } from "src/types";

/**
 * The gutter to show on untracked files.
 */
export function newUntrackedFileGutter(key: string, settings: LineAuthorSettings) {
    const dummyLineAuthoring = <Blame>{
        hashPerLine: [undefined!, "000000"],
        commits: new Map([["000000", zeroCommit]]),
    };
    return new LineAuthoringGutter(dummyLineAuthoring, 1, 1, key, settings);
}
