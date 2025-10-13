import {
    RangeSet,
    StateField,
    Transaction,
    type Extension,
} from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { Hunks, type Hunk, type SignType } from "./hunks";
import { GitCompareResultEffectType, hunksState } from "./signs";

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
        const isNewCompare = tr.effects.some((effect) =>
            effect.is(GitCompareResultEffectType)
        );
        if (tr.docChanged || isNewCompare) {
            const data = tr.state.field(hunksState);
            if (!data) return RangeSet.empty;
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
    class: "signs-gutter-container",
    markers: (view) => view.state.field(signsMarker),
    initialSpacer: (_) => {
        return new GitGutterMarker("delete", false);
    },
});
