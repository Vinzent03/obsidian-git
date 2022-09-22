import { gutter, GutterMarker } from "@codemirror/view";
import * as moment from "moment";
import { Moment } from "moment-timezone";
import { DATE_FORMAT, DATE_TIME_FORMAT_MINUTES, DEFAULT_SETTINGS } from "src/constants";
import { parseColoringMaxAgeDuration } from "src/settings";
import {
    Blame,
    BlameCommit,
    GitTimestamp,
    LineAuthorDateTimeFormatOptions,
    LineAuthorDisplay,
    ObsidianGitSettings,
    UserEmail
} from "src/types";
import { registerLastClickedGutterHandler } from "src/ui/editor/lineAuthorInfo/contextMenu";
import { settingsStateField } from "src/ui/editor/lineAuthorInfo/control";
import {
    LineAuthoring,
    LineAuthorSettings,
    lineAuthorState, OptLineAuthoring,
    zeroCommit
} from "src/ui/editor/lineAuthorInfo/model";
import { currentMoment, median, momentToEpochSeconds, strictDeepEqual, typeCheckedUnreachable as impossibleBranch } from "src/utils";


const VALUE_NOT_FOUND_FALLBACK = "-";
const NEW_COMMIT = "+++";

const NON_WHITESPACE_REGEXP = /\S/g;
const UNINTRUSIVE_CHARACTER_FOR_INITIAL_DUMMY_RENDERING = "%";

let gutterSpacingSettingsSaver: () => void = undefined!;
let gutterSpacingSettingsGetter: () => ObsidianGitSettings = undefined!;

/**
 * todo. explain
 */
export function provideSettingsAccess(
    settingsGetter: () => ObsidianGitSettings,
    settingsSaver: () => void,
) {
    gutterSpacingSettingsGetter = settingsGetter;
    gutterSpacingSettingsSaver = settingsSaver;
}

const ADAPTIVE_INITIAL_COLORING_AGE_CACHE_SIZE = 50;

/**
 * todo. explain.
 */
type LongestGutterCache = { gutter: LineAuthoringGutter, length: number; text: string; };
let longestRenderedGutter: LongestGutterCache | undefined = undefined;
function updateLongestRenderedGutter(gutter: LineAuthoringGutter, text: string) {
    const length = text.length;
    longestRenderedGutter = { gutter, length, text };
    const settings = gutterSpacingSettingsGetter();
    if (length !== settings.gutterSpacingFallbackLengthLineAuthorInfo) {
        settings.gutterSpacingFallbackLengthLineAuthorInfo = length;
        gutterSpacingSettingsSaver();
    }
}

let renderedAgeInDaysForAdaptiveInitialColoring: number[] = [];
let ageIdx = 0;
function recordRenderedAgeInDays(age: number) {
    renderedAgeInDaysForAdaptiveInitialColoring[ageIdx] = age;
    ageIdx = (ageIdx + 1) % ADAPTIVE_INITIAL_COLORING_AGE_CACHE_SIZE;
}
function computeAdaptiveInitialColoringAgeInDays(): number | undefined {
    return median(renderedAgeInDaysForAdaptiveInitialColoring);
}

export function clearViewCache() {
    longestRenderedGutter = undefined;
    renderedAgeInDaysForAdaptiveInitialColoring = [];
    ageIdx = 0;
}

/** todo. */
export const lineAuthorGutter = gutter({
    class: "line-author-gutter-container",
    lineMarker(view, line, _otherMarkers) {
        const lineAuthoring = view.state.field(lineAuthorState, false);
        const settings: LineAuthorSettings = view.state.field(
            settingsStateField,
            false
        )!;

        // We have two line numbers here, because embeds, tables and co. cause
        // multiple lines to be rendered with a single gutter. Hence, we need to
        // choose the youngest commit - of which the info will be shown.
        const startLine = view.state.doc.lineAt(line.from).number;
        const endLine = view.state.doc.lineAt(line.to).number;
        const docLastLine = view.state.doc.lines;
        const isEmptyLine = view.state.doc.iterLines(startLine, endLine + 1).next().value === "";

        return getLineAuthorInfo(
            startLine,
            endLine,
            docLastLine,
            isEmptyLine,
            lineAuthoring,
            settings
        );
    },
    // Rerender, when we have any state change.
    // Unfortunately, when the cursor moves, the re-render will happen anyways :/
    lineMarkerChange(update) {
        const newLineAuthoringId = update.state.field(lineAuthorState)?.[0];
        const oldLineAuthoringId = update.startState.field(lineAuthorState)?.[0];
        const idsDifferent = oldLineAuthoringId !== newLineAuthoringId;

        return idsDifferent;
    },
    renderEmptyElements: true,
    initialSpacer: (_v) => spacingFallbackGutter(),
    updateSpacer(spacer, update) {
        const settings = update.state.field(settingsStateField, false);
        if (settings?.authorDisplay === undefined) return spacer;
        return longestRenderedGutter?.gutter ?? spacingFallbackGutter();
    },
});

/** todo. */
function getLineAuthorInfo(
    startLine: number,
    endLine: number,
    docLastLine: number,
    isEmptyLine: boolean,
    optLineAuthoring: OptLineAuthoring,
    settings: LineAuthorSettings
): LineAuthoringGutter | TextGutter {
    if (startLine === docLastLine && isEmptyLine) {
        // last empty line has no git-blame defined.
        return UNDISPLAYED;
    }

    if (optLineAuthoring === undefined) {
        return fallbackLineAuthoringGutter(settings);
    }

    const [key, lineAuthoring] = optLineAuthoring;

    if (lineAuthoring === "untracked") {
        return newUntrackedFileGutter(key, settings);
    }

    if (endLine >= lineAuthoring.hashPerLine.length) return UNDISPLAYED;

    return new LineAuthoringGutter(lineAuthoring, startLine, endLine, key, settings)
}

function fallbackLineAuthoringGutter(settings: LineAuthorSettings) {
    return new LineAuthoringGutter(adaptiveInitialColoredDummyLineAuthoring(settings), 1, 1, "undefined", settings, "dummy-data")
}

class TextGutter extends GutterMarker {
    constructor(public text: string) {
        super();
    }

    eq(other: GutterMarker): boolean {
        return this.text === (<any>other)?.text;
    }

    toDOM() {
        return document.createTextNode(this.text);
    }

    destroy(dom: Node): void {
        dom.parentNode?.removeChild(dom);
    }
}

const UNDISPLAYED = new TextGutter("");
function spacingFallbackGutter() {
    const length = gutterSpacingSettingsGetter()?.gutterSpacingFallbackLengthLineAuthorInfo ?? DEFAULT_SETTINGS.gutterSpacingFallbackLengthLineAuthorInfo;
    return new TextGutter(Array(length).fill("-").join(""));
}

/** todo. */
class LineAuthoringGutter extends GutterMarker {
    constructor(
        public readonly la: Exclude<LineAuthoring, "untracked">,
        public readonly startLine: number,
        public readonly endLine: number,
        public readonly key: string,
        public readonly settings: LineAuthorSettings,
        public readonly options?: "dummy-data",
    ) {
        super();
    }

    eq(other: GutterMarker): boolean {
        return (
            this.key === (<LineAuthoringGutter>other)?.key &&
            this.startLine === (<LineAuthoringGutter>other)?.startLine &&
            this.endLine === (<LineAuthoringGutter>other)?.endLine &&
            this?.options === (<LineAuthoringGutter>other)?.options
        );
    }

    elementClass = "obs-git-blame-gutter";

    toDOM() {
        const lineAuthoring = this.la;

        const { hash, commit } = chooseNewestCommitHash(
            lineAuthoring,
            this.startLine,
            this.endLine
        );

        const optionalShortHash = this.settings.showCommitHash
            ? displayHash(hash, commit)
            : "";

        const optionalAuthorName =
            this.settings.authorDisplay === "hide"
                ? ""
                : ` ${authorName(commit, this.settings.authorDisplay)}`;

        const optionalAuthoringDate =
            this.settings.dateTimeFormatOptions === "hide"
                ? ""
                : ` ${authoringDate(
                    commit,
                    this.settings.dateTimeFormatOptions,
                    this.settings
                )}`;

        let toBeRenderedText = [
            optionalShortHash,
            optionalAuthorName,
            optionalAuthoringDate,
        ].join("");

        if (this.options !== "dummy-data" &&
            toBeRenderedText.length > (longestRenderedGutter?.length ?? 0)
        ) {
            updateLongestRenderedGutter(this, toBeRenderedText);
        }

        if (this.options === "dummy-data") {
            const original = longestRenderedGutter?.text ?? toBeRenderedText;
            toBeRenderedText = original
                .replace(
                    NON_WHITESPACE_REGEXP,
                    UNINTRUSIVE_CHARACTER_FOR_INITIAL_DUMMY_RENDERING
                );
            toBeRenderedText = resizeToLength(
                toBeRenderedText,
                gutterSpacingSettingsGetter()?.gutterSpacingFallbackLengthLineAuthorInfo ?? toBeRenderedText.length
            );
        }

        const node = document.body.createDiv();

        // save this gutters info on mousedown so that the corresponding
        // right-click / context-menu has access to this commit info.
        registerLastClickedGutterHandler(node, hash, commit);

        // Add basic color based on commit age
        node.style.backgroundColor = commitAuthoringAgeBasedColor(
            commit?.author?.epochSeconds,
            commit?.isZeroCommit,
            this.settings
        );

        // Embed into <pre> tag to ensure spaces are not lost.
        const pre = node.createEl("pre");
        pre.innerText = toBeRenderedText;
        node.appendChild(pre);

        return node;
    }

    destroy(dom: Node): void {
        dom.parentNode?.removeChild(dom);
    }
}

function displayHash(hash: string, commit: BlameCommit) {
    return commit.isZeroCommit ? NEW_COMMIT : hash.substring(0, 6);
}

/**
 * Renders the author of the commit into a string.
 * 
 * <b>When chaging this, please also update {@link spac}
 */
function authorName(
    commit: BlameCommit,
    authorDisplay: Exclude<LineAuthorDisplay, "hide">
): string {
    if (commit.isZeroCommit) return NEW_COMMIT;

    const name = commit?.author?.name ?? "";
    const words = name.split(" ").filter((word) => word.length >= 1);

    let rendered;
    switch (authorDisplay) {
        case "initials":
            rendered = words.map((word) => word[0].toUpperCase()).join("");
            break;
        case "first name":
            rendered = words.first() ?? VALUE_NOT_FOUND_FALLBACK;
            break;
        case "last name":
            rendered = words.last() ?? VALUE_NOT_FOUND_FALLBACK;
            break;
        case "full":
            rendered = name;
            break;
        default:
            return impossibleBranch(authorDisplay);
    }

    // add trailing * if author and comitter are different.
    if (!strictDeepEqual(commit?.author, commit?.committer)) {
        rendered = rendered + "*";
    }

    return rendered;
}

function authoringDate(
    commit: BlameCommit,
    dateTimeFormatOptions: Exclude<LineAuthorDateTimeFormatOptions, "hide">,
    settings: LineAuthorSettings
) {
    if (commit.isZeroCommit) return NEW_COMMIT;

    const FALLBACK_COMMIT_DATE = "?";

    if (commit?.author?.epochSeconds === undefined) return FALLBACK_COMMIT_DATE;

    let dateTimeFormat: string | ((time: Moment) => string);

    switch (dateTimeFormatOptions) {
        case "date":
            dateTimeFormat = DATE_FORMAT;
            break;
        case "datetime":
            dateTimeFormat = DATE_TIME_FORMAT_MINUTES;
            break;
        case "custom":
            dateTimeFormat = settings.dateTimeFormatCustomString;
            break;
        case "natural language":
            dateTimeFormat = (time) => {
                const diff = time.diff(currentMoment());
                return moment.duration(diff).humanize(true);
            };
            break;
        default:
            return impossibleBranch(dateTimeFormatOptions);
    }

    let authoringDate = moment.unix(commit.author.epochSeconds);

    switch (settings.dateTimeTimezone) {
        case "local": // moment uses local timezone by default.
            break;
        case "utc":
            authoringDate = authoringDate.utcOffset(commit.author.tz);
            dateTimeFormat += " Z";
            break;
        default:
            return impossibleBranch(settings.dateTimeTimezone);
    }

    if (typeof dateTimeFormat === "string") {
        return authoringDate.format(dateTimeFormat);
    }
    else {
        return dateTimeFormat(authoringDate);
    }
}

export function previewColor(which: "older" | "recent", settings: LineAuthorSettings) {
    return which === "older" ?
        commitAuthoringAgeBasedColor(0 /* epoch time: 1970 */, false, settings) :
        commitAuthoringAgeBasedColor(undefined, true, settings)
}

function commitAuthoringAgeBasedColor(
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

function chooseNewestCommitHash(
    lineAuthoring: Exclude<LineAuthoring, "untracked">,
    startLine: number,
    endLine: number
): { hash: string; commit: BlameCommit; } {
    const startHash = lineAuthoring.hashPerLine[startLine];

    let newest = {
        hash: startHash,
        commit: lineAuthoring.commits.get(startHash)!,
    };

    if (startLine === endLine) return newest;

    for (let line = startLine + 1; line <= endLine; line++) {
        const currentHash = lineAuthoring.hashPerLine[line];
        const currentCommit = lineAuthoring.commits.get(currentHash)!;

        if (
            currentCommit.isZeroCommit ||
            isNewerThan(currentCommit, newest.commit!)
        ) {
            newest = { hash: currentHash, commit: currentCommit };
        }
    }

    return newest;
}

function getAbsoluteAuthoringMoment(commit: BlameCommit) {
    return moment.unix(commit.author!.epochSeconds).utcOffset(commit.author!.tz);
}

function isNewerThan(left: BlameCommit, right: BlameCommit): boolean {
    const l = getAbsoluteAuthoringMoment(left);
    const r = getAbsoluteAuthoringMoment(right);
    const diff = l.diff(r, "minutes"); // l - r > 0  <=>  l > r  <=>  l is newer
    return diff > 0;
}

function newUntrackedFileGutter(key: string, settings: LineAuthorSettings) {
    const untrackedDummyLineAuthoring = untrackedFileLineAuthoring();
    return new LineAuthoringGutter(
        untrackedDummyLineAuthoring,
        1,
        1,
        key,
        settings
    );
}

// todo. explain render age coloring
function adaptiveInitialColoredDummyLineAuthoring(settings: LineAuthorSettings): Exclude<LineAuthoring, "untracked"> {
    const ageForInitialRender = computeAdaptiveInitialColoringAgeInDays() ?? maxAgeInDaysFromSettings(settings) * 0.25;
    const slightlyOlderAgeForInitialRender = currentMoment().add(-ageForInitialRender, "days");

    const author = <UserEmail & GitTimestamp>{
        name: "",
        epochSeconds: momentToEpochSeconds(slightlyOlderAgeForInitialRender),
        tz: "+0000",
    };
    const unknownCommit = <BlameCommit>{
        hash: VALUE_NOT_FOUND_FALLBACK,
        author: author,
        committer: author,
        isZeroCommit: false,
    };
    return <Blame>{
        hashPerLine: [undefined!, VALUE_NOT_FOUND_FALLBACK],
        commits: new Map([[VALUE_NOT_FOUND_FALLBACK, unknownCommit]]),
    };
}

function untrackedFileLineAuthoring(): Exclude<LineAuthoring, "untracked"> {
    return <Blame>{
        hashPerLine: [undefined!, "000000"],
        commits: new Map([["000000", zeroCommit]]),
    };
}

function isDarkMode() {
    const obsidian = (<any>window)?.app;
    // Otherwise it's 'moonstone'
    return obsidian?.getTheme() === "obsidian";
}

function maxAgeInDaysFromSettings(settings: LineAuthorSettings) {
    return parseColoringMaxAgeDuration(settings.coloringMaxAge)?.asDays() ?? 356;
}

function resizeToLength(original: string, desiredLength: number): string {
    if (original.length <= desiredLength) {
        const prepended = new Array(desiredLength - original.length)
            .fill(UNINTRUSIVE_CHARACTER_FOR_INITIAL_DUMMY_RENDERING)
            .join("");
        return prepended + original;
    }
    else {
        return original.substring(original.length - desiredLength - 1);
    }
}

