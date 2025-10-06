import { RangeSet, StateField, type Extension } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import { signsState } from "../model";
import type { Hunk } from "../hunks";

class GitGutterMarker extends GutterMarker {
    constructor(readonly type: Hunk["type"]) {
        super();
    }

    toDOM(_: EditorView) {
        const marker = document.createElement("div");
        marker.className = `git-gutter-marker git-${this.type}`;
        return marker;
    }
}

const signsMarker = StateField.define({
    create: () => RangeSet.empty,
    update: (rangeSet, tr) => {
        if (tr.docChanged || rangeSet.size == 0) {
            const data = tr.state.field(signsState);
            if (!data) return RangeSet.empty;
            const hunks = [];

            for (const change of data.hunks) {
                for (
                    let line = change.added.start;
                    line < change.added.start + change.added.count;
                    line++
                ) {
                    const lineInfo = tr.state.doc.line(line);
                    hunks.push(
                        new GitGutterMarker(change.type).range(
                            lineInfo.from,
                            lineInfo.to
                        )
                    );
                }
                if (change.type == "delete") {
                    const lineInfo = tr.state.doc.line(change.removed.start);
                    hunks.push(
                        new GitGutterMarker(change.type).range(
                            lineInfo.from,
                            lineInfo.to
                        )
                    );
                }
            }

            console.log("ranges", hunks);
            rangeSet = RangeSet.of(hunks);
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
