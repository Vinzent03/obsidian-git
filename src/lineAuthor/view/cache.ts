import type { RangeSet } from "@codemirror/state";
import type { GutterMarker } from "@codemirror/view";
import { latestSettings } from "src/lineAuthor/model";
import type { LineAuthoringGutter } from "src/lineAuthor/view/gutter/gutter";
import { median } from "src/utils";

/*
VIEW-CACHE
This file contains temporarily cached information used in the view.
They make it also possible to have unintrusive and soft UI updates, when
the git line author information appears delayed.
The caches here are evicted whenever the line author feature is disabled/refreshed.
*/

/**
 * Clears the cache. This should be called whenever the settings are changed.
 *
 * Currently, the entire feature is re-loaded, which is why it suffices this to be called
 * in the disabler in `lineAuthorIntegration.ts`.
 */
export function clearViewCache() {
    longestRenderedGutter = undefined;

    renderedAgeInDaysForAdaptiveInitialColoring = [];
    ageIdx = 0;

    gutterInstances.clear();
    gutterMarkersRangeSet.clear();

    attachedGutterElements.clear();
}

/**
 * A cache containing the last maximally-sized encountered gutter together with its length and text.
 *
 * Whenever a longer gutter is encountered, it is saved via {@link conditionallyUpdateLongestRenderedGutter}.
 */
type LongestGutterCache = {
    gutter: LineAuthoringGutter;
    length: number;
    text: string;
};
let longestRenderedGutter: LongestGutterCache | undefined = undefined;

export const getLongestRenderedGutter = () => longestRenderedGutter;

/**
 * Given a newly rendered gutter, update the {@link longestRenderedGutter} by comparing the
 * text lengths.
 *
 * If bigger, then update the global variable and persist the settings via {@link latestSettings.save}
 */
export function conditionallyUpdateLongestRenderedGutter(
    gutter: LineAuthoringGutter,
    text: string
) {
    const length = text.length;

    if (length < (longestRenderedGutter?.length ?? 0)) return;

    longestRenderedGutter = { gutter, length, text };

    const settings = latestSettings.get();
    if (length !== settings.gutterSpacingFallbackLength) {
        settings.gutterSpacingFallbackLength = length;
        latestSettings.save(settings);
    }
}

/**
 * When a new file is opened, we need to already render the line gutter even before we
 * know the true git line authoring - and their true colors.
 *
 * Simply rendering them with the background color initially is not good, as the
 * UI update, when the result is available, is distracting and flickering.
 *
 * Hence, we adapt the initial color shown when opening and switching panes.
 *
 * The initial color is computed from the distribution of ages of each line commit
 * (in days). Currently, we use {@link ADAPTIVE_INITIAL_COLORING_AGE_CACHE_SIZE}`=50`
 * elements and the `median` to compute the color.
 */
let renderedAgeInDaysForAdaptiveInitialColoring: number[] = [];

const ADAPTIVE_INITIAL_COLORING_AGE_CACHE_SIZE = 15;

let ageIdx = 0;
export function recordRenderedAgeInDays(age: number) {
    renderedAgeInDaysForAdaptiveInitialColoring[ageIdx] = age;
    ageIdx = (ageIdx + 1) % ADAPTIVE_INITIAL_COLORING_AGE_CACHE_SIZE;
}

export function computeAdaptiveInitialColoringAgeInDays(): number | undefined {
    return median(renderedAgeInDaysForAdaptiveInitialColoring);
}

/**
 * Caches the {@link LineAuthoringGutter} instances created in `gutter.ts`.
 */
export const gutterInstances: Map<string, LineAuthoringGutter> = new Map();

/**
 * Caches the computation of {@link computeLineAuthoringGutterMarkersRangeSet}.
 *
 * Despite the computation of the document digest and line-blocks, the performance
 * was measured to be faster with the caching.
 */
export const gutterMarkersRangeSet: Map<
    string,
    RangeSet<GutterMarker>
> = new Map();

/**
 * Stores all DOM-attached gutter elements so that they can be checked for being
 * under the mouse during a gutter context-menu event;
 */
export const attachedGutterElements: Set<HTMLElement> = new Set();
