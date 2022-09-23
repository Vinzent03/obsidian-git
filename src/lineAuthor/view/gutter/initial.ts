import { Moment } from "moment-timezone";
import { DEFAULT_SETTINGS } from "src/constants";
import { latestSettings, LineAuthoring, LineAuthorSettings, maxAgeInDaysFromSettings } from "src/lineAuthor/model";
import { computeAdaptiveInitialColoringAgeInDays } from "src/lineAuthor/view/cache";
import { LineAuthoringGutter, TextGutter } from "src/lineAuthor/view/gutter/gutter";
import { Blame, BlameCommit, GitTimestamp, UserEmail } from "src/types";
import { currentMoment, momentToEpochSeconds } from "src/utils";

/**
 * The gutter used to reserve the space used for the line authoring before it is loaded.
 * 
 * Until the true length is known, it uses the last saved {@link gutterSpacingFallbackLength}.
 */
export function initialSpacingGutter() {
    const length = latestSettings.get()?.gutterSpacingFallbackLength ?? DEFAULT_SETTINGS.lineAuthor.gutterSpacingFallbackLength;
    return new TextGutter(Array(length).fill("-").join(""));
}

/**
 * Initial line authoring gutter with adaptive coloring for softer UI updates.
 */
export function initialLineAuthoringGutter(settings: LineAuthorSettings) {
    const lineAuthoring = adaptiveInitialColoredDummyLineAuthoring(settings);
    return new LineAuthoringGutter(lineAuthoring, 1, 1, "undefined", settings, "dummy-commit")
}

/**
 * Creates a line authoring with an adaptive initial color based on {@link computeAdaptiveInitialColoringAgeInDays} (previously recorded ages).
 * 
 * If no such color is available, then it takes the 25% of the max age as the color.
 * e.g. for max age = 100 days, this means it'll use the color for the age of 25 days.
 * This case only happens on each (re-)start of Obsidian.
 * 
 * We use a dummy commit, to have it rendered - so that we can use it's rendered text
 * and transform it into unintrusive placeholder characters.
 */
export function adaptiveInitialColoredDummyLineAuthoring
    (settings: LineAuthorSettings): Exclude<LineAuthoring, "untracked"> {

    const ageForInitialRender: number =
        computeAdaptiveInitialColoringAgeInDays() ?? maxAgeInDaysFromSettings(settings) * 0.25;

    const slightlyOlderAgeForInitialRender: Moment =
        currentMoment().add(-ageForInitialRender, "days");

    const dummyAuthor = <UserEmail & GitTimestamp>{
        name: "",
        epochSeconds: momentToEpochSeconds(slightlyOlderAgeForInitialRender),
        tz: "+0000",
    };

    const dummyCommit = <BlameCommit>{
        hash: "dummy-commit",
        author: dummyAuthor,
        committer: dummyAuthor,
        isZeroCommit: false,
    };

    return <Blame>{
        hashPerLine: [undefined!, "dummy-commit"],
        commits: new Map([["dummy-commit", dummyCommit]]),
    };
}

