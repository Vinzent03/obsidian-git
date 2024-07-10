import { moment } from "obsidian";
import { DEFAULT_SETTINGS } from "src/constants";
import type { LineAuthoring, LineAuthorSettings } from "src/lineAuthor/model";
import { latestSettings, maxAgeInDaysFromSettings } from "src/lineAuthor/model";
import { computeAdaptiveInitialColoringAgeInDays } from "src/lineAuthor/view/cache";
import {
    lineAuthoringGutterMarker,
    TextGutter,
} from "src/lineAuthor/view/gutter/gutter";
import type { Blame, BlameCommit, GitTimestamp, UserEmail } from "src/types";
import { momentToEpochSeconds } from "src/utils";

/**
 * The gutter used to reserve the space used for the line authoring before it is loaded.
 *
 * Until the true length is known, it uses the last saved `gutterSpacingFallbackLength`.
 */
export function initialSpacingGutter() {
    const length =
        latestSettings.get()?.gutterSpacingFallbackLength ??
        DEFAULT_SETTINGS.lineAuthor.gutterSpacingFallbackLength;
    return new TextGutter(Array(length).fill("-").join(""));
}

/**
 * Initial line authoring gutter with adaptive coloring for softer UI updates.
 *
 * **DO NOT CACHE THIS FUNCTION CALL, AS THE ADAPTIVE COLOR NEED TO BE FRESHLY CALCULATED.**
 */
export function initialLineAuthoringGutter(settings: LineAuthorSettings) {
    const { lineAuthoring, ageForInitialRender } =
        adaptiveInitialColoredWaitingLineAuthoring(settings);
    return lineAuthoringGutterMarker(
        lineAuthoring,
        1,
        1,
        "initialGutter" + ageForInitialRender, // use a age coloring based cache key
        settings,
        "waiting-for-result"
    );
}

/**
 * Creates a line authoring with an adaptive initial color based on {@link computeAdaptiveInitialColoringAgeInDays} (previously recorded ages).
 *
 * If no such color is available, then it takes the 25% of the max age as the color.
 * e.g. for max age = 100 days, this means it'll use the color for the age of 25 days.
 * This case only happens on each (re-)start of Obsidian.
 *
 * We use a waiting-gutter, to have it rendered - so that we can use it's rendered text
 * and transform it into unintrusive placeholder characters.
 */
export function adaptiveInitialColoredWaitingLineAuthoring(
    settings: LineAuthorSettings
): {
    lineAuthoring: Exclude<LineAuthoring, "untracked">;
    ageForInitialRender: number;
} {
    const ageForInitialRender: number =
        computeAdaptiveInitialColoringAgeInDays() ??
        maxAgeInDaysFromSettings(settings) * 0.25;

    const slightlyOlderAgeForInitialRender: moment.Moment = moment().add(
        -ageForInitialRender,
        "days"
    );

    const dummyAuthor = <UserEmail & GitTimestamp>{
        name: "",
        epochSeconds: momentToEpochSeconds(slightlyOlderAgeForInitialRender),
        tz: "+0000",
    };

    const dummyCommit = <BlameCommit>{
        hash: "waiting-for-result",
        author: dummyAuthor,
        committer: dummyAuthor,
        isZeroCommit: false,
    };

    return {
        lineAuthoring: <Blame>{
            hashPerLine: [undefined!, "waiting-for-result"],
            commits: new Map([["waiting-for-result", dummyCommit]]),
        },
        ageForInitialRender,
    };
}
