import { LineAuthorSettings, maxAgeInDaysFromSettings } from "src/lineAuthor/model";
import { recordRenderedAgeInDays } from "src/lineAuthor/view/cache";
import { GitTimestamp } from "src/types";

/**
 * Given the settings, it computes the background gutter color for the
 * oldest and newest commit.
 */
export function previewColor(which: "oldest" | "newest", settings: LineAuthorSettings) {
    return which === "oldest" ?
        coloringBasedOnCommitAge(0 /* epoch time: 1970 */, false, settings) :
        coloringBasedOnCommitAge(undefined, true, settings)
}

/**
 * Computes the `rgba(...)` color string describing the background color
 * for a commit timestamp {@link GitTimestamp} and the settings.
 * 
 * It first computes the age x (from 0 to 1) of the commit where
 * 0 means now and 1 means maximum age (settings) or older.
 * 
 * The zero commit gets the age 0.
 * 
 * The age in days is recorded via {@link recordRenderedAgeInDays} to enable adaptive coloring.
 * 
 * The coloring is then linearly interpolated between the two colors provided in the settings.
 * 
 * Additional minor adjustments were made for dark/light mode, transparency, scaling
 * and also using more red-like colors near the newer ages.
 */
export function coloringBasedOnCommitAge(
    commitAuthorEpochSeonds: GitTimestamp["epochSeconds"] | undefined,
    isZeroCommit: boolean,
    settings: LineAuthorSettings
): string {
    const maxAgeInDays = maxAgeInDaysFromSettings(settings);

    const epochSecondsNow = Date.now() / 1000;
    const authoringEpochSeconds = commitAuthorEpochSeonds ?? 0;

    const secondsSinceCommit = isZeroCommit
        ? 0
        : epochSecondsNow - authoringEpochSeconds;

    const daysSinceCommit = secondsSinceCommit / 60 / 60 / 24;

    recordRenderedAgeInDays(daysSinceCommit);

    // 0 <= x <= 1, larger means older
    // use n-th-root to make recent changes more prnounced
    const x = Math.pow(Math.clamp(daysSinceCommit / maxAgeInDays, 0, 1), 1 / 2.3);

    const dark = isDarkMode();

    const color0 = settings.colorNew;
    const color1 = settings.colorOld;

    const scaling = dark ? 0.4 : 1;
    const r = lin(color0.r, color1.r, x) * scaling;
    const g = lin(color0.g, color1.g, x) * scaling;
    const b = lin(color0.b, color1.b, x) * scaling;
    const a = dark ? 0.75 : 0.25;

    return `rgba(${r},${g},${b},${a})`;
}

function lin(z0: number, z1: number, x: number): number {
    return z0 + (z1 - z0) * x;
}

function isDarkMode() {
    const obsidian = (<any>window)?.app;
    return obsidian?.getTheme() === "obsidian"; // light mode is "moonstone"
}