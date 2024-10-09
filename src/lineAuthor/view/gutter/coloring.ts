import type { App } from "obsidian";
import type { LineAuthorSettings } from "src/lineAuthor/model";
import { maxAgeInDaysFromSettings } from "src/lineAuthor/model";
import type { GitTimestamp } from "src/types";

/**
 * Given the settings, it computes the background gutter color for the
 * oldest and newest commit.
 */
export function previewColor(
    which: "oldest" | "newest",
    settings: LineAuthorSettings
) {
    return which === "oldest"
        ? coloringBasedOnCommitAge(0 /* epoch time: 1970 */, false, settings)
              .color
        : coloringBasedOnCommitAge(undefined, true, settings).color;
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
 * The coloring is then linearly interpolated between the two colors provided in the settings.
 *
 * Additional minor adjustments were made for dark/light mode, transparency, scaling
 * and also using more red-like colors near the newer ages.
 */
export function coloringBasedOnCommitAge(
    commitAuthorEpochSeonds: GitTimestamp["epochSeconds"] | undefined,
    isZeroCommit: boolean,
    settings: LineAuthorSettings
): { color: string; daysSinceCommit: number } {
    const maxAgeInDays = maxAgeInDaysFromSettings(settings);

    const epochSecondsNow = Date.now() / 1000;
    const authoringEpochSeconds = commitAuthorEpochSeonds ?? 0;

    const secondsSinceCommit = isZeroCommit
        ? 0
        : epochSecondsNow - authoringEpochSeconds;

    const daysSinceCommit = secondsSinceCommit / 60 / 60 / 24;

    // 0 <= x <= 1, larger means older
    // use n-th-root to make recent changes more prnounced
    const x = Math.pow(
        Math.clamp(daysSinceCommit / maxAgeInDays, 0, 1),
        1 / 2.3
    );

    const dark = isDarkMode();

    const color0 = settings.colorNew;
    const color1 = settings.colorOld;

    const scaling = dark ? 0.4 : 1;
    const r = lin(color0.r, color1.r, x) * scaling;
    const g = lin(color0.g, color1.g, x) * scaling;
    const b = lin(color0.b, color1.b, x) * scaling;
    const a = dark ? 0.75 : 0.25;

    return { color: `rgba(${r},${g},${b},${a})`, daysSinceCommit };
}

function lin(z0: number, z1: number, x: number): number {
    return z0 + (z1 - z0) * x;
}

function isDarkMode() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    return ((window as any).app as App)?.getTheme() === "obsidian"; // light mode is "moonstone"
}

/**
 * Set the CSS variable `--obs-git-gutter-text` based on the configured
 * value in the line author settings. This is necessary for proper text coloring.
 */
export function setTextColorCssBasedOnSetting(settings: LineAuthorSettings) {
    document.body.style.setProperty(
        "--obs-git-gutter-text",
        settings.textColorCss
    );
}
