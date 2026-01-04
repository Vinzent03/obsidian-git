import { RangeSet, StateField, Transaction } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { Hunks, type Hunk, type SignType } from "./hunks";
import {
    DebouncedComputeHunksEffectType,
    GitCompareResultEffectType,
    hunksState,
    HunksStateHelper,
} from "./hunkState";
import { togglePreviewHunk } from "./tooltip";

class GitGutterMarker extends GutterMarker {
    constructor(
        readonly type: SignType,
        readonly staged: boolean
    ) {
        super();
    }

    toDOM(_: EditorView) {
        const marker = document.createElement("div");
        marker.className = `git-gutter-marker git-${this.type} ${
            this.staged ? "staged" : "unstaged"
        }`;
        if (this.type == "changedelete") {
            marker.setText("~");
        }
        return marker;
    }
}

export const signsMarker = StateField.define({
    create: () => RangeSet.empty,
    update: (rangeSet, tr) => {
        const data = tr.state.field(hunksState, false);
        if (!data) {
            return RangeSet.empty;
        }
        const newDebouncedHunks = tr.effects.some((effect) =>
            effect.is(DebouncedComputeHunksEffectType)
        );

        // Show new hunks for new compare results independent of a doc change
        const newCompareResult = tr.effects.some((effect) =>
            effect.is(GitCompareResultEffectType)
        );

        if (
            newDebouncedHunks ||
            newCompareResult ||
            ((tr.docChanged || rangeSet.size == 0) && data.isDirty == false)
        ) {
            const linesWithSign = new Set<number>();
            const markers = getMarkers(tr, data.hunks, false, linesWithSign);
            const stagedMarkers = getMarkers(
                tr,
                data.stagedHunks,
                true,
                linesWithSign
            );
            rangeSet = RangeSet.of([...markers, ...stagedMarkers], true);
            return rangeSet;
        } else if (tr.docChanged) {
            rangeSet = rangeSet.map(tr.changes);
        }
        return rangeSet;
    },
});

function getMarkers(
    tr: Transaction,
    hunks: Hunk[],
    staged: boolean,
    linesWithSign: Set<number>
) {
    const signs = [];
    for (let i = 0; i < hunks.length; i++) {
        const prevHunk = i > 0 ? hunks[i - 1] : undefined;
        const nextHunk = i < hunks.length - 1 ? hunks[i + 1] : undefined;
        const hunk = hunks[i];
        signs.push(...Hunks.calcSigns(prevHunk, hunk, nextHunk));
    }

    const markers = [];
    for (const sign of signs) {
        if (linesWithSign.has(sign.lnum)) continue;
        const lineInfo = tr.state.doc.line(sign.lnum);
        linesWithSign.add(sign.lnum);
        markers.push(
            new GitGutterMarker(sign.type, staged).range(
                lineInfo.from,
                lineInfo.to
            )
        );
    }
    return markers;
}

export const signsGutter = gutter({
    class: "git-signs-gutter",
    markers: (view) => view.state.field(signsMarker, false) ?? RangeSet.empty,
    initialSpacer: (_) => {
        return new GitGutterMarker("delete", false);
    },
    domEventHandlers: {
        click: (view, line, event) => {
            const hunk =
                HunksStateHelper.getHunkAtPos(view.state, line.from, false) ??
                HunksStateHelper.getHunkAtPos(view.state, line.from, true);
            if (!hunk) {
                return false;
            }

            togglePreviewHunk(view, line.from);
            event.preventDefault();
            return false;
        },
    },
});
