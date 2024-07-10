import { zeroCommit } from "src/gitManager/simpleGit";
import type { LineAuthorSettings } from "src/lineAuthor/model";
import { lineAuthoringGutterMarker } from "src/lineAuthor/view/gutter/gutter";
import type { Blame } from "src/types";

/**
 * The gutter to show on untracked files.
 */
export function newUntrackedFileGutter(
    key: string,
    settings: LineAuthorSettings
) {
    const dummyLineAuthoring = <Blame>{
        hashPerLine: [undefined!, "000000"],
        commits: new Map([["000000", zeroCommit]]),
    };
    return lineAuthoringGutterMarker(dummyLineAuthoring, 1, 1, key, settings);
}
