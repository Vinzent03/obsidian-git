import { Extension, Range, RangeSet, Text } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { sha256 } from "js-sha256";
import {
    latestSettings, LineAuthoringWithId, LineAuthorSettings, lineAuthorState
} from "src/lineAuthor/model";
import { getLongestRenderedGutter, gutterMarkersRangeSet } from "src/lineAuthor/view/cache";
import { lineAuthoringGutterMarker, TextGutter } from "src/lineAuthor/view/gutter/gutter";
import { initialLineAuthoringGutter, initialSpacingGutter } from "src/lineAuthor/view/gutter/initial";
import { newUntrackedFileGutter } from "src/lineAuthor/view/gutter/untrackedFile";

/*
================== VIEW ======================
Contains classes, variables and functions describing
how the MODEL is rendered to a view.
*/

const UNDISPLAYED = new TextGutter("");

/**
 * The line author gutter as a Codemirror {@link Extension}.
 * 
 * It simply renderes the line authoring state from the {@link lineAuthorState} state-field.
*/
export const lineAuthorGutter: Extension = gutter({
    class: "line-author-gutter-container",
    markers(view) {
        // this is called a few times on every keystroke / cursor-move. Hence, it is efficient
        const lineAuthoring = view.state.field(lineAuthorState, false);
        return lineAuthoringGutterMarkersRangeSet(view, lineAuthoring);
    },
    lineMarkerChange(update) {
        const newLineAuthoringId = update.state.field(lineAuthorState)?.key;
        const oldLineAuthoringId = update.startState.field(lineAuthorState)?.key;
        return oldLineAuthoringId !== newLineAuthoringId;
    },
    renderEmptyElements: true,
    initialSpacer: (_v) => initialSpacingGutter(),
    updateSpacer: (_sp, _u) => getLongestRenderedGutter()?.gutter ?? initialSpacingGutter()
});


/**
 * Creates the gutter markers as a {@link RangeSet}.
 * 
 * The computation result is cached for better performance via a SHA-256 `cacheKey`.
 * The actual computation happens in {@link computeLineAuthoringGutterMarkersRangeSet}.
 */
function lineAuthoringGutterMarkersRangeSet(
    view: EditorView,
    optLA?: LineAuthoringWithId
): RangeSet<GutterMarker> {

    const digest = sha256.create();

    digest.update(`${optLA?.la === "untracked"} ${optLA?.key}`);

    const doc = view.state.doc;
    // We don't digest this, even though it is used as an argument for the computation
    // This is because a change in the doc is only reflected in the line authoring
    // when the doc is saved. But saving changes the line authoring key anyways.

    // Each line is part of a block of 1 or more lines. Within a block only the newest
    // commit should be shown. Hence, we collect the start and end positions for each block here.
    const lineBlockEndPos: Map<number, [number, number]> = new Map();
    for (let line = 1; line <= doc.lines; line++) {
        const from = doc.line(line).from;
        const to = view.lineBlockAt(from).to
        lineBlockEndPos.set(line, [from, to]);
        digest.update([from, to, 0]);
    }

    const laSettings = latestSettings.get();
    digest.update("s" + Object.values(latestSettings).join(","));

    const cacheKey = digest.hex();

    const cached = gutterMarkersRangeSet.get(cacheKey);
    if (cached) return cached;

    // This is called infrequently enough to put the computation there.
    const result = computeLineAuthoringGutterMarkersRangeSet(doc, lineBlockEndPos, laSettings, optLA);
    gutterMarkersRangeSet.set(cacheKey, result);
    return result;
}


function computeLineAuthoringGutterMarkersRangeSet(
    doc: Text,
    blocksPerLine: Map<number, [number, number]>,
    settings: LineAuthorSettings,
    optLA?: LineAuthoringWithId
): RangeSet<GutterMarker> {

    const docLastLine = doc.lines;

    const ranges: Range<GutterMarker>[] = [];
    function add(from: number, to: number | undefined, gutter: GutterMarker) {
        return ranges.push(gutter.range(from, to));
    }

    const emptyDoc = doc.length === 0;

    const lastLineIsEmpty = doc.iterLines(docLastLine, docLastLine + 1).next().value === "";

    for (let startLine = 1; startLine <= docLastLine; startLine++) {
        const [from, to] = blocksPerLine.get(startLine)!;
        const endLine = doc.lineAt(to).number;

        if (emptyDoc) {
            add(from, to, UNDISPLAYED);
            continue;
        }

        if (startLine === docLastLine && lastLineIsEmpty) {
            add(from, to, UNDISPLAYED);
            continue;
        }

        if (optLA === undefined) {
            add(from, to, initialLineAuthoringGutter(settings));
            continue;
        }

        const { key, la } = optLA;

        if (la === "untracked") {
            add(from, to, newUntrackedFileGutter(la, settings));
            continue;
        }

        if (endLine >= la.hashPerLine.length) {
            add(from, to, UNDISPLAYED);
            continue;
        }

        add(from, to, lineAuthoringGutterMarker(la, startLine, endLine, key, settings))
    }

    return RangeSet.of(ranges, /* sort = */true);
}