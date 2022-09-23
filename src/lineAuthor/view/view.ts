import { gutter } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import {
    latestSettings, LineAuthoringWithId, lineAuthorState
} from "src/lineAuthor/model";
import { getLongestRenderedGutter } from "src/lineAuthor/view/cache";
import { LineAuthoringGutter, TextGutter } from "src/lineAuthor/view/gutter/gutter";
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
    lineMarker(view, line, _otherMarkers) {
        const lineAuthoring = view.state.field(lineAuthorState, false);

        // We have two line numbers here, because embeds, tables and co. cause
        // multiple lines to be rendered with a single gutter. Hence, we need to
        // choose the youngest commit - of which the info will be shown.
        const startLine = view.state.doc.lineAt(line.from).number;
        const endLine = view.state.doc.lineAt(line.to).number;
        const docLastLine = view.state.doc.lines;
        const isEmptyLine = view.state.doc.iterLines(startLine, endLine + 1).next().value === "";

        return createLineAuthorGutter(
            startLine,
            endLine,
            docLastLine,
            isEmptyLine,
            lineAuthoring,
        );
    },
    // Rerender, when we have any state change.
    // Unfortunately, when the cursor moves, the re-render will happen anyways :/
    lineMarkerChange(update) {
        const newLineAuthoringId = update.state.field(lineAuthorState)?.key;
        const oldLineAuthoringId = update.startState.field(lineAuthorState)?.key;
        return oldLineAuthoringId !== newLineAuthoringId;
    },
    renderEmptyElements: true,
    initialSpacer: (_v) => initialSpacingGutter(),
    updateSpacer: (_sp, _u) => getLongestRenderedGutter()?.gutter ?? initialSpacingGutter()
});

function createLineAuthorGutter(
    startLine: number,
    endLine: number,
    docLastLine: number,
    isEmptyLine: boolean,
    optLineAuthoring: LineAuthoringWithId | undefined,
): LineAuthoringGutter | TextGutter {
    if (startLine === docLastLine && isEmptyLine) {
        // last empty line has no git-blame defined.
        return UNDISPLAYED;
    }

    const settings = latestSettings.get();

    if (optLineAuthoring === undefined) {
        return initialLineAuthoringGutter(settings);
    }

    const { key, la } = optLineAuthoring;

    if (la === "untracked") {
        return newUntrackedFileGutter(key, settings);
    }

    if (endLine >= la.hashPerLine.length) return UNDISPLAYED;

    return new LineAuthoringGutter(la, startLine, endLine, key, settings)
}
