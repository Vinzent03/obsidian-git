import { RangeSet, StateField, type Extension } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { Hunks, type SignType } from "./hunks";
import { signsState } from "./signs";

class GitGutterMarker extends GutterMarker {
    constructor(readonly type: SignType) {
        super();
    }

    toDOM(_: EditorView) {
        const marker = document.createElement("div");
        marker.className = `git-gutter-marker git-${this.type}`;
        if (this.type == "changedelete") {
            marker.setText("~");
        }
        return marker;
    }
}

const signsMarker = StateField.define({
    create: () => RangeSet.empty,
    update: (rangeSet, tr) => {
        if (tr.docChanged || rangeSet.size == 0) {
            const data = tr.state.field(signsState);
            if (!data) return RangeSet.empty;

            const signs = [];
            const linesWithSign = new Set<number>();
            for (let i = 0; i < data.hunks.length; i++) {
                const prevHunk = i > 0 ? data.hunks[i - 1] : undefined;
                const nextHunk =
                    i < data.hunks.length - 1 ? data.hunks[i + 1] : undefined;
                const hunk = data.hunks[i];
                signs.push(...Hunks.calcSigns(prevHunk, hunk, nextHunk));
            }

            console.log("signs", signs);
            const markers = [];
            for (const sign of signs) {
                if (linesWithSign.has(sign.lnum)) continue;
                linesWithSign.add(sign.lnum);
                const lineInfo = tr.state.doc.line(sign.lnum);
                markers.push(
                    new GitGutterMarker(sign.type).range(
                        lineInfo.from,
                        lineInfo.to
                    )
                );
            }

            rangeSet = RangeSet.of(markers);
            return rangeSet;
        }
        return rangeSet;
    },
});

export const signsGutter: Extension = [
    gutter({
        class: "signs-gutter-container",
        markers: (view) => view.state.field(signsMarker),
        initialSpacer: (_) => {
            return new GitGutterMarker("delete");
        },
    }),
    signsMarker,
];
