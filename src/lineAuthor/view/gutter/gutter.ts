import { GutterMarker } from "@codemirror/view";
import { sha256 } from "js-sha256";
import { Moment } from "moment-timezone";
import { moment } from "obsidian";
import { DATE_FORMAT, DATE_TIME_FORMAT_MINUTES } from "src/constants";
import { latestSettings, LineAuthorDateTimeFormatOptions, LineAuthorDisplay, LineAuthoring, LineAuthorSettings, LineAuthorTimezoneOption } from "src/lineAuthor/model";
import { attachedGutterElements, conditionallyUpdateLongestRenderedGutter, getLongestRenderedGutter, gutterInstances, recordRenderedAgeInDays } from "src/lineAuthor/view/cache";
import { enrichCommitInfoForContextMenu } from "src/lineAuthor/view/contextMenu";
import { coloringBasedOnCommitAge } from "src/lineAuthor/view/gutter/coloring";
import { chooseNewestCommit } from "src/lineAuthor/view/gutter/commitChoice";
import { BlameCommit } from "src/types";
import { currentMoment, impossibleBranch, resizeToLength, strictDeepEqual } from "src/utils";

const VALUE_NOT_FOUND_FALLBACK = "-";

const NEW_COMMIT_CHARACTER = "+";

const DIFFERING_AUTHOR_COMMITTER_MARKER = "*";

const NON_WHITESPACE_REGEXP = /\S/g;
const UNINTRUSIVE_CHARACTER_FOR_INITIAL_DUMMY_RENDERING = "%";

/**
 * A simple text gutter used to hold space until the real results are available.
 */
export class TextGutter extends GutterMarker {
    constructor(public text: string) { super(); }

    eq(other: GutterMarker): boolean { return this.text === (<any>other)?.text; }

    toDOM() { return document.createTextNode(this.text); }

    destroy(dom: Node): void { dom.parentNode?.removeChild(dom); }
}

/**
 * Renders the given {@link LineAuthoring} for the lines {@link startLine}
 * to {@link endLine}.
 */
export class LineAuthoringGutter extends GutterMarker {
    private precomputedDomProvider?: () => HTMLElement;
    public readonly point = false;
    public readonly elementClass = "obs-git-blame-gutter";

    /**
     * **This should only be called {@link lineAuthoringGutterMarker}!**
     * 
     * We want to avoid creating the same instance multiple times for improved performance.
     */
    constructor(
        public readonly lineAuthoring: Exclude<LineAuthoring, "untracked">,
        public readonly startLine: number,
        public readonly endLine: number,
        public readonly key: string,
        public readonly settings: LineAuthorSettings,
        public readonly options?: "dummy-commit",
    ) {
        super();
    }

    // Equality used by CodeMirror for optimisations
    public eq(other: GutterMarker): boolean {
        return (
            this.key === (<LineAuthoringGutter>other)?.key &&
            this.startLine === (<LineAuthoringGutter>other)?.startLine &&
            this.endLine === (<LineAuthoringGutter>other)?.endLine &&
            this?.options === (<LineAuthoringGutter>other)?.options
        );
    }

    /**
     * Renders to a Html node.
     * 
     * It choses the newest commit within the line-range,
     * renders it, makes adjustments for fake-commits and finally warps
     * it into HTML.
     * 
     * The DOM is actually precomputed with {@link computeDom},
     * which provides a finaliser to run before the DOM is handed over to CodeMirror.
     * This is done, because this method is called frequently. It is called,
     * whenever a gutter gets into the viewport and needs to be rendered.
     * 
     * The age in days is recorded via {@link recordRenderedAgeInDays} to enable adaptive coloring.
     */
    public toDOM() {
        this.precomputedDomProvider = this.precomputedDomProvider ?? this.computeDom();
        return this.precomputedDomProvider();
    }

    public destroy(dom: Node): void {
        // this is called frequently, when the gutter moves outside of the view.
        dom.parentNode?.removeChild(dom);
        attachedGutterElements.delete(dom as HTMLElement);
    }

    /**
     * Prepares the DOM for this gutter.
     */
    private computeDom() {
        const commit = chooseNewestCommit(this.lineAuthoring, this.startLine, this.endLine);

        let toBeRenderedText = commit.isZeroCommit ? "" : this.renderNonZeroCommit(commit);

        const isTrueCommit = !commit.isZeroCommit && this.options !== "dummy-commit";

        if (isTrueCommit) {
            conditionallyUpdateLongestRenderedGutter(this, toBeRenderedText);
        } else {
            toBeRenderedText = this.adaptTextForFakeCommit(commit, toBeRenderedText);
        }

        const domProvider = this.createHtmlNode(commit, toBeRenderedText, this.options === "dummy-commit");

        return domProvider;
    }

    private createHtmlNode(commit: BlameCommit, text: string, isDummyCommit: boolean) {
        const templateElt = window.createDiv();

        templateElt.innerText = text;

        const { color, daysSinceCommit } = coloringBasedOnCommitAge(
            commit?.author?.epochSeconds,
            commit?.isZeroCommit,
            this.settings
        );

        templateElt.style.backgroundColor = color;

        enrichCommitInfoForContextMenu(commit, isDummyCommit, templateElt);

        function prepareForDomAttachment(): HTMLElement {
            // clone node before attachment, as attached DOMs may get destroyed.
            const elt = templateElt.cloneNode(true) as HTMLElement;
            attachedGutterElements.add(elt);
            // only record real dates
            if (!isDummyCommit) recordRenderedAgeInDays(daysSinceCommit);
            return elt;
        }

        return prepareForDomAttachment;
    }

    private renderNonZeroCommit(commit: BlameCommit) {
        const optionalShortHash = this.settings.showCommitHash
            ? this.renderHash(commit)
            : "";

        const optionalAuthorName = this.settings.authorDisplay === "hide"
            ? ""
            : `${this.renderAuthorName(commit, this.settings.authorDisplay)}`;

        const optionalAuthoringDate = this.settings.dateTimeFormatOptions === "hide"
            ? ""
            : `${this.renderAuthoringDate(
                commit,
                this.settings.dateTimeFormatOptions,
                this.settings.dateTimeFormatCustomString,
                this.settings.dateTimeTimezone
            )}`;

        const parts = [
            optionalShortHash,
            optionalAuthorName,
            optionalAuthoringDate,
        ];

        return parts.filter(x => x.length >= 1).join(" ");
    }

    private renderHash(nonZeroCommit: BlameCommit) {
        return nonZeroCommit.hash.substring(0, 6);
    }

    private renderAuthorName(
        nonZeroCommit: BlameCommit,
        authorDisplay: Exclude<LineAuthorDisplay, "hide">
    ): string {
        const name = nonZeroCommit?.author?.name ?? "";
        const words = name.split(" ").filter(word => word.length >= 1); // non-empty words

        let rendered;
        switch (authorDisplay) {
            case "initials": // take every words first letter captitalized
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
        if (!strictDeepEqual(nonZeroCommit?.author, nonZeroCommit?.committer)) {
            rendered = rendered + DIFFERING_AUTHOR_COMMITTER_MARKER;
        }

        return rendered;
    }

    private renderAuthoringDate(
        nonZeroCommit: BlameCommit,
        dateTimeFormatOptions: Exclude<LineAuthorDateTimeFormatOptions, "hide">,
        dateTimeFormatCustomString: string,
        dateTimeTimezone: LineAuthorTimezoneOption,
    ) {
        const FALLBACK_COMMIT_DATE = "?";
        if (nonZeroCommit?.author?.epochSeconds === undefined) return FALLBACK_COMMIT_DATE;

        let dateTimeFormatting: string | ((time: Moment) => string);

        // adapt dateTimeFormatting based on the settings
        switch (dateTimeFormatOptions) {
            case "date":
                dateTimeFormatting = DATE_FORMAT;
                break;
            case "datetime":
                dateTimeFormatting = DATE_TIME_FORMAT_MINUTES;
                break;
            case "custom":
                dateTimeFormatting = dateTimeFormatCustomString;
                break;
            case "natural language":
                dateTimeFormatting = time => {
                    const diff = time.diff(currentMoment());
                    const addFluentSuffix = true; // 2 weeks -> 2 weeks ago
                    return moment.duration(diff).humanize(addFluentSuffix);
                };
                break;
            default:
                return impossibleBranch(dateTimeFormatOptions);
        }

        let authoringDate: Moment = moment.unix(nonZeroCommit.author.epochSeconds);

        // moment usually shows the above authoring date in the viewer local timezone.
        // when we want to show it in the absolute UTC time-zone, we'll need to provide
        // and adapt the utcOffset
        switch (dateTimeTimezone) {
            case "viewer-local": // moment uses local timezone by default.
                break;
            case "author-local":
                authoringDate = authoringDate.utcOffset(nonZeroCommit.author.tz);
                dateTimeFormatting += " Z"; // add explicit time-zone, as this is not clear now.
                break;
            case "utc0000":
                authoringDate = authoringDate.utc(); // convert to utc
                dateTimeFormatting += "[Z]"; // add "Z" to indicate, that this is UTC+0000 time.
                break;
            default:
                return impossibleBranch(dateTimeTimezone);
        }

        // compute formatting based on dateTimeFormatting
        if (typeof dateTimeFormatting === "string") {
            return authoringDate.format(dateTimeFormatting);
        }
        else {
            return dateTimeFormatting(authoringDate);
        }
    }

    private adaptTextForFakeCommit(commit: BlameCommit, toBeRenderedText: string) {
        // attempt to use longest text as template for fake commit.
        const original = getLongestRenderedGutter()?.text ?? toBeRenderedText;

        // replace template with + or % depending on whether its a zero commit or dummy-commit.
        // the % is used to make the UI update from % to the true characters unintrusive
        const fillCharacter = commit.isZeroCommit ? NEW_COMMIT_CHARACTER : UNINTRUSIVE_CHARACTER_FOR_INITIAL_DUMMY_RENDERING;
        toBeRenderedText = original.replace(
            NON_WHITESPACE_REGEXP,
            fillCharacter
        );

        // Adapt the text to the same length as previously rendered gutters.
        // This ensures, that the frequent UI updates with differing line author lengths
        // don't frequently shift the gutter size - which would also cause distracting UI updates.
        let desiredLength = latestSettings.get()?.gutterSpacingFallbackLength ?? toBeRenderedText.length;

        if (commit.isZeroCommit) desiredLength = Math.min(desiredLength, 3);

        return resizeToLength(toBeRenderedText, desiredLength, fillCharacter);
    }
}

/**
 * Creates a {@link LineAuthoringGutter}.
 * 
 * This function should be used instead of directly calling the constructor,
 * as we don't want to re-create the same instance multiple times, whenever the user
 * scrolls through a document. It simply stores the instances in the cache {@link gutterInstances}.
 */
export function lineAuthoringGutterMarker(
    la: Exclude<LineAuthoring, "untracked">,
    startLine: number,
    endLine: number,
    key: string,
    settings: LineAuthorSettings,
    options?: "dummy-commit",
) {
    const digest = sha256.create();
    digest.update(Object.values(settings).join(","));
    digest.update(`s${startLine}-e${endLine}-k${key}-o${options}`);

    const cacheKey = digest.hex();

    const cached = gutterInstances.get(cacheKey);
    if (cached) return cached;

    const result = new LineAuthoringGutter(la, startLine, endLine, key, settings, options);
    gutterInstances.set(cacheKey, result);
    return result;
}